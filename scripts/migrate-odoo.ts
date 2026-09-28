/**
 * Script de Migración de Odoo a Naturale POS
 * 
 * Extrae y migra de forma integral:
 * - Usuarios (cajeros y administradores con PIN de acceso)
 * - Categorías de productos (Mercado y Café)
 * - Mesas del Café y Mercado con sus coordenadas
 * - Productos y Variantes (precios, costos, stock, SKUs)
 * - Turnos de caja (Shifts / Pos Sessions) con arqueo y totales
 * - Ventas históricas (Sales / Pos Orders)
 * - Ítems de venta (Sale Items)
 * - Pagos por método (Efectivo, Tarjeta, Transferencia)
 * - Egresos de caja (Expenses / Cash Outs)
 * - Estado activo de mesas y pedidos abiertos
 */

import { Database } from 'bun:sqlite';
import { existsSync, copyFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';

interface MigrationOptions {
  sourceDir: string;
  targetDb: string;
  postgresUrl: string;
  clean: boolean;
  dryRun: boolean;
  keepContainer: boolean;
}

const parseArgs = (): MigrationOptions => {
  const args = process.argv.slice(2);
  const options: MigrationOptions = {
    sourceDir: '/tmp/Copia Seguridad Odoo',
    targetDb: './prisma/dev.db',
    postgresUrl: process.env.ODOO_PG_URL || 'postgres://naturale@localhost:5433/naturale',
    clean: false,
    dryRun: false,
    keepContainer: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--clean') options.clean = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--keep-container') options.keepContainer = true;
    else if (arg === '--source' && args[i + 1]) options.sourceDir = args[++i];
    else if (arg === '--target-db' && args[i + 1]) options.targetDb = args[++i];
    else if (arg === '--postgres-url' && args[i + 1]) options.postgresUrl = args[++i];
    else if (arg === '--help' || arg === '-h') {
      console.log(`
Uso: bun scripts/migrate-odoo.ts [opciones]

Opciones:
  --clean            Limpia datos de prueba previos en la base SQLite (con respaldo previo automático)
  --dry-run          Ejecuta la extracción y validación sin modificar la base SQLite
  --source <dir>     Ruta al directorio de datos Postgres de Odoo (por defecto: /tmp/Copia Seguridad Odoo)
  --target-db <path> Ruta a la base SQLite de destino (por defecto: ./prisma/dev.db)
  --postgres-url <u> URL de conexión a Postgres (por defecto: postgres://naturale@localhost:5433/naturale)
  --keep-container   No detiene el contenedor Docker al finalizar
  --help, -h         Muestra este mensaje de ayuda
`);
      process.exit(0);
    }
  }

  return options;
};

// Categorías que pertenecen al departamento de Café
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

async function checkPostgresConnection(url: string): Promise<boolean> {
  try {
    const sql = new Bun.sql({ url });
    await sql`SELECT 1`;
    await sql.close();
    return true;
  } catch {
    return false;
  }
}

