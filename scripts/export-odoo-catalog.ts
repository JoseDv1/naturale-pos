/**
 * Script para Exportar el Catálogo Completo de Productos de Odoo a JSON portátil
 * 
 * Genera `data/odoo-catalog.json` con:
 * - Categorías deduplicadas
 * - Productos con precios, costos, stock y departamento
 * - Variantes con sus atributos descriptivos (tamaños, sabores) y precios extra
 * - Códigos SKU / Código de barras garantizados únicos
 */

import { existsSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const CAFE_CATEGORIES = new Set([
  'bebidas',
  'bebidas calientes',
  'bebidas frias',
  'jugos',
  'limonadas',
  'sodas',
  'malteadas',
  'bowl',
  'bowls',
  'bat',
  'batidos de proteina',
  'reposteria',
  'adiciones',
  'arepas',
]);

async function checkPostgres(url: string): Promise<boolean> {
  try {
    const sql = new Bun.sql({ url });
    await sql`SELECT 1`;
    await sql.close();
    return true;
  } catch {
    return false;
  }
}

async function ensurePostgres(): Promise<{ postgresUrl: string; stop: () => void }> {
  const url5433 = 'postgres://naturale@localhost:5433/naturale';
  if (await checkPostgres(url5433)) return { postgresUrl: url5433, stop: () => {} };

  const url5432 = 'postgres://naturale@localhost:5432/naturale';
  if (await checkPostgres(url5432)) return { postgresUrl: url5432, stop: () => {} };

  const containerName = 'odoo-pg-catalog-export';
  const workDir = '/tmp/odoo_pgdata_runtime';
  const sourceDir = '/tmp/Copia Seguridad Odoo';

  console.log('🐳 Iniciando contenedor temporal para extracción de catálogo...');
  execSync(`docker rm -f ${containerName} 2>/dev/null || true`);

  if (!existsSync(workDir)) {
    try {
      execSync(`docker run --rm --user 0 -v /tmp:/tmp alpine rm -rf ${workDir} 2>/dev/null || true`);
    } catch {}
    execSync(`cp -a "${sourceDir}" ${workDir}`);
  }

  try {
    execSync(`docker run --rm --user 0 -v ${workDir}:/data alpine rm -f /data/postmaster.pid 2>/dev/null || true`);
    execSync(`docker run --rm --user 0 -v ${workDir}:/data alpine chmod -R 777 /data 2>/dev/null || true`);
  } catch {}

  let imageName = 'odoo-pg-compat:12';
  try {
    const check = execSync('docker images -q odoo-pg-compat:12').toString().trim();
    if (!check) imageName = 'postgres:12';
  } catch {
    imageName = 'postgres:12';
  }

  execSync(`docker run -d --name ${containerName} -v ${workDir}:/var/lib/postgresql/data -p 5433:5432 ${imageName}`);

  let connected = false;
  for (let retry = 0; retry < 15; retry++) {
    await Bun.sleep(1000);
    if (await checkPostgres(url5433)) {
      connected = true;
      break;
    }
  }

  if (!connected) throw new Error('No se pudo conectar a PostgreSQL.');

  return {
    postgresUrl: url5433,
    stop: () => {
      execSync(`docker rm -f ${containerName} 2>/dev/null || true`);
    }
  };
}

async function exportCatalog() {
  console.log('🚀 Extrayendo catálogo de productos desde Odoo PostgreSQL...');
  const { postgresUrl, stop } = await ensurePostgres();
  const pg = new Bun.sql({ url: postgresUrl });

  try {
    // 1. Categorías
    const odooCategories = await pg`
      SELECT id, name FROM product_category ORDER BY id
    `;
    console.log(`📦 ${odooCategories.length} categorías obtenidas.`);

    // 2. Stock interno
    const stockMap = new Map<number, number>();
    const odooStock = await pg`
      SELECT product_id, sum(quantity) as qty
      FROM stock_quant
      WHERE location_id = 5
      GROUP BY product_id
    `;
    for (const s of odooStock) {
      stockMap.set(Number(s.product_id), Math.max(0, Math.round(Number(s.qty || 0))));
    }

    // 3. Atributos de variantes
    const variantAttributes = await pg`
      SELECT 
        pvc.product_product_id, 
        string_agg(pav.name->>'es_CO', ' / ' ORDER BY pa.sequence, pav.id) as attr_name,
        sum(coalesce(ptav.price_extra, 0)) as extra_price
      FROM product_variant_combination pvc
      JOIN product_template_attribute_value ptav ON pvc.product_template_attribute_value_id = ptav.id
      JOIN product_attribute_value pav ON ptav.product_attribute_value_id = pav.id
      JOIN product_attribute pa ON pav.attribute_id = pa.id
      GROUP BY pvc.product_product_id
    `;
    const variantAttrMap = new Map<number, { name: string; extraPrice: number }>();
    for (const v of variantAttributes) {
      variantAttrMap.set(Number(v.product_product_id), {
        name: v.attr_name || '',
        extraPrice: Number(v.extra_price || 0),
      });
    }

    // 4. Productos y Plantillas
    const odooProducts = await pg`
      SELECT 
        pp.id as product_id,
        pp.barcode,
        pp.default_code as variant_code,
        pp.standard_price as variant_cost_json,
        pp.active as variant_active,
        pt.id as tmpl_id,
        pt.name as tmpl_name_json,
        pt.default_code as tmpl_code,
        pt.list_price as tmpl_price,
        pt.categ_id,
        pt.active as tmpl_active
      FROM product_product pp
      JOIN product_template pt ON pp.product_tmpl_id = pt.id
      ORDER BY pt.id, pp.id
    `;
    console.log(`📦 ${odooProducts.length} registros de productos/variantes obtenidos.`);

    // Agrupar por plantilla
    const tmplToVariants = new Map<number, typeof odooProducts>();
    for (const p of odooProducts) {
      const tmplId = Number(p.tmpl_id);
      if (!tmplToVariants.has(tmplId)) tmplToVariants.set(tmplId, []);
      tmplToVariants.get(tmplId)!.push(p);
    }

    // Deduplicar categorías por nombre
    const categoriesOutput: Array<{ id: string; name: string; description: string }> = [];
    const catNameToId = new Map<string, string>();
    const odooCatIdToName = new Map<number, string>();

    for (const c of odooCategories) {
      const catName = String(c.name || 'General').trim();
      const norm = catName.toLowerCase();
      odooCatIdToName.set(Number(c.id), catName);

      if (!catNameToId.has(norm)) {
        const id = crypto.randomUUID();
        catNameToId.set(norm, id);
        categoriesOutput.push({
          id,
          name: catName,
          description: `Categoría importada: ${catName}`,
        });
      }
    }

    const usedSkus = new Set<string>();
    const makeUniqueSku = (candidate: string, fallbackId: number): string => {
      let clean = candidate.trim();
      if (!clean) clean = `ODOO-${fallbackId}`;
      if (!usedSkus.has(clean)) {
        usedSkus.add(clean);
        return clean;
      }
      let suffixed = `${clean}-${fallbackId}`;
      if (!usedSkus.has(suffixed)) {
        usedSkus.add(suffixed);
        return suffixed;
      }
      suffixed = `ODOO-${fallbackId}-${crypto.randomUUID().slice(0, 4)}`;
      usedSkus.add(suffixed);
      return suffixed;
    };

    const productsOutput: any[] = [];

    for (const [tmplId, variants] of tmplToVariants.entries()) {
      const first = variants[0];
      const tmplNameObj = typeof first.tmpl_name_json === 'object' ? first.tmpl_name_json : JSON.parse(first.tmpl_name_json || '{}');
      const tmplName = String(tmplNameObj.es_CO || tmplNameObj.en_US || Object.values(tmplNameObj)[0] || `Producto ${tmplId}`).trim();

      const origCatName = odooCatIdToName.get(Number(first.categ_id)) || 'General';
      const isCafe = CAFE_CATEGORIES.has(origCatName.toLowerCase());
      const department = isCafe ? 'CAFE' : 'MARKET';

      const productId = crypto.randomUUID();

      if (variants.length === 1) {
        // Producto simple
        const v = variants[0];
        const prodId = Number(v.product_id);
        const barcode = (v.barcode || '').trim();
        const defCode = (v.variant_code || v.tmpl_code || '').trim();
        const sku = makeUniqueSku(barcode || defCode, prodId);

        const price = Number(v.tmpl_price || 0);
        let cost = 0;
        if (v.variant_cost_json) {
          try {
            const costObj = typeof v.variant_cost_json === 'object' ? v.variant_cost_json : JSON.parse(v.variant_cost_json);
            cost = Number(Object.values(costObj)[0] || 0);
          } catch {}
        }

        const recordedStock = stockMap.get(prodId);
        const stock = (isCafe && recordedStock === undefined) ? 999 : (recordedStock ?? 0);

        productsOutput.push({
          id: productId,
          sku,
          barcode: barcode || null,
          name: tmplName,
          categoryName: origCatName,
          department,
          price,
          cost,
          stock,
          active: Boolean(v.variant_active && v.tmpl_active),
          variants: [],
        });
      } else {
        // Producto con variantes
        const tmplSku = makeUniqueSku((first.tmpl_code || '').trim(), tmplId);
        const basePrice = Number(first.tmpl_price || 0);
        let totalStock = 0;

        const variantsList: any[] = [];
        for (const v of variants) {
          const prodId = Number(v.product_id);
          const attr = variantAttrMap.get(prodId);
          const variantName = attr?.name || (v.variant_code ? String(v.variant_code) : `Opción ${prodId}`);
          const variantBarcode = (v.barcode || '').trim();
          const variantSku = makeUniqueSku(variantBarcode || (v.variant_code || '').trim(), prodId);

          const variantPrice = basePrice + (attr?.extraPrice || 0);
          let cost = 0;
          if (v.variant_cost_json) {
            try {
              const costObj = typeof v.variant_cost_json === 'object' ? v.variant_cost_json : JSON.parse(v.variant_cost_json);
              cost = Number(Object.values(costObj)[0] || 0);
            } catch {}
          }

          const recordedStock = stockMap.get(prodId);
          const variantStock = (isCafe && recordedStock === undefined) ? 999 : (recordedStock ?? 0);
          totalStock += variantStock;

          variantsList.push({
            id: crypto.randomUUID(),
            name: variantName,
            sku: variantSku,
            barcode: variantBarcode || null,
            price: variantPrice,
            cost,
            stock: variantStock,
            active: Boolean(v.variant_active),
          });
        }

        productsOutput.push({
          id: productId,
          sku: tmplSku,
          barcode: null,
          name: tmplName,
          categoryName: origCatName,
          department,
          price: basePrice,
          cost: 0,
          stock: totalStock,
          active: Boolean(first.tmpl_active),
          variants: variantsList,
        });
      }
    }

    const catalog = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      summary: {
        categoriesCount: categoriesOutput.length,
        productsCount: productsOutput.length,
        variantsCount: productsOutput.reduce((acc, p) => acc + p.variants.length, 0),
      },
      categories: categoriesOutput,
      products: productsOutput,
    };

    const outputPath = join(process.cwd(), 'data', 'odoo-catalog.json');
    writeFileSync(outputPath, JSON.stringify(catalog, null, 2), 'utf-8');

    // Sincronizar también con catalogo-web si existe
    const webDataDir = join(process.cwd(), 'catalogo-web', 'data');
    if (existsSync(webDataDir)) {
      writeFileSync(join(webDataDir, 'products.json'), JSON.stringify(catalog, null, 2), 'utf-8');
      writeFileSync(join(webDataDir, 'products.js'), `window.CATALOG_DATA = ${JSON.stringify(catalog, null, 2)};\n`, 'utf-8');
      console.log(`🌐 Catálogo sincronizado en: catalogo-web/data/ (products.json y products.js)`);
    }

    console.log(`\n✅ Catálogo guardado en: ${outputPath}`);
    console.log(`   - Categorías: ${catalog.summary.categoriesCount}`);
    console.log(`   - Productos Base: ${catalog.summary.productsCount}`);
    console.log(`   - Variantes: ${catalog.summary.variantsCount}`);
  } finally {
    await pg.close();
    stop();
  }
}

if (import.meta.main) {
  exportCatalog().catch((err) => {
    console.error('❌ Error al exportar catálogo:', err);
    process.exit(1);
  });
}
