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

function exportPosToWeb() {
  const dbPath = join(process.cwd(), 'prisma', 'dev.db');
  if (!existsSync(dbPath)) {
    console.error('❌ No se encontró la base de datos local en:', dbPath);
    process.exit(1);
  }

  console.log('🔄 Exportando catálogo desde la base de datos local SQLite...');
  const db = new Database(dbPath);

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

  const products = rawProducts.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    categoryName: p.categoryName || 'General',
    department: p.department,
    price: p.price,
    cost: p.cost,
    stock: p.stock,
    active: Boolean(p.active),
    variants: variantsByProduct.get(p.id) || [],
  }));

  const catalog = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    summary: {
      categoriesCount: categories.length,
      productsCount: products.length,
      variantsCount: rawVariants.length,
    },
    categories,
    products,
  };

  // Guardar en data/odoo-catalog.json
  const dataDir = join(process.cwd(), 'data');
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, 'odoo-catalog.json'), JSON.stringify(catalog, null, 2), 'utf-8');

  // Guardar en catalogo-web/data/
  const webDataDir = join(process.cwd(), 'catalogo-web', 'data');
  if (!existsSync(webDataDir)) mkdirSync(webDataDir, { recursive: true });
  writeFileSync(join(webDataDir, 'products.json'), JSON.stringify(catalog, null, 2), 'utf-8');
  writeFileSync(join(webDataDir, 'products.js'), `window.CATALOG_DATA = ${JSON.stringify(catalog, null, 2)};\n`, 'utf-8');

  console.log('✅ Exportación completada con éxito:');
  console.log(`   - Categorías: ${catalog.summary.categoriesCount}`);
  console.log(`   - Productos: ${catalog.summary.productsCount}`);
  console.log(`   - Variantes: ${catalog.summary.variantsCount}`);
  console.log(`📁 Archivos actualizados:`);
  console.log(`   - data/odoo-catalog.json`);
  console.log(`   - catalogo-web/data/products.json`);
  console.log(`   - catalogo-web/data/products.js`);
}

if (import.meta.main) {
  exportPosToWeb();
}