async function ensurePostgresRunning(options: MigrationOptions): Promise<{ startedContainer: boolean; stopContainer: () => void }> {
  // 1. Probar URL configurada
  if (await checkPostgresConnection(options.postgresUrl)) {
    console.log(`🔌 Conectado a PostgreSQL existente en: ${options.postgresUrl}`);
    return { startedContainer: false, stopContainer: () => {} };
  }

  // 2. Probar puerto 5432
  const fallbackUrl = 'postgres://naturale@localhost:5432/naturale';
  if (await checkPostgresConnection(fallbackUrl)) {
    console.log(`🔌 Conectado a PostgreSQL existente en: ${fallbackUrl}`);
    options.postgresUrl = fallbackUrl;
    return { startedContainer: false, stopContainer: () => {} };
  }

  // 3. Levantar contenedor temporal Docker
  console.log(`🐳 Iniciando PostgreSQL 12 en Docker desde "${options.sourceDir}"...`);
  if (!existsSync(options.sourceDir)) {
    throw new Error(`El directorio origen "${options.sourceDir}" no existe.`);
  }

  const containerName = 'odoo-pg-migrator';
  const workDir = '/tmp/odoo_pgdata_runtime';

  try {
    execSync(`docker rm -f ${containerName} 2>/dev/null || true`);
    if (!existsSync(workDir)) {
      console.log(`📦 Creando copia de trabajo en ${workDir}...`);
      try {
        execSync(`docker run --rm --user 0 -v /tmp:/tmp alpine rm -rf ${workDir} 2>/dev/null || true`);
      } catch {}
      execSync(`cp -a "${options.sourceDir}" ${workDir}`);
    }

    // Limpiar archivos de bloqueo de Windows y ajustar config usando Docker con permisos root
    try {
      execSync(`docker run --rm --user 0 -v ${workDir}:/data alpine rm -f /data/postmaster.pid 2>/dev/null || true`);
      execSync(`docker run --rm --user 0 -v ${workDir}:/data alpine chmod -R 777 /data 2>/dev/null || true`);
    } catch {}

    // Modificar postgresql.conf para compatibilidad con Linux
    try {
      execSync(`docker run --rm --user 0 -v ${workDir}:/data postgres:12 bash -c "
        sed -i 's/dynamic_shared_memory_type = windows/dynamic_shared_memory_type = posix/g' /data/postgresql.conf
        sed -i 's/^lc_/#lc_/g' /data/postgresql.conf
        sed -i \\"s/'#lc_/#lc_/g\\" /data/postgresql.conf
        echo 'host all all all trust' > /data/pg_hba.conf
        echo 'local all all trust' >> /data/pg_hba.conf
      "`);
    } catch (e: any) {
      console.warn('Aviso al ajustar configuración:', e.message);
    }

    // Verificar si la imagen preconfigurada odoo-pg-compat:12 está disponible
    let imageName = 'postgres:12';
    try {
      const imagesOutput = execSync('docker images -q odoo-pg-compat:12').toString().trim();
      if (imagesOutput) {
        imageName = 'odoo-pg-compat:12';
      }
    } catch {}

    // Iniciar contenedor
    execSync(`docker run -d --name ${containerName} -v ${workDir}:/var/lib/postgresql/data -p 5433:5432 ${imageName}`);
    console.log('⏳ Esperando inicio de PostgreSQL...');

    if (imageName === 'postgres:12') {
      console.log('🌐 Configurando soporte de locale Windows Spanish_Colombia.1252 en Debian...');
      try {
        execSync(`docker exec -u 0 ${containerName} bash -c "
          apt-get update && apt-get install -y locales &&
          localedef -c -i es_CO -f CP1252 'Spanish_Colombia.1252' &&
          echo 'Spanish_Colombia.1252 Spanish_Colombia.iso1252' >> /etc/locale.alias &&
          echo 'Spanish_Colombia.1252 Spanish_Colombia.iso1252' >> /usr/share/locale/locale.alias &&
          localedef --no-archive -c -i es_CO -f CP1252 /usr/lib/locale/Spanish_Colombia.1252
        "`);
        execSync(`docker restart ${containerName}`);
      } catch (e: any) {
        console.warn('Aviso en configuración de locale:', e.message);
      }
    }

    options.postgresUrl = 'postgres://naturale@localhost:5433/naturale';

    // Esperar conexión con reintentos
    let connected = false;
    for (let retry = 0; retry < 15; retry++) {
      await Bun.sleep(1000);
      if (await checkPostgresConnection(options.postgresUrl)) {
        connected = true;
        break;
      }
    }

    if (!connected) {
      throw new Error('No se pudo establecer conexión con PostgreSQL en el contenedor Docker.');
    }

    console.log('✅ PostgreSQL 12 activo y conectado.');

    return {
      startedContainer: true,
      stopContainer: () => {
        if (!options.keepContainer) {
          console.log('🧹 Deteniendo contenedor temporal...');
          execSync(`docker rm -f ${containerName} 2>/dev/null || true`);
        }
      }
    };
  } catch (error: any) {
    throw new Error(`Fallo al iniciar PostgreSQL con Docker: ${error.message}`);
  }
}

