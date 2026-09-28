/**
 * Script de Limpieza de Base de Datos - Naturale POS
 * 
 * Diseñado para ejecutarse de forma independiente para limpiar el historial
 * de transacciones (ventas, pagos, turnos, egresos y traslados) y dejar las mesas
 * disponibles, CONSERVANDO el catálogo de productos y categorías intacto.
 * 
 * Uso:
 *   bun scripts/clean-database.ts [opciones]
 *   o bien: clean-database.exe [opciones]
 * 
 * Opciones:
 *   --hard-reset       (Opcional) Elimina también productos y categorías (base de datos en blanco).
 *   --db <path>        Ruta a la base de datos SQLite (por defecto: ./prisma/dev.db).
 *   --no-backup        Omite la creación automática del archivo de respaldo .bak.
 *   --help, -h         Muestra este mensaje de ayuda.
 */

import { Database } from 'bun:sqlite';
import { existsSync, copyFileSync } from 'fs';
import { join } from 'path';

interface CleanOptions {
  targetDb: string;
  hardReset: boolean;
  noBackup: boolean;
  help: boolean;
}

function parseArgs(): CleanOptions {
  const args = process.argv.slice(2);
  const options: CleanOptions = {
    targetDb: join(process.cwd(), 'prisma', 'dev.db'),
    hardReset: false,
    noBackup: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--hard-reset' || arg === '--all') options.hardReset = true;
    else if (arg === '--no-backup') options.noBackup = true;
    else if (arg === '--db' && args[i + 1]) options.targetDb = args[++i];
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
  --hard-reset           (Opcional) Elimina también los productos y categorías (reseteo total en blanco).
                         Para recargar el catálogo use: bun scripts/populate-catalog.ts
  --db <path>            Ruta a la base de datos (por defecto: ./prisma/dev.db).
  --no-backup            Omite la creación automática del archivo de respaldo .bak.
  --help, -h             Muestra este mensaje de ayuda.
`);
    return;
  }

  console.log('==================================================================');
  console.log('🧹 LIMPIADOR DE BASE DE DATOS - NATURALE POS');
  console.log('==================================================================');
  console.log(`💾 Base de datos:  ${options.targetDb}`);
  console.log(`⚙️  Modo:           ${options.hardReset ? 'HARD RESET (Ventas + Catálogo)' : 'LIMPIEZA TRANSACCIONAL (Conserva catálogo)'}`);
  console.log('------------------------------------------------------------------\n');

  if (!existsSync(options.targetDb)) {
    console.log(`ℹ️ La base de datos "${options.targetDb}" no existe todavía.`);
    console.log('   Se inicializará automáticamente al arrancar Naturale POS.');
    return;
  }

  // 1. Respaldo de seguridad preventivo
  if (!options.noBackup) {
    const backupPath = `${options.targetDb}.bak.${Date.now()}`;
    copyFileSync(options.targetDb, backupPath);
    console.log(`🛡️  Respaldo de seguridad creado: ${backupPath}`);
  }

  const db = new Database(options.targetDb);
  db.exec('PRAGMA foreign_keys = OFF;');

  try {
    const now = new Date().toISOString();

    // 2. Limpieza de transacciones (Ventas, Turnos, Gastos, Traslados)
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
    console.log('   ✅ Ventas, pagos, turnos, egresos y mesas liberadas.');

    // 3. Hard reset opcional (sólo si se solicita expresamente)
    if (options.hardReset) {
      console.log('🧹 Vaciando catálogo de productos y categorías (--hard-reset)...');
      db.exec(`
        DELETE FROM ProductModifier;
        DELETE FROM ProductVariant;
        DELETE FROM Product;
        DELETE FROM Category WHERE name != 'Sin categoría';
      `);
      console.log('   ✅ Productos y categorías eliminados.');
      console.log('   💡 Para volver a poblar el catálogo de Odoo, ejecuta: bun scripts/populate-catalog.ts');
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
    console.log('🎉 BASE DE DATOS LIMPIA Y LISTA PARA OPERAR');
    console.log('==================================================================');
    console.table([
      { Entidad: 'Usuarios', Cantidad: currentCounts.users },
      { Entidad: 'Categorías (Conservadas)', Cantidad: currentCounts.categories },
      { Entidad: 'Productos Base (Conservados)', Cantidad: currentCounts.products },
      { Entidad: 'Variantes (Conservadas)', Cantidad: currentCounts.variants },
      { Entidad: 'Mesas Disponibles', Cantidad: currentCounts.tables },
      { Entidad: 'Ventas Históricas', Cantidad: currentCounts.sales },
      { Entidad: 'Turnos Activos', Cantidad: currentCounts.shifts },
    ]);
    console.log('🔑 Credenciales de Acceso:');
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
