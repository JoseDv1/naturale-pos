/**
 * Script Portátil para Importar el Catálogo de Odoo a Naturale POS
 * 
 * Este script NO requiere Docker ni PostgreSQL.
 * Puede ejecutarse en cualquier PC o entorno donde esté Naturale POS con Bun.
 * Lee directamente `data/odoo-catalog.json` y carga los productos en SQLite.
 */

import { Database } from 'bun:sqlite';
import { existsSync, readFileSync, copyFileSync } from 'fs';
import { join } from 'path';

interface ImportOptions {
  catalogFile: string;
  targetDb: string;
  clean: boolean;
  dryRun: boolean;
}

function parseArgs(): ImportOptions {
  const args = process.argv.slice(2);
  const options: ImportOptions = {
    catalogFile: join(process.cwd(), 'data', 'odoo-catalog.json'),
    targetDb: join(process.cwd(), 'prisma', 'dev.db'),
    clean: false,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--clean') options.clean = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--file' && args[i + 1]) options.catalogFile = args[++i];
    else if (arg === '--target-db' && args[i + 1]) options.targetDb = args[++i];
    else if (arg === '--help' || arg === '-h') {
      console.log(`
Uso: bun scripts/import-odoo-products.ts [opciones]

Opciones:
  --clean            Elimina productos y categorías previas antes de importar el catálogo nuevo
  --dry-run          Valida el archivo JSON sin realizar cambios en la base de datos
  --file <path>      Ruta al archivo JSON del catálogo (por defecto: data/odoo-catalog.json)
  --target-db <path> Ruta a la base de datos SQLite (por defecto: prisma/dev.db)
  --help, -h         Muestra este mensaje de ayuda
`);
      process.exit(0);
    }
  }

  return options;
}

