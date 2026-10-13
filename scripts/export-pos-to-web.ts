/**
 * Exportador de Productos del POS SQLite al Catálogo Web
 * 
 * Lee directamente de `prisma/dev.db` y sincroniza:
 * - `catalogo-web/data/products.json`
 * - `catalogo-web/data/products.js`
 * - `data/odoo-catalog.json`
 */

import { Database } from 'bun:sqlite';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

function parseDbPath(): string {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--db' || args[i] === '-d') && args[i + 1]) {
      return args[i + 1];
    }
    if (!args[i].startsWith('-')) {
      return args[i];
    }
  }
  return join(process.cwd(), 'prisma', 'dev.db');
}

function exportPosToWeb() {
  const dbPath = parseDbPath();
  if (!existsSync(dbPath)) {
    console.error('❌ No se encontró la base de datos SQLite en:', dbPath);
    process.exit(1);
  }

  console.log(`🔄 Exportando catálogo desde la base de datos SQLite: ${dbPath}`);
  const db = new Database(dbPath, { readonly: true });

  // 1. Obtener categorías
  const categories = db.query(`
    SELECT id, name, description
    FROM Category
    ORDER BY name ASC
  `).all() as Array<{ id: string; name: string; description: string | null }>;

  // 2. Obtener productos
  const rawProducts = db.query(`
    SELECT 
      p.id, 
      p.sku, 
      p.name, 
      p.description,
      p.imageUrl,
      CAST(p.price AS REAL) as price, 
      CAST(p.cost AS REAL) as cost, 
      p.stock, 
      p.department, 
      p.isRawMaterial,
      p.active, 
      c.name as categoryName
    FROM Product p
    LEFT JOIN Category c ON p.categoryId = c.id
    ORDER BY p.name ASC
  `).all() as Array<any>;

  // 3. Obtener variantes
  const rawVariants = db.query(`
    SELECT 
      id, 
      productId, 
      name, 
      sku, 
      CAST(price AS REAL) as price, 
      CAST(cost AS REAL) as cost, 
      stock, 
      active
    FROM ProductVariant
    ORDER BY name ASC
  `).all() as Array<any>;

  // 4. Obtener modificadores
  let rawModifiers: Array<any> = [];
  try {
    rawModifiers = db.query(`
      SELECT 
        id,
        productId,
        name,
        CAST(price AS REAL) as price,
        CAST(cost AS REAL) as cost,
        isDefault,
        active
      FROM ProductModifier
      ORDER BY name ASC
    `).all() as Array<any>;
  } catch {
    // En caso de que la tabla no exista en versiones antiguas
  }

  db.close();

  // Agrupar variantes por producto
  const variantsByProduct = new Map<string, any[]>();
  for (const v of rawVariants) {
    if (!variantsByProduct.has(v.productId)) {
      variantsByProduct.set(v.productId, []);
    }
    variantsByProduct.get(v.productId)!.push({
      id: v.id,
      name: v.name,
      sku: v.sku,
      price: v.price,
      cost: v.cost,
      stock: v.stock,
      active: Boolean(v.active),
    });
  }

  // Agrupar modificadores por producto
  const modifiersByProduct = new Map<string, any[]>();
  for (const m of rawModifiers) {
    if (!modifiersByProduct.has(m.productId)) {
      modifiersByProduct.set(m.productId, []);
    }
    modifiersByProduct.get(m.productId)!.push({
      id: m.id,
      name: m.name,
      price: m.price,
      cost: m.cost,
      isDefault: Boolean(m.isDefault),
      active: Boolean(m.active),
    });
  }

  const products = rawProducts.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    description: p.description || null,
    imageUrl: p.imageUrl || null,
    categoryName: p.categoryName || 'General',
    department: p.department,
    price: p.price,
    cost: p.cost,
    stock: p.stock,
    isRawMaterial: Boolean(p.isRawMaterial),
    active: Boolean(p.active),
    variants: variantsByProduct.get(p.id) || [],
    modifiers: modifiersByProduct.get(p.id) || [],
  }));

  const catalog = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    summary: {
      categoriesCount: categories.length,
      productsCount: products.length,
      variantsCount: rawVariants.length,
      modifiersCount: rawModifiers.length,
    },
    categories,
    products,
  };

  // Guardar catálogo completo del POS en data/odoo-catalog.json
  const dataDir = join(process.cwd(), 'data');
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, 'odoo-catalog.json'), JSON.stringify(catalog, null, 2), 'utf-8');

  // Construir versión pública sanitizada para catalogo-web (sin costos de compra ni productos inactivos/internos)
  const INTERNAL_NAMES = new Set(['TIPS', 'VARIOS']);
  const webProducts = products
    .filter((p) => {
      if (!p.active) return false;
      if (p.sku === 'TIPS') return false;
      const upperName = (p.name || '').trim().toUpperCase();
      if (INTERNAL_NAMES.has(upperName) && Number(p.price) <= 1) return false;
      return true;
    })
    .map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      description: p.description,
      imageUrl: p.imageUrl,
      categoryName: p.categoryName,
      department: p.department,
      price: p.price,
      active: true,
      variants: (p.variants || [])
        .filter((v) => v.active !== false)
        .map((v) => ({
          id: v.id,
          name: v.name,
          sku: v.sku,
          price: v.price,
          active: true,
        })),
      modifiers: (p.modifiers || [])
        .filter((m) => m.active !== false)
        .map((m) => ({
          id: m.id,
          name: m.name,
          price: m.price,
          isDefault: m.isDefault,
          active: true,
        })),
    }));

  const activeCategoryNames = new Set(webProducts.map((p) => p.categoryName));
  const webCategories = categories.filter((c) => activeCategoryNames.has(c.name));

  const webCatalog = {
    version: '1.0',
    exportedAt: catalog.exportedAt,
    summary: {
      categoriesCount: webCategories.length,
      productsCount: webProducts.length,
      variantsCount: webProducts.reduce((acc, p) => acc + p.variants.length, 0),
      modifiersCount: webProducts.reduce((acc, p) => acc + p.modifiers.length, 0),
    },
    categories: webCategories,
    products: webProducts,
  };

  // Guardar en catalogo-web/data/
  const webDataDir = join(process.cwd(), 'catalogo-web', 'data');
  if (!existsSync(webDataDir)) mkdirSync(webDataDir, { recursive: true });
  writeFileSync(join(webDataDir, 'products.json'), JSON.stringify(webCatalog, null, 2), 'utf-8');
  writeFileSync(join(webDataDir, 'products.js'), `window.CATALOG_DATA = ${JSON.stringify(webCatalog, null, 2)};\n`, 'utf-8');

  console.log('✅ Exportación completada con éxito:');
  console.log(`   - POS (data/odoo-catalog.json): ${catalog.summary.categoriesCount} categorías, ${catalog.summary.productsCount} productos, ${catalog.summary.variantsCount} variantes, ${catalog.summary.modifiersCount} modificadores`);
  console.log(`   - Web (catalogo-web/data/*):    ${webCatalog.summary.categoriesCount} categorías activas, ${webCatalog.summary.productsCount} productos visibles, ${webCatalog.summary.variantsCount} variantes activas, ${webCatalog.summary.modifiersCount} modificadores activos`);
  console.log(`📁 Archivos actualizados:`);
  console.log(`   - data/odoo-catalog.json`);
  console.log(`   - catalogo-web/data/products.json`);
  console.log(`   - catalogo-web/data/products.js`);
}

if (import.meta.main) {
  exportPosToWeb();
}

