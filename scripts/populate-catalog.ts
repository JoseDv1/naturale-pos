/**
 * Script de Poblado / Carga de Catálogo desde Odoo JSON - Naturale POS
 * 
 * Diseñado para ejecutarse de forma independiente para cargar o sincronizar
 * las categorías, productos y variantes desde `data/odoo-catalog.json` hacia la base de datos SQLite.
 * 
 * Uso:
 *   bun scripts/populate-catalog.ts [opciones]
 *   o bien: populate-catalog.exe [opciones]
 * 
 * Opciones:
 *   --replace          Elimina productos y categorías previas antes de importar el catálogo nuevo.
 *   --dry-run          Valida el archivo JSON sin realizar cambios en la base de datos.
 *   --catalog <path>   Ruta al archivo JSON del catálogo (por defecto: ./data/odoo-catalog.json).
 *   --db <path>        Ruta a la base de datos SQLite (por defecto: ./prisma/dev.db).
 *   --no-backup        Omite la creación del archivo de respaldo .bak.
 *   --help, -h         Muestra este mensaje de ayuda.
 */

import { Database } from 'bun:sqlite';
import { existsSync, copyFileSync, readFileSync } from 'fs';
import { join } from 'path';

interface PopulateOptions {
  targetDb: string;
  catalogFile: string;
  replace: boolean;
  dryRun: boolean;
  noBackup: boolean;
  help: boolean;
}

function parseArgs(): PopulateOptions {
  const args = process.argv.slice(2);
  const options: PopulateOptions = {
    targetDb: join(process.cwd(), 'prisma', 'dev.db'),
    catalogFile: join(process.cwd(), 'data', 'odoo-catalog.json'),
    replace: false,
    dryRun: false,
    noBackup: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--replace' || arg === '--clean') options.replace = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--no-backup') options.noBackup = true;
    else if (arg === '--db' && args[i + 1]) options.targetDb = args[++i];
    else if (arg === '--catalog' && args[i + 1]) options.catalogFile = args[++i];
    else if (arg === '--help' || arg === '-h') options.help = true;
  }

  return options;
}

