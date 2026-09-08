import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { EMBEDDED_MIGRATIONS } from './generated/migrations';

export async function runAutoMigrations(dbPath: string = './prisma/dev.db') {
  console.log('🔍 Verificando estado de la base de datos y migraciones...');

  const dbDir = dirname(dbPath);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(dbPath);

  try {
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');

    // 1. Ensure _prisma_migrations table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id"                    TEXT PRIMARY KEY NOT NULL,
        "checksum"              TEXT NOT NULL,
        "finished_at"           DATETIME,
        "migration_name"        TEXT NOT NULL,
        "logs"                  TEXT,
        "rolled_back_at"        DATETIME,
        "started_at"            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "applied_steps_count"   INTEGER NOT NULL DEFAULT 0
      );
    `);

    // 2. Fetch already applied migrations
    const appliedRows = db.query(`
      SELECT migration_name FROM "_prisma_migrations" WHERE rolled_back_at IS NULL
    `).all() as Array<{ migration_name: string }>;

    const appliedSet = new Set(appliedRows.map((r) => r.migration_name));

    // 3. Baseline Check: If _prisma_migrations is empty, check if tables already exist
    if (appliedSet.size === 0) {
      const userTableExists = db.query(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='User'
      `).get();

      if (userTableExists) {
        console.log('ℹ️ Base de datos existente detectada sin historial de migraciones. Estableciendo línea base (baseline)...');

        // Check features to mark migrations appropriately
        const cafeTableExists = db.query(`
          SELECT name FROM sqlite_master WHERE type='table' AND name='CafeTable'
        `).get();

        let cafeTableHasCoordinates = false;
        if (cafeTableExists) {
          const tableInfo = db.query(`PRAGMA table_info('CafeTable')`).all() as Array<{ name: string }>;
          cafeTableHasCoordinates = tableInfo.some((col) => col.name === 'x');
        }

        const baselineMigrations: string[] = ['20260703201908_init'];
        if (cafeTableExists) {
          baselineMigrations.push('20260703205317_add_tables_feature');
          baselineMigrations.push('20260704045120_optimize_schema');
        }
        if (cafeTableHasCoordinates) {
          baselineMigrations.push('20260704051037_add_table_coordinates');
        }

        const insertBaseline = db.prepare(`
          INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
          VALUES (?, '', CURRENT_TIMESTAMP, ?, NULL, NULL, CURRENT_TIMESTAMP, 1)
        `);

        for (const mName of baselineMigrations) {
          insertBaseline.run(crypto.randomUUID(), mName);
          appliedSet.add(mName);
          console.log(`  🏷️ Marcada como aplicada en línea base: ${mName}`);
        }
      }
    }

    // 4. Run pending migrations in chronological order
    let migrationsAppliedCount = 0;
    for (const migration of EMBEDDED_MIGRATIONS) {
      if (appliedSet.has(migration.name)) {
        continue;
      }

      console.log(`⚡ Aplicando migración pendiente: ${migration.name}...`);
      const migrationId = crypto.randomUUID();

      db.transaction(() => {
        // Record start
        db.prepare(`
          INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, applied_steps_count)
          VALUES (?, '', ?, CURRENT_TIMESTAMP, 0)
        `).run(migrationId, migration.name);

        // Execute SQL
        db.exec(migration.sql);

        // Record finish
        db.prepare(`
          UPDATE "_prisma_migrations"
          SET finished_at = CURRENT_TIMESTAMP, applied_steps_count = 1
          WHERE id = ?
        `).run(migrationId);
      })();

      appliedSet.add(migration.name);
      migrationsAppliedCount++;
      console.log(`✅ Migración ${migration.name} completada con éxito.`);
    }

    if (migrationsAppliedCount === 0) {
      console.log('✨ La base de datos ya está al día con todas las migraciones.');
    } else {
      console.log(`🎉 Se aplicaron ${migrationsAppliedCount} migraciones correctamente.`);
    }

    // 5. Check if fresh database needs default seed data
    await checkAndSeedFreshDatabase(db);
  } finally {
    db.close();
  }
}

