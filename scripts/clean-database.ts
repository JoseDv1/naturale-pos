/**
 * Script de Limpieza y Restablecimiento de Base de Datos - Naturale POS
 * 
 * Diseñado para ejecutarse en este PC o en el PC de destino (distribución GitHub Releases).
 * Permite limpiar datos de prueba, ventas previas y restablecer el catálogo de Odoo.
 * 
 * Modos:
 * - Completo (por defecto): Limpia historial y recarga el catálogo limpio de Odoo.
 * - --transactions-only: Limpia únicamente ventas, turnos y gastos (deja productos intactos).
 * - --products-only: Limpia únicamente productos y recarga catálogo (deja ventas/turnos intactos).
 */

import { Database } from 'bun:sqlite';
import { existsSync, copyFileSync, readFileSync } from 'fs';
import { join } from 'path';

interface CleanOptions {
  targetDb: string;
  catalogFile: string;
  mode: 'all' | 'transactions-only' | 'products-only';
  noBackup: boolean;
  help: boolean;
}

function parseArgs(): CleanOptions {
  const args = process.argv.slice(2);
  const options: CleanOptions = {
    targetDb: join(process.cwd(), 'prisma', 'dev.db'),
    catalogFile: join(process.cwd(), 'data', 'odoo-catalog.json'),
    mode: 'all',
    noBackup: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--transactions-only') options.mode = 'transactions-only';
    else if (arg === '--products-only') options.mode = 'products-only';
    else if (arg === '--all') options.mode = 'all';
    else if (arg === '--no-backup') options.noBackup = true;
    else if (arg === '--db' && args[i + 1]) options.targetDb = args[++i];
    else if (arg === '--catalog' && args[i + 1]) options.catalogFile = args[++i];
    else if (arg === '--help' || arg === '-h') options.help = true;
  }

  return options;
}