export async function runMigration(customOptions?: Partial<MigrationOptions>) {
  const options: MigrationOptions = { ...parseArgs(), ...customOptions };

  console.log('==================================================================');
  console.log('🚀 INICIANDO MIGRACIÓN DE DATOS ODOO -> NATURALE POS');
  console.log('==================================================================');
  console.log(`📁 Origen PGDATA:     ${options.sourceDir}`);
  console.log(`💾 Destino SQLite:    ${options.targetDb}`);
  console.log(`🧹 Modo Clean:        ${options.clean ? 'SÍ (reinicia datos)' : 'NO (conserva/fusiona)'}`);
  console.log(`🧪 Modo Dry-Run:      ${options.dryRun ? 'SÍ (sin escritura)' : 'NO'}`);
  console.log('------------------------------------------------------------------\n');

  // Respaldo de seguridad previo
  if (existsSync(options.targetDb) && !options.dryRun) {
    const backupPath = `${options.targetDb}.bak.${Date.now()}`;
    copyFileSync(options.targetDb, backupPath);
    console.log(`🛡️  Respaldo de SQLite creado: ${backupPath}`);
  }

  const { startedContainer, stopContainer } = await ensurePostgresRunning(options);

  const pg = new Bun.sql({ url: options.postgresUrl });
  let sqlite: Database | null = null;

  try {
    // -------------------------------------------------------------------------
    // 1. EXTRACCIÓN DE DATOS DE ODOO (POSTGRESQL)
    // -------------------------------------------------------------------------
    console.log('\n📥 1/7 Extrayendo Usuarios...');
    const odooUsers = await pg`
      SELECT u.id, u.login, coalesce(p.name, u.login) as name, u.active 
      FROM res_users u 
      LEFT JOIN res_partner p ON u.partner_id = p.id
      WHERE u.login NOT IN ('__system__', 'public', 'portaltemplate')
      ORDER BY u.id
    `;
    console.log(`   -> ${odooUsers.length} usuarios encontrados.`);

    console.log('📥 2/7 Extrayendo Categorías...');
    const odooCategories = await pg`
      SELECT id, name FROM product_category ORDER BY id
    `;
    console.log(`   -> ${odooCategories.length} categorías encontradas.`);

    console.log('📥 3/7 Extrayendo Mesas...');
    const odooTables = await pg`
      SELECT rt.id, rt.table_number, rf.name as floor_name, rt.position_h, rt.position_v, rt.active
      FROM restaurant_table rt
      JOIN restaurant_floor rf ON rt.floor_id = rf.id
      WHERE rt.active = true
      ORDER BY rf.id, rt.table_number
    `;
    console.log(`   -> ${odooTables.length} mesas activas encontradas.`);

    console.log('📥 4/7 Extrayendo Productos, Variantes y Stock...');
    // Consultar stock de existencias internas (location_id = 5)
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

    // Variantes con nombres descriptivos según atributos
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

    // Todos los productos y templates
    const odooProducts = await pg`
      SELECT 
        pp.id as product_id,
        pp.barcode,
        pp.default_code as variant_code,
        pp.standard_price as variant_cost_json,
        pp.active as variant_active,
        pt.id as tmpl_id,
        pt.name as tmpl_name_json,
        pt.description as tmpl_desc_json,
        pt.default_code as tmpl_code,
        pt.list_price as tmpl_price,
        pt.categ_id,
        pt.active as tmpl_active
      FROM product_product pp
      JOIN product_template pt ON pp.product_tmpl_id = pt.id
      ORDER BY pt.id, pp.id
    `;
    console.log(`   -> ${odooProducts.length} productos/variantes extraídos.`);

    console.log('📥 5/7 Extrayendo Turnos de Caja (Shifts)...');
    const odooShifts = await pg`
      SELECT id, user_id, state, cash_register_balance_start, cash_register_balance_end_real,
             cash_real_transaction, start_at, stop_at, create_date, opening_notes, closing_notes
      FROM pos_session
      ORDER BY id
    `;
    console.log(`   -> ${odooShifts.length} turnos encontrados.`);

    console.log('📥 6/7 Extrayendo Ventas y Detalle de Productos...');
    const odooOrders = await pg`
      SELECT id, user_id, session_id, table_id, state, date_order, create_date, write_date,
             amount_total, pos_reference, cashier
      FROM pos_order
      ORDER BY id
    `;

    const odooLines = await pg`
      SELECT id, order_id, product_id, qty, price_unit, customer_note, note
      FROM pos_order_line
      ORDER BY order_id, id
    `;

    const odooPayments = await pg`
      SELECT pos_order_id, payment_method_id, sum(amount) as net_amount, min(payment_date) as pay_date
      FROM pos_payment
      GROUP BY pos_order_id, payment_method_id
      HAVING sum(amount) > 0
    `;
    console.log(`   -> ${odooOrders.length} ventas, ${odooLines.length} ítems, ${odooPayments.length} pagos.`);

    console.log('📥 7/7 Extrayendo Egresos de Caja...');
    const odooExpenses = await pg`
      SELECT id, pos_session_id, payment_ref, abs(amount) as amount, create_date
      FROM account_bank_statement_line
      WHERE pos_session_id IS NOT NULL AND amount < 0 AND payment_ref LIKE '%-out-%'
      ORDER BY id
    `;
    console.log(`   -> ${odooExpenses.length} egresos de turno encontrados.`);

    if (options.dryRun) {
      console.log('\n🧪 [DRY-RUN] Extracción completada exitosamente sin modificar la base SQLite.');
      return;
    }

    // -------------------------------------------------------------------------
    // 2. TRANSFORMACIÓN Y CARGA EN SQLITE
    // -------------------------------------------------------------------------
    sqlite = new Database(options.targetDb);
    sqlite.exec('PRAGMA foreign_keys = OFF;');

    console.log('\n⚙️  Transformando y migrando datos hacia SQLite...');

    // Limpieza de datos si se solicitó
    if (options.clean) {
      console.log('🧹 Limpiando datos previos en SQLite...');
      sqlite.exec(`
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
        DELETE FROM Category;
        DELETE FROM CafeTable;
      `);
    }

    // -------------------------------------------------------------------------
    // A. Mapeo y Guardado de Usuarios
    // -------------------------------------------------------------------------
    const defaultPasswordHash = await Bun.password.hash('1234');
    const userMap = new Map<number, string>(); // odoo_user_id -> sqlite_user_id

    // Asegurar usuario admin y cajero base
    const existingUsers = sqlite.query('SELECT id, username FROM User').all() as Array<{ id: string; username: string }>;
    const usernameToId = new Map<string, string>();
    for (const u of existingUsers) usernameToId.set(u.username, u.id);

    const insertUserStmt = sqlite.prepare(`
      INSERT INTO User (id, username, passwordHash, name, role, active, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const updateUserStmt = sqlite.prepare(`
      UPDATE User SET name = ?, active = ?, updatedAt = ? WHERE id = ?
    `);

    // Mapeo específico para usuarios reales de Naturale
    const userRoleMapping: Record<number, { username: string; role: 'ADMIN' | 'CASHIER' }> = {
      2: { username: 'maria', role: 'ADMIN' },      // Naturale / Maria Villegas
      5: { username: 'sarah', role: 'CASHIER' },    // Sarah Victoria
      6: { username: 'manuela', role: 'CASHIER' },  // Manuela
      10: { username: 'manuela2', role: 'CASHIER' },
      13: { username: 'lina', role: 'CASHIER' },    // Lina Valencia
      7: { username: 'sandra', role: 'CASHIER' },   // Sandra
    };

    for (const u of odooUsers) {
      const odooId = Number(u.id);
      const conf = userRoleMapping[odooId] || {
        username: (u.login || `user_${odooId}`).toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20),
        role: 'CASHIER' as const,
      };

      let userId = usernameToId.get(conf.username);
      const now = new Date().toISOString();

      if (!userId) {
        userId = crypto.randomUUID();
        insertUserStmt.run(
          userId,
          conf.username,
          defaultPasswordHash,
          String(u.name || conf.username),
          conf.role,
          u.active ? 1 : 0,
          now,
          now
        );
        usernameToId.set(conf.username, userId);
      } else {
        updateUserStmt.run(String(u.name || conf.username), u.active ? 1 : 0, now, userId);
      }
      userMap.set(odooId, userId);
    }

    // Usuario fallback (admin)
    const adminFallbackId = usernameToId.get('admin') || usernameToId.get('maria') || Array.from(userMap.values())[0];

    // -------------------------------------------------------------------------
    // B. Mapeo y Guardado de Categorías
    // -------------------------------------------------------------------------
    const categoryMap = new Map<number, string>(); // odoo_categ_id -> sqlite_category_id
    const existingCats = sqlite.query('SELECT id, name FROM Category').all() as Array<{ id: string; name: string }>;
    const catNameToId = new Map<string, string>();
    for (const c of existingCats) catNameToId.set(c.name.trim().toLowerCase(), c.id);

    const insertCatStmt = sqlite.prepare(`
      INSERT INTO Category (id, name, description, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const c of odooCategories) {
      const odooId = Number(c.id);
      let catName = String(c.name || 'General').trim();
      const normName = catName.toLowerCase();

      let catId = catNameToId.get(normName);
      if (!catId) {
        catId = crypto.randomUUID();
        const now = new Date().toISOString();
        insertCatStmt.run(catId, catName, `Categoría importada de Odoo: ${catName}`, now, now);
        catNameToId.set(normName, catId);
      }
      categoryMap.set(odooId, catId);
    }

    // -------------------------------------------------------------------------
    // C. Mapeo y Guardado de Mesas (CafeTable)
    // -------------------------------------------------------------------------
    const tableMap = new Map<number, string>(); // odoo_table_id -> sqlite_table_id
    const insertTableStmt = sqlite.prepare(`
      INSERT INTO CafeTable (id, name, status, currentSaleId, x, y, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const t of odooTables) {
      const odooId = Number(t.id);
      const isMercado = String(t.floor_name).toLowerCase().includes('mercado');
      const tableName = isMercado ? `Mercado ${t.table_number}` : `Mesa ${t.table_number}`;

      // Normalizar coordenadas a porcentaje del lienzo POS (10% a 90%)
      const x = Math.min(90, Math.max(10, Math.round(((Number(t.position_h) || 100) / 1400) * 80 + 10)));
      const y = Math.min(90, Math.max(10, Math.round(((Number(t.position_v) || 50) / 600) * 70 + 15)));

      const tableId = crypto.randomUUID();
      const now = new Date().toISOString();
      insertTableStmt.run(tableId, tableName, 'AVAILABLE', null, x, y, now, now);
      tableMap.set(odooId, tableId);
    }

    // -------------------------------------------------------------------------
    // D. Mapeo y Guardado de Productos y Variantes
    // -------------------------------------------------------------------------
    // Agrupar variantes por plantilla (product_tmpl_id)
    const tmplToVariants = new Map<number, typeof odooProducts>();
    for (const p of odooProducts) {
      const tmplId = Number(p.tmpl_id);
      if (!tmplToVariants.has(tmplId)) tmplToVariants.set(tmplId, []);
      tmplToVariants.get(tmplId)!.push(p);
    }

    const insertProdStmt = sqlite.prepare(`
      INSERT INTO Product (id, sku, name, description, price, cost, stock, categoryId, department, isRawMaterial, active, createdAt, updatedAt, imageUrl)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertVariantStmt = sqlite.prepare(`
      INSERT INTO ProductVariant (id, productId, name, sku, price, cost, stock, active, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const productMap = new Map<number, { productId: string; variantId: string | null }>();
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
      suffixed = `ODOO-${fallbackId}-${crypto.randomUUID().slice(0, 6)}`;
      usedSkus.add(suffixed);
      return suffixed;
    };

    let totalProductsCreated = 0;
    let totalVariantsCreated = 0;

    for (const [tmplId, variants] of tmplToVariants.entries()) {
      const first = variants[0];
      const tmplNameObj = typeof first.tmpl_name_json === 'object' ? first.tmpl_name_json : JSON.parse(first.tmpl_name_json || '{}');
      const tmplName = String(tmplNameObj.es_CO || tmplNameObj.en_US || Object.values(tmplNameObj)[0] || `Producto ${tmplId}`).trim();

      const categId = categoryMap.get(Number(first.categ_id)) || Array.from(categoryMap.values())[0];
      const categName = odooCategories.find(c => Number(c.id) === Number(first.categ_id))?.name?.toLowerCase() || '';
      const isCafe = CAFE_CATEGORIES.has(categName);
      const department: 'CAFE' | 'MARKET' = isCafe ? 'CAFE' : 'MARKET';

      const now = new Date().toISOString();
      const productId = crypto.randomUUID();

      if (variants.length === 1) {
        // Producto simple sin variantes
        const v = variants[0];
        const prodId = Number(v.product_id);
        const barcode = (v.barcode || '').trim();
        const defCode = (v.variant_code || v.tmpl_code || '').trim();
        const finalSku = makeUniqueSku(barcode || defCode, prodId);

        const price = Number(v.tmpl_price || 0);
        let cost = 0;
        if (v.variant_cost_json) {
          try {
            const costObj = typeof v.variant_cost_json === 'object' ? v.variant_cost_json : JSON.parse(v.variant_cost_json);
            cost = Number(Object.values(costObj)[0] || 0);
          } catch {}
        }

        // Si es de café y no tiene stock registrado, stock infinito (999)
        const recordedStock = stockMap.get(prodId);
        const stock = (isCafe && recordedStock === undefined) ? 999 : (recordedStock ?? 0);

        insertProdStmt.run(
          productId,
          finalSku,
          tmplName,
          null,
          price,
          cost,
          stock,
          categId,
          department,
          0,
          v.variant_active && v.tmpl_active ? 1 : 0,
          now,
          now,
          null
        );

        productMap.set(prodId, { productId, variantId: null });
        totalProductsCreated++;
      } else {
        // Producto con múltiples variantes
        const tmplSku = makeUniqueSku((first.tmpl_code || '').trim(), tmplId);
        const basePrice = Number(first.tmpl_price || 0);
        let totalStock = 0;

        insertProdStmt.run(
          productId,
          tmplSku,
          tmplName,
          null,
          basePrice,
          0,
          0, // se actualizará con la suma de variantes
          categId,
          department,
          0,
          first.tmpl_active ? 1 : 0,
          now,
          now,
          null
        );
        totalProductsCreated++;

        for (const v of variants) {
          const prodId = Number(v.product_id);
          const attr = variantAttrMap.get(prodId);
          const variantName = attr?.name || (v.variant_code ? String(v.variant_code) : `Opción ${prodId}`);
          const variantSku = makeUniqueSku((v.barcode || v.variant_code || '').trim(), prodId);

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

          const variantId = crypto.randomUUID();
          insertVariantStmt.run(
            variantId,
            productId,
            variantName,
            variantSku,
            variantPrice,
            cost,
            variantStock,
            v.variant_active ? 1 : 0,
            now,
            now
          );

          productMap.set(prodId, { productId, variantId });
          totalVariantsCreated++;
        }

        // Actualizar stock total en la cabecera del producto
        sqlite.prepare('UPDATE Product SET stock = ? WHERE id = ?').run(totalStock, productId);
      }
    }

    // -------------------------------------------------------------------------
    // E. Mapeo y Guardado de Turnos (Shifts)
    // -------------------------------------------------------------------------
    const shiftMap = new Map<number, string>(); // odoo_session_id -> sqlite_shift_id
    const insertShiftStmt = sqlite.prepare(`
      INSERT INTO Shift (id, userId, status, initialCash, openedAt, closedAt, closedByUserId, expectedCash, actualCash, difference, totalSales, totalCard, totalTransfer, totalInternal, totalExpenses, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const s of odooShifts) {
      const odooId = Number(s.id);
      const shiftId = crypto.randomUUID();
      const userId = userMap.get(Number(s.user_id)) || adminFallbackId;
      const isClosed = s.state === 'closed';

      const initialCash = Number(s.cash_register_balance_start || 0);
      const actualCash = s.cash_register_balance_end_real !== null ? Number(s.cash_register_balance_end_real) : null;
      const openedAt = new Date(s.start_at || s.create_date).toISOString();
      const closedAt = s.stop_at ? new Date(s.stop_at).toISOString() : null;

      const notes = [s.opening_notes, s.closing_notes].filter(Boolean).join(' | ') || null;

      insertShiftStmt.run(
        shiftId,
        userId,
        isClosed ? 'CLOSED' : 'OPEN',
        initialCash,
        openedAt,
        closedAt,
        isClosed ? userId : null,
        actualCash, // se ajustará con totales calculados
        actualCash,
        0,
        0, 0, 0, 0, 0,
        notes
      );

      shiftMap.set(odooId, shiftId);
    }

    // -------------------------------------------------------------------------
    // F. Mapeo y Guardado de Ventas (Sales, Items, Payments)
    // -------------------------------------------------------------------------
    const saleMap = new Map<number, string>(); // odoo_order_id -> sqlite_sale_id
    const insertSaleStmt = sqlite.prepare(`
      INSERT INTO Sale (id, userId, total, status, createdAt, updatedAt, tableId, shiftId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let draftSaleForTable: { tableId: string; saleId: string } | null = null;

    for (const o of odooOrders) {
      const odooId = Number(o.id);
      const saleId = crypto.randomUUID();
      const userId = userMap.get(Number(o.user_id)) || adminFallbackId;
      const shiftId = o.session_id ? shiftMap.get(Number(o.session_id)) || null : null;
      const tableId = o.table_id ? tableMap.get(Number(o.table_id)) || null : null;

      let status: 'COMPLETED' | 'CANCELLED' | 'OPEN' = 'COMPLETED';
      if (o.state === 'cancel') status = 'CANCELLED';
      else if (o.state === 'draft') status = 'OPEN';

      const total = Number(o.amount_total || 0);
      const createdAt = new Date(o.date_order || o.create_date).toISOString();
      const updatedAt = new Date(o.write_date || o.date_order || o.create_date).toISOString();

      insertSaleStmt.run(saleId, userId, total, status, createdAt, updatedAt, tableId, shiftId);
      saleMap.set(odooId, saleId);

      if (status === 'OPEN' && tableId) {
        draftSaleForTable = { tableId, saleId };
      }
    }

    // Ítems de venta
    const insertItemStmt = sqlite.prepare(`
      INSERT INTO SaleItem (id, saleId, productId, quantity, price, variantId, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    let totalItemsMigrated = 0;
    for (const line of odooLines) {
      const saleId = saleMap.get(Number(line.order_id));
      const targetProd = productMap.get(Number(line.product_id));
      if (!saleId || !targetProd) continue;

      const qty = Math.max(1, Math.round(Number(line.qty || 1)));
      const price = Number(line.price_unit || 0);
      const note = line.customer_note || line.note || null;

      insertItemStmt.run(
        crypto.randomUUID(),
        saleId,
        targetProd.productId,
        qty,
        price,
        targetProd.variantId,
        note
      );
      totalItemsMigrated++;
    }

    // Pagos
    const insertPaymentStmt = sqlite.prepare(`
      INSERT INTO SalePayment (id, saleId, method, amount, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `);

    let totalPaymentsMigrated = 0;
    for (const p of odooPayments) {
      const saleId = saleMap.get(Number(p.pos_order_id));
      if (!saleId) continue;

      const methodId = Number(p.payment_method_id);
      let method: 'CASH' | 'CARD' | 'TRANSFER' | 'INTERNAL' = 'CASH';
      if (methodId === 2) method = 'CARD';
      else if (methodId === 3) method = 'TRANSFER';
      else if (methodId === 5) method = 'INTERNAL';

      const amount = Number(p.net_amount || 0);
      if (amount <= 0) continue;

      const createdAt = new Date(p.pay_date || Date.now()).toISOString();
      insertPaymentStmt.run(crypto.randomUUID(), saleId, method, amount, createdAt);
      totalPaymentsMigrated++;
    }

    // -------------------------------------------------------------------------
    // G. Mapeo y Guardado de Egresos de Caja (Expenses)
    // -------------------------------------------------------------------------
    const insertExpenseStmt = sqlite.prepare(`
      INSERT INTO Expense (id, description, amount, category, department, userId, date, createdAt, updatedAt, shiftId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let totalExpensesMigrated = 0;
    for (const exp of odooExpenses) {
      const shiftId = shiftMap.get(Number(exp.pos_session_id));
      const shiftRow = odooShifts.find(s => Number(s.id) === Number(exp.pos_session_id));
      const userId = shiftRow ? userMap.get(Number(shiftRow.user_id)) || adminFallbackId : adminFallbackId;

      // Limpiar texto de descripción (remover prefijos de Odoo como "Naturale/00013-out-")
      let desc = String(exp.payment_ref || 'Egreso de turno');
      const outIdx = desc.indexOf('-out-');
      if (outIdx !== -1) {
        desc = desc.substring(outIdx + 5).trim();
      }

      const amount = Number(exp.amount || 0);
      const date = new Date(exp.create_date).toISOString();

      insertExpenseStmt.run(
        crypto.randomUUID(),
        desc || 'Gasto de turno',
        amount,
        'Gastos Operativos',
        'GENERAL',
        userId,
        date,
        date,
        date,
        shiftId || null
      );
      totalExpensesMigrated++;
    }

    // -------------------------------------------------------------------------
    // H. Actualizar Totales Agregados de Cada Turno
    // -------------------------------------------------------------------------
    console.log('🔄 Calculando balance y conciliación de turnos...');
    const shiftSummaryStmt = sqlite.prepare(`
      UPDATE Shift
      SET 
        totalSales = (
          SELECT coalesce(sum(total), 0) FROM Sale 
          WHERE shiftId = Shift.id AND status = 'COMPLETED'
        ),
        totalCard = (
          SELECT coalesce(sum(sp.amount), 0) FROM SalePayment sp 
          JOIN Sale s ON sp.saleId = s.id 
          WHERE s.shiftId = Shift.id AND sp.method = 'CARD' AND s.status = 'COMPLETED'
        ),
        totalTransfer = (
          SELECT coalesce(sum(sp.amount), 0) FROM SalePayment sp 
          JOIN Sale s ON sp.saleId = s.id 
          WHERE s.shiftId = Shift.id AND sp.method = 'TRANSFER' AND s.status = 'COMPLETED'
        ),
        totalInternal = (
          SELECT coalesce(sum(sp.amount), 0) FROM SalePayment sp 
          JOIN Sale s ON sp.saleId = s.id 
          WHERE s.shiftId = Shift.id AND sp.method = 'INTERNAL' AND s.status = 'COMPLETED'
        ),
        totalExpenses = (
          SELECT coalesce(sum(amount), 0) FROM Expense 
          WHERE shiftId = Shift.id
        ),
        expectedCash = (
          initialCash + (
            SELECT coalesce(sum(sp.amount), 0) FROM SalePayment sp 
            JOIN Sale s ON sp.saleId = s.id 
            WHERE s.shiftId = Shift.id AND sp.method = 'CASH' AND s.status = 'COMPLETED'
          ) - (
            SELECT coalesce(sum(amount), 0) FROM Expense 
            WHERE shiftId = Shift.id
          )
        ),
        difference = (
          actualCash - (
            initialCash + (
              SELECT coalesce(sum(sp.amount), 0) FROM SalePayment sp 
              JOIN Sale s ON sp.saleId = s.id 
              WHERE s.shiftId = Shift.id AND sp.method = 'CASH' AND s.status = 'COMPLETED'
            ) - (
              SELECT coalesce(sum(amount), 0) FROM Expense 
              WHERE shiftId = Shift.id
            )
          )
        )
    `);
    shiftSummaryStmt.run();

    // Actualizar mesa ocupada si hay venta abierta
    if (draftSaleForTable) {
      sqlite.prepare('UPDATE CafeTable SET status = ?, currentSaleId = ? WHERE id = ?').run(
        'OCCUPIED',
        draftSaleForTable.saleId,
        draftSaleForTable.tableId
      );
    }

    // -------------------------------------------------------------------------
    // I. Verificación de Integridad Referencial
    // -------------------------------------------------------------------------
    sqlite.exec('PRAGMA foreign_keys = ON;');
    const integrityCheck = sqlite.query('PRAGMA foreign_key_check;').all();
    if (integrityCheck.length > 0) {
      console.warn('⚠️  Advertencia: se detectaron anomalías en llaves foráneas:', integrityCheck);
    } else {
      console.log('✅ Integridad referencial verificada al 100%.');
    }

    // -------------------------------------------------------------------------
    // 3. REPORTE FINAL DE MIGRACIÓN
    // -------------------------------------------------------------------------
    const totalSalesAmountRow = sqlite.query("SELECT sum(total) as sumTotal FROM Sale WHERE status = 'COMPLETED'").get() as any;
    const totalExpensesAmountRow = sqlite.query('SELECT sum(amount) as sumExp FROM Expense').get() as any;

    console.log('\n==================================================================');
    console.log('🎉 ¡MIGRACIÓN COMPLETADA CON ÉXITO!');
    console.log('==================================================================');
    console.table([
      { Entidad: 'Usuarios', Cantidad: odooUsers.length },
      { Entidad: 'Categorías', Cantidad: odooCategories.length },
      { Entidad: 'Mesas (Plano Café/Mercado)', Cantidad: odooTables.length },
      { Entidad: 'Productos Base', Cantidad: totalProductsCreated },
      { Entidad: 'Variantes de Productos', Cantidad: totalVariantsCreated },
      { Entidad: 'Turnos de Caja (Shifts)', Cantidad: odooShifts.length },
      { Entidad: 'Ventas Históricas', Cantidad: odooOrders.length },
      { Entidad: 'Ítems de Venta', Cantidad: totalItemsMigrated },
      { Entidad: 'Pagos Registrados', Cantidad: totalPaymentsMigrated },
      { Entidad: 'Egresos de Turno', Cantidad: totalExpensesMigrated },
    ]);

    const formattedSales = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(Number(totalSalesAmountRow?.sumTotal || 0));
    const formattedExp = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(Number(totalExpensesAmountRow?.sumExp || 0));

    console.log(`💰 Total Ingresos por Ventas Migradas: ${formattedSales}`);
    console.log(`💸 Total Egresos Migrados:              ${formattedExp}`);
    console.log('🔑 Credenciales de Acceso para Usuarios Migrados:');
    console.log('   PIN por Defecto: 1234 (para cajeros y administradores)');
    console.log('   Usuarios disponibles: maria, sarah, lina, manuela, sandra, admin, cajero');
    console.log('==================================================================\n');

  } finally {
    await pg.close();
    if (sqlite) sqlite.close();
    stopContainer();
  }
}

// Ejecución directa si se invoca desde CLI
if (import.meta.main) {
  runMigration().catch((err) => {
    console.error('\n❌ ERROR DURANTE LA MIGRACIÓN:', err);
    process.exit(1);
  });
}