export async function populateCatalog(customOptions?: Partial<PopulateOptions>) {
  const options: PopulateOptions = { ...parseArgs(), ...customOptions };

  if (options.help) {
    console.log(`
Uso: bun scripts/populate-catalog.ts [opciones]
     o bien: populate-catalog.exe [opciones]

Opciones:
  --replace              Elimina productos y categorías previas antes de importar el catálogo limpio.
  --dry-run              Valida el archivo JSON sin realizar cambios en la base de datos.
  --catalog <path>       Ruta al archivo JSON de catálogo (por defecto: ./data/odoo-catalog.json).
  --db <path>            Ruta a la base de datos (por defecto: ./prisma/dev.db).
  --no-backup            Omite la creación automática del archivo de respaldo .bak.
  --help, -h             Muestra este mensaje de ayuda.
`);
    return;
  }

  console.log('==================================================================');
  console.log('📦 POBLADOR DE CATÁLOGO ODOO -> NATURALE POS');
  console.log('==================================================================');
  console.log(`📄 Archivo Catálogo: ${options.catalogFile}`);
  console.log(`💾 Base de datos:    ${options.targetDb}`);
  console.log(`🧹 Modo Reemplazo:   ${options.replace ? 'SÍ (reemplaza catálogo previo)' : 'NO (conserva / actualiza)'}`);
  console.log(`🧪 Modo Dry-Run:     ${options.dryRun ? 'SÍ (sin escritura)' : 'NO'}`);
  console.log('------------------------------------------------------------------\n');

  if (!existsSync(options.catalogFile)) {
    throw new Error(`No se encontró el archivo de catálogo en: "${options.catalogFile}".`);
  }

  const raw = readFileSync(options.catalogFile, 'utf-8');
  const catalog = JSON.parse(raw);

  if (!catalog.products || !Array.isArray(catalog.products)) {
    throw new Error('El archivo JSON no contiene un arreglo válido de productos.');
  }

  console.log('📋 Resumen de datos a importar:');
  console.log(`   - Categorías en catálogo: ${catalog.categories?.length || 0}`);
  console.log(`   - Productos Base:         ${catalog.products.length}`);
  const totalVariants = catalog.products.reduce((acc: number, p: any) => acc + (p.variants?.length || 0), 0);
  console.log(`   - Variantes de Producto:  ${totalVariants}\n`);

  if (options.dryRun) {
    console.log('🧪 [DRY-RUN] Validación exitosa. No se realizaron modificaciones en la base de datos.');
    return;
  }

  if (!existsSync(options.targetDb)) {
    throw new Error(`La base de datos SQLite "${options.targetDb}" no existe. Inicia el sistema o ejecuta las migraciones primero.`);
  }

  // Respaldo de seguridad previo
  if (!options.noBackup) {
    const backupPath = `${options.targetDb}.bak.${Date.now()}`;
    copyFileSync(options.targetDb, backupPath);
    console.log(`🛡️  Respaldo de seguridad creado: ${backupPath}`);
  }

  const db = new Database(options.targetDb);
  db.exec('PRAGMA foreign_keys = OFF;');

  try {
    const now = new Date().toISOString();

    if (options.replace) {
      console.log('🧹 Limpiando productos y categorías previas...');
      db.exec(`
        DELETE FROM ProductModifier;
        DELETE FROM ProductVariant;
        DELETE FROM Product;
        DELETE FROM Category WHERE name != 'Sin categoría';
      `);
      console.log('   ✅ Catálogo previo vaciado.');
    }

    // 1. Categorías
    console.log('📁 Procesando categorías...');
    const catNameToId = new Map<string, string>();
    const existingCats = db.query('SELECT id, name FROM Category').all() as Array<{ id: string; name: string }>;
    for (const c of existingCats) catNameToId.set(c.name.trim().toLowerCase(), c.id);

    const insertCat = db.prepare(`
      INSERT INTO Category (id, name, description, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?)
    `);

    let catsAdded = 0;
    for (const c of catalog.categories || []) {
      const norm = c.name.trim().toLowerCase();
      if (!catNameToId.has(norm)) {
        const id = c.id || crypto.randomUUID();
        insertCat.run(id, c.name.trim(), c.description || null, now, now);
        catNameToId.set(norm, id);
        catsAdded++;
      }
    }
    console.log(`   ✅ Categorías listas (${catsAdded} nuevas añadidas).`);

    const defaultCatId = catNameToId.get('sin categoría') || Array.from(catNameToId.values())[0];

    // 2. Productos y Variantes
    console.log('🏷️  Importando productos y variantes...');
    const insertProd = db.prepare(`
      INSERT OR REPLACE INTO Product (id, sku, name, description, price, cost, stock, categoryId, department, isRawMaterial, active, createdAt, updatedAt, imageUrl)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertVariant = db.prepare(`
      INSERT OR REPLACE INTO ProductVariant (id, productId, name, sku, price, cost, stock, active, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let prodsCount = 0;
    let varsCount = 0;

    db.transaction(() => {
      for (const p of catalog.products || []) {
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
        prodsCount++;

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
            varsCount++;
          }
        }
      }
    })();

    console.log(`   ✅ ${prodsCount} productos y ${varsCount} variantes procesados exitosamente.`);

    // 3. Verificar integridad
    db.exec('PRAGMA foreign_keys = ON;');
    const integrity = db.query('PRAGMA foreign_key_check;').all();
    if (integrity.length > 0) {
      console.warn('⚠️ Advertencia: anomalías detectadas en llaves foráneas:', integrity);
    } else {
      console.log('✅ Integridad referencial verificada.');
    }

    // 4. Resumen
    const currentCounts = {
      categories: (db.query('SELECT count(*) as c FROM Category').get() as any)?.c,
      products: (db.query('SELECT count(*) as c FROM Product').get() as any)?.c,
      variants: (db.query('SELECT count(*) as c FROM ProductVariant').get() as any)?.c,
    };

    console.log('\n==================================================================');
    console.log('🎉 CATÁLOGO POBLADO CORRECTAMENTE');
    console.log('==================================================================');
    console.table([
      { Entidad: 'Categorías Totales', Cantidad: currentCounts.categories },
      { Entidad: 'Productos Base', Cantidad: currentCounts.products },
      { Entidad: 'Variantes Totales', Cantidad: currentCounts.variants },
    ]);
    console.log('==================================================================\n');
  } finally {
    db.close();
  }
}

if (import.meta.main) {
  populateCatalog().catch((err) => {
    console.error('❌ Error durante la importación del catálogo:', err);
    process.exit(1);
  });
}