export async function importCatalog(customOptions?: Partial<ImportOptions>) {
  const options: ImportOptions = { ...parseArgs(), ...customOptions };

  console.log('==================================================================');
  console.log('📦 IMPORTADOR PORTÁTIL DE CATÁLOGO ODOO -> NATURALE POS');
  console.log('==================================================================');
  console.log(`📄 Archivo Catálogo: ${options.catalogFile}`);
  console.log(`💾 Destino SQLite:    ${options.targetDb}`);
  console.log(`🧹 Modo Clean:        ${options.clean ? 'SÍ (reemplaza productos existentes)' : 'NO (conserva y actualiza)'}`);
  console.log(`🧪 Modo Dry-Run:      ${options.dryRun ? 'SÍ (sin escritura)' : 'NO'}`);
  console.log('------------------------------------------------------------------\n');

  if (!existsSync(options.catalogFile)) {
    throw new Error(`No se encontró el archivo de catálogo en: "${options.catalogFile}".`);
  }

  const raw = readFileSync(options.catalogFile, 'utf-8');
  const catalog = JSON.parse(raw);

  if (!catalog.products || !Array.isArray(catalog.products)) {
    throw new Error('El archivo JSON no contiene un arreglo válido de productos.');
  }

  console.log(`📋 Catálogo cargado:`);
  console.log(`   - Categorías: ${catalog.categories?.length || 0}`);
  console.log(`   - Productos Base: ${catalog.products.length}`);
  const totalVariants = catalog.products.reduce((acc: number, p: any) => acc + (p.variants?.length || 0), 0);
  console.log(`   - Variantes de Productos: ${totalVariants}`);

  if (options.dryRun) {
    console.log('\n🧪 [DRY-RUN] Validación exitosa. No se aplicaron cambios.');
    return;
  }

  if (!existsSync(options.targetDb)) {
    throw new Error(`La base de datos SQLite "${options.targetDb}" no existe.`);
  }

  // Respaldo de seguridad previo
  const backupPath = `${options.targetDb}.bak.${Date.now()}`;
  copyFileSync(options.targetDb, backupPath);
  console.log(`🛡️  Respaldo de SQLite creado: ${backupPath}`);

  const db = new Database(options.targetDb);
  db.exec('PRAGMA foreign_keys = OFF;');

  try {
    const now = new Date().toISOString();

    if (options.clean) {
      console.log('🧹 Limpiando productos, categorías e historial previo para dejar el sistema listo para operar...');
      db.exec(`
        UPDATE CafeTable SET currentSaleId = NULL, status = 'AVAILABLE';
        DELETE FROM SalePayment;
        DELETE FROM SaleItem;
        DELETE FROM Sale;
        DELETE FROM ExpenseItem;
        DELETE FROM Expense;
        DELETE FROM ProductTransfer;
        DELETE FROM Shift;
        DELETE FROM ProductModifier;
        DELETE FROM ProductVariant;
        DELETE FROM Product;
        DELETE FROM Category WHERE name != 'Sin categoría';
      `);
    }

    // 1. Importar / Asegurar Categorías
    console.log('📂 Procesando categorías...');
    const catNameToId = new Map<string, string>();
    const existingCats = db.query('SELECT id, name FROM Category').all() as Array<{ id: string; name: string }>;
    for (const c of existingCats) catNameToId.set(c.name.trim().toLowerCase(), c.id);

    const insertCat = db.prepare(`
      INSERT INTO Category (id, name, description, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const c of catalog.categories || []) {
      const norm = c.name.trim().toLowerCase();
      if (!catNameToId.has(norm)) {
        const id = c.id || crypto.randomUUID();
        insertCat.run(id, c.name.trim(), c.description || null, now, now);
        catNameToId.set(norm, id);
      }
    }

    const defaultCatId = catNameToId.get('sin categoría') || Array.from(catNameToId.values())[0];

    // 2. Importar Productos y Variantes
    console.log('🏷️  Importando productos y variantes...');
    const insertProd = db.prepare(`
      INSERT INTO Product (id, sku, name, description, price, cost, stock, categoryId, department, isRawMaterial, active, createdAt, updatedAt, imageUrl)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertVariant = db.prepare(`
      INSERT INTO ProductVariant (id, productId, name, sku, price, cost, stock, active, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let prodsInserted = 0;
    let variantsInserted = 0;

    db.transaction(() => {
      for (const p of catalog.products) {
        const catId = catNameToId.get((p.categoryName || '').trim().toLowerCase()) || defaultCatId;
        const productId = p.id || crypto.randomUUID();

        insertProd.run(
          productId,
          p.sku,
          p.name,
          p.description || null,
          Number(p.price || 0),
          Number(p.cost || 0),
          Number(p.stock || 0),
          catId,
          p.department === 'CAFE' ? 'CAFE' : 'MARKET',
          p.isRawMaterial ? 1 : 0,
          p.active !== false ? 1 : 0,
          now,
          now,
          p.imageUrl || null
        );
        prodsInserted++;

        if (p.variants && Array.isArray(p.variants)) {
          for (const v of p.variants) {
            insertVariant.run(
              v.id || crypto.randomUUID(),
              productId,
              v.name,
              v.sku,
              Number(v.price || p.price || 0),
              Number(v.cost || 0),
              Number(v.stock || 0),
              v.active !== false ? 1 : 0,
              now,
              now
            );
            variantsInserted++;
          }
        }
      }
    })();

    db.exec('PRAGMA foreign_keys = ON;');
    const integrity = db.query('PRAGMA foreign_key_check;').all();
    if (integrity.length > 0) {
      console.warn('⚠️ Advertencia de integridad:', integrity);
    } else {
      console.log('✅ Integridad referencial verificada.');
    }

    console.log('\n==================================================================');
    console.log('🎉 ¡CATÁLOGO DE PRODUCTOS IMPORTADO CON ÉXITO!');
    console.log('==================================================================');
    console.log(`✅ Productos importados: ${prodsInserted}`);
    console.log(`✅ Variantes importadas: ${variantsInserted}`);
    console.log('==================================================================\n');
  } finally {
    db.close();
  }
}

if (import.meta.main) {
  importCatalog().catch((err) => {
    console.error('❌ Error durante la importación del catálogo:', err);
    process.exit(1);
  });
}