export async function cleanDatabase(customOptions?: Partial<CleanOptions>) {
  const options: CleanOptions = { ...parseArgs(), ...customOptions };

  if (options.help) {
    console.log(`
Uso: bun scripts/clean-database.ts [opciones]
     o bien: clean-database.exe [opciones]

Opciones:
  --all                  (Por defecto) Limpia historial y recarga el catálogo de Odoo.
  --transactions-only    Elimina sólo ventas, pagos, turnos y gastos (mantiene productos).
  --products-only        Limpia y recarga productos/categorías de Odoo (mantiene ventas).
  --db <path>            Ruta a la base de datos (por defecto: ./prisma/dev.db).
  --catalog <path>       Ruta al archivo JSON de catálogo (por defecto: ./data/odoo-catalog.json).
  --no-backup            Omite la creación automática del archivo de respaldo .bak.
  --help, -h             Muestra este mensaje de ayuda.
`);
    return;
  }

  console.log('==================================================================');
  console.log('🧹 LIMPIADOR DE BASE DE DATOS - NATURALE POS');
  console.log('==================================================================');
  console.log(`💾 Base de datos:  ${options.targetDb}`);
  console.log(`⚙️  Modo:           ${options.mode.toUpperCase()}`);
  console.log('------------------------------------------------------------------\n');

  if (!existsSync(options.targetDb)) {
    console.log(`ℹ️ La base de datos "${options.targetDb}" no existe todavía.`);
    console.log('   Se inicializará automáticamente al arrancar Naturale POS.');
    return;
  }

  // 1. Respaldo de seguridad
  if (!options.noBackup) {
    const backupPath = `${options.targetDb}.bak.${Date.now()}`;
    copyFileSync(options.targetDb, backupPath);
    console.log(`🛡️  Respaldo de seguridad creado: ${backupPath}`);
  }

  const db = new Database(options.targetDb);
  db.exec('PRAGMA foreign_keys = OFF;');

  try {
    const now = new Date().toISOString();

    // 2. Limpieza de transacciones (Ventas, Turnos, Gastos)
    if (options.mode === 'all' || options.mode === 'transactions-only') {
      console.log('🧹 Limpiando historial transaccional previo...');
      db.exec(`
        UPDATE CafeTable SET currentSaleId = NULL, status = 'AVAILABLE';
        DELETE FROM SalePayment;
        DELETE FROM SaleItem;
        DELETE FROM Sale;
        DELETE FROM ExpenseItem;
        DELETE FROM Expense;
        DELETE FROM ProductTransfer;
        DELETE FROM Shift;
      `);
      console.log('   ✅ Ventas, turnos, egresos y mesas liberadas.');
    }

    // 3. Limpieza y recarga de catálogo de productos
    if (options.mode === 'all' || options.mode === 'products-only') {
      console.log('🧹 Limpiando catálogo de productos previo...');
      db.exec(`
        DELETE FROM ProductModifier;
        DELETE FROM ProductVariant;
        DELETE FROM Product;
        DELETE FROM Category WHERE name != 'Sin categoría';
      `);

      if (existsSync(options.catalogFile)) {
        console.log(`📦 Cargando catálogo limpio desde "${options.catalogFile}"...`);
        const catalogRaw = readFileSync(options.catalogFile, 'utf-8');
        const catalog = JSON.parse(catalogRaw);

        // A. Categorías
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

        // B. Productos y Variantes
        const insertProd = db.prepare(`
          INSERT INTO Product (id, sku, name, description, price, cost, stock, categoryId, department, isRawMaterial, active, createdAt, updatedAt, imageUrl)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertVariant = db.prepare(`
          INSERT INTO ProductVariant (id, productId, name, sku, price, cost, stock, active, createdAt, updatedAt)
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

        console.log(`   ✅ ${prodsCount} productos y ${varsCount} variantes importados exitosamente.`);
      } else {
        console.warn(`⚠️ No se encontró el archivo de catálogo en "${options.catalogFile}". Los productos no fueron recargados.`);
      }
    }

    // 4. Asegurar usuarios por defecto si no existen
    const userCount = (db.query('SELECT count(*) as count FROM User').get() as any)?.count || 0;
    if (userCount === 0) {
      console.log('👤 Creando usuarios base del sistema...');
      const adminPinHash = await Bun.password.hash('1234');
      const cashierPinHash = await Bun.password.hash('0000');
      db.prepare(`
        INSERT INTO User (id, username, passwordHash, name, role, active, createdAt, updatedAt)
        VALUES (?, 'admin', ?, 'Admin Natural', 'ADMIN', 1, ?, ?),
               (?, 'cajero', ?, 'Cajero Café', 'CASHIER', 1, ?, ?)
      `).run(crypto.randomUUID(), adminPinHash, now, now, crypto.randomUUID(), cashierPinHash, now, now);
      console.log('   ✅ Usuarios creados: admin (PIN 1234) y cajero (PIN 0000).');
    }

    // 5. Asegurar mesas por defecto si no existen
    const tableCount = (db.query('SELECT count(*) as count FROM CafeTable').get() as any)?.count || 0;
    if (tableCount === 0) {
      console.log('🪑 Creando distribución base de mesas...');
      const insertTable = db.prepare(`
        INSERT INTO CafeTable (id, name, status, x, y, createdAt, updatedAt)
        VALUES (?, ?, 'AVAILABLE', ?, ?, ?, ?)
      `);
      for (let i = 0; i < 8; i++) {
        const row = Math.floor(i / 4);
        const col = i % 4;
        insertTable.run(crypto.randomUUID(), `Mesa ${i + 1}`, 20 + col * 20, 30 + row * 25, now, now);
      }
      console.log('   ✅ 8 mesas creadas y disponibles.');
    }

    // 6. Verificar integridad
    db.exec('PRAGMA foreign_keys = ON;');
    const integrity = db.query('PRAGMA foreign_key_check;').all();
    if (integrity.length > 0) {
      console.warn('⚠️ Advertencia: anomalías detectadas en llaves foráneas:', integrity);
    } else {
      console.log('✅ Integridad referencial verificada.');
    }

    // 7. Resumen de estado actual
    const currentCounts = {
      users: (db.query('SELECT count(*) as c FROM User').get() as any)?.c,
      categories: (db.query('SELECT count(*) as c FROM Category').get() as any)?.c,
      products: (db.query('SELECT count(*) as c FROM Product').get() as any)?.c,
      variants: (db.query('SELECT count(*) as c FROM ProductVariant').get() as any)?.c,
      sales: (db.query('SELECT count(*) as c FROM Sale').get() as any)?.c,
      shifts: (db.query('SELECT count(*) as c FROM Shift').get() as any)?.c,
      tables: (db.query('SELECT count(*) as c FROM CafeTable').get() as any)?.c,
    };

    console.log('\n==================================================================');
    console.log('🎉 BASE DE DATOS LISTA PARA PRODUCCIÓN');
    console.log('==================================================================');
    console.table([
      { Entidad: 'Usuarios', Cantidad: currentCounts.users },
      { Entidad: 'Categorías', Cantidad: currentCounts.categories },
      { Entidad: 'Productos Base', Cantidad: currentCounts.products },
      { Entidad: 'Variantes', Cantidad: currentCounts.variants },
      { Entidad: 'Mesas', Cantidad: currentCounts.tables },
      { Entidad: 'Ventas Históricas', Cantidad: currentCounts.sales },
      { Entidad: 'Turnos', Cantidad: currentCounts.shifts },
    ]);
    console.log('🔑 Credenciales por Defecto:');
    console.log('   Admin:  usuario "admin",  PIN 1234');
    console.log('   Cajero: usuario "cajero", PIN 0000');
    console.log('==================================================================\n');
  } finally {
    db.close();
  }
}

if (import.meta.main) {
  cleanDatabase().catch((err) => {
    console.error('❌ Error durante la limpieza:', err);
    process.exit(1);
  });
}