async function checkAndSeedFreshDatabase(db: Database) {
  try {
    const userRow = db.query(`SELECT COUNT(*) as count FROM "User"`).get() as { count: number } | null;
    if (!userRow || userRow.count > 0) {
      return;
    }

    console.log('🌱 Inicializando datos base para nueva instalación...');

    const adminPinHash = await Bun.password.hash('1234');
    const cashierPinHash = await Bun.password.hash('0000');
    const now = new Date().toISOString();

    const adminId = crypto.randomUUID();
    const cashierId = crypto.randomUUID();

    db.transaction(() => {
      // 1. Default Users
      db.prepare(`
        INSERT INTO "User" (id, username, passwordHash, name, role, active, createdAt, updatedAt)
        VALUES (?, 'admin', ?, 'Admin Natural', 'ADMIN', 1, ?, ?),
               (?, 'cajero', ?, 'Cajero Café', 'CASHIER', 1, ?, ?)
      `).run(adminId, adminPinHash, now, now, cashierId, cashierPinHash, now, now);

      // 2. Default Categories
      const catSuppId = crypto.randomUUID();
      const catBebId = crypto.randomUUID();
      const catSnkId = crypto.randomUUID();
      const catPanId = crypto.randomUUID();

      db.prepare(`
        INSERT INTO "Category" (id, name, description, createdAt, updatedAt)
        VALUES (?, 'Suplementos', 'Proteínas, creatinas y colágenos', ?, ?),
               (?, 'Bebidas', 'Cafés, tés, jugos y bebidas embotelladas', ?, ?),
               (?, 'Snacks', 'Barras saludables, frutos secos y chocolates', ?, ?),
               (?, 'Panadería', 'Panes, galletas y repostería saludable', ?, ?)
      `).run(catSuppId, now, now, catBebId, now, now, catSnkId, now, now, catPanId, now, now);

      // 3. Default Products
      const insertProduct = db.prepare(`
        INSERT INTO "Product" (id, sku, name, description, price, cost, stock, categoryId, department, isRawMaterial, active, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `);

      insertProduct.run(crypto.randomUUID(), '7701234567890', 'Proteína Vegana Vainilla 1kg', 'Proteína aislada de arveja y arroz', 95000, 60000, 15, catSuppId, 'MARKET', 1, now, now);
      insertProduct.run(crypto.randomUUID(), '7701234567891', 'Creatina Monohidratada 300g', 'Creatina micronizada pura', 85000, 50000, 20, catSuppId, 'MARKET', 0, now, now);
      insertProduct.run(crypto.randomUUID(), '7701234567892', 'Leche de Almendras 1L (Suministro)', 'Bebida de almendras sin azúcar añadida', 9000, 5000, 24, catBebId, 'MARKET', 1, now, now);
      insertProduct.run(crypto.randomUUID(), 'CAFE-001', 'Café Latte de Almendras (Pág)', 'Espresso con leche de almendras espumada', 7500, 1500, 999, catBebId, 'CAFE', 0, now, now);
      insertProduct.run(crypto.randomUUID(), 'CAFE-002', 'Espresso Doble', 'Extracción doble de café de especialidad', 5000, 800, 999, catBebId, 'CAFE', 0, now, now);
      insertProduct.run(crypto.randomUUID(), '7701234567893', 'Chocolate Orgánico 80% Cacao', 'Barra de chocolate oscuro orgánico', 6500, 3200, 50, catSnkId, 'MARKET', 0, now, now);
      insertProduct.run(crypto.randomUUID(), 'CAFE-003', 'Galleta de Avena y Arándanos', 'Galleta horneada sin gluten ni azúcar refinada', 3500, 1200, 30, catPanId, 'CAFE', 0, now, now);
      insertProduct.run(crypto.randomUUID(), 'CAFE-004', 'Torta de Banano y Nueces (Porción)', 'Porción de torta saludable de banano', 5500, 1800, 12, catPanId, 'CAFE', 0, now, now);

      // 4. Default Tables
      const insertTable = db.prepare(`
        INSERT INTO "CafeTable" (id, name, status, x, y, createdAt, updatedAt)
        VALUES (?, ?, 'AVAILABLE', ?, ?, ?, ?)
      `);

      for (let i = 0; i < 8; i++) {
        const row = Math.floor(i / 4);
        const col = i % 4;
        insertTable.run(crypto.randomUUID(), `Mesa ${i + 1}`, 20 + col * 20, 30 + row * 25, now, now);
      }
    })();

    console.log('✅ Datos iniciales creados exitosamente (Admin PIN: 1234, Cajero PIN: 0000).');
  } catch (err) {
    console.error('⚠️ Error al verificar/crear datos de inicialización:', err);
  }
}
