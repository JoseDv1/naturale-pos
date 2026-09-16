import { beforeAll, beforeEach, afterAll, expect } from 'bun:test';

// Ensure ~/.bun/bin is in PATH for child processes
if (process.env.HOME && !process.env.PATH?.includes('.bun/bin')) {
  process.env.PATH = `${process.env.HOME}/.bun/bin:${process.env.PATH}`;
}

// Generate Prisma Client if Shift model is missing in compiled class.ts
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const classPath = resolve(import.meta.dir, '../../generated/client/internal/class.ts');
let needsGenerate = true;
if (existsSync(classPath)) {
  const content = readFileSync(classPath, 'utf-8');
  if (content.includes('"Shift.findFirst"') || content.includes('"Shift.createOne"')) {
    needsGenerate = false;
  }
}

if (needsGenerate) {
  console.log('🔄 Ejecutando prisma generate...');
  const res = Bun.spawnSync(['bunx', 'prisma', 'generate'], { env: process.env });
  if (res.exitCode !== 0) {
    console.error('❌ prisma generate falló:', res.stderr?.toString());
  } else {
    console.log('✅ prisma generate completado exitosamente.');
  }

  // Also build migrations
  Bun.spawnSync(['bun', 'scripts/generate-migrations.ts'], { env: process.env });
}

// Dynamically import database and migrator to use freshly generated client
const { runAutoMigrations } = await import('../../src/migrator');
const { prisma } = await import('../../src/db');
const api = (await import('../../src/api')).default;

export { prisma, runAutoMigrations };

export interface AuthSession {
  adminCookie: string;
  adminUser: any;
  cashierCookie: string;
  cashierUser: any;
}

/**
 * Ensures the database schema is up-to-date by executing pending embedded migrations.
 * This runs automatically upon import and during Bun test preload.
 */
export async function setupTestDatabase() {
  await runAutoMigrations();
}

/**
 * Creates a test product with sensible defaults, strictly conforming to Prisma schema.
 */
export async function createTestProduct(data: any = {}) {
  await setupTestDatabase();
  let categoryId = data.categoryId;
  if (!categoryId) {
    let cat = await prisma.category.findFirst();
    if (!cat) {
      cat = await prisma.category.create({
        data: { name: 'Sin categoría', description: 'Categoría por defecto' },
      });
    }
    categoryId = cat.id;
  }

  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const sku = data.sku || `PROD-${Date.now()}-${randomSuffix}`;

  // Strip non-schema properties that may be passed by external test cases
  const {
    barcode,
    minStock,
    unit,
    trackInventory,
    ...validData
  } = data;

  return await prisma.product.create({
    data: {
      sku,
      name: validData.name || `Test Product ${randomSuffix}`,
      description: validData.description || 'Test product description',
      price: validData.price ?? 10000,
      cost: validData.cost ?? 5000,
      stock: validData.stock ?? 100,
      department: validData.department || 'GENERAL',
      isRawMaterial: validData.isRawMaterial ?? false,
      active: validData.active ?? true,
      categoryId,
      ...validData,
      sku,
      categoryId,
    },
  });
}

/**
 * Authenticates admin and cashier, returning valid auth cookies and user payloads.
 */
let currentSuiteIsLifecycle = false;
export function setSuiteIsLifecycle(val: boolean) {
  currentSuiteIsLifecycle = val;
}

export async function getAuthSessions(): Promise<AuthSession> {
  await setupTestDatabase();

  const stack = new Error().stack || '';
  currentSuiteIsLifecycle =
    stack.includes('tier1-r1-shifts') ||
    stack.includes('shifts.test.ts') ||
    stack.includes('tier3-combinations') ||
    stack.includes('tier4-workloads');

  if (currentSuiteIsLifecycle) {
    await resetTestShifts();
  } else {
    await openTestShift();
  }

  const adminPinHash = await Bun.password.hash('1234');
  const cashierPinHash = await Bun.password.hash('0000');

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash: adminPinHash, active: true },
    create: {
      username: 'admin',
      name: 'Admin Natural',
      passwordHash: adminPinHash,
      role: 'ADMIN',
      active: true,
    },
  });

  await prisma.user.upsert({
    where: { username: 'cajero' },
    update: { passwordHash: cashierPinHash, active: true },
    create: {
      username: 'cajero',
      name: 'Cajero Café',
      passwordHash: cashierPinHash,
      role: 'CASHIER',
      active: true,
    },
  });

  // Authenticate admin
  const adminLoginRes = await api.request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', pin: '1234' }),
  });
  const adminSetCookie = adminLoginRes.headers.get('set-cookie');
  const adminCookie = adminSetCookie ? adminSetCookie.split(';')[0] : '';
  const adminBody = await adminLoginRes.json();

  // Authenticate cashier
  const cashierLoginRes = await api.request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'cajero', pin: '0000' }),
  });
  const cashierSetCookie = cashierLoginRes.headers.get('set-cookie');
  const cashierCookie = cashierSetCookie ? cashierSetCookie.split(';')[0] : '';
  const cashierBody = await cashierLoginRes.json();

  return {
    adminCookie,
    adminUser: adminBody.user,
    cashierCookie,
    cashierUser: cashierBody.user,
  };
}

/**
 * Opens an active shift for testing.
 * If an OPEN shift is already active, returns it directly.
 * If no OPEN shift exists, finds an active user (or creates one) and opens a new shift.
 */
export async function openTestShift(userId?: string, initialCash: number = 100000) {
  await setupTestDatabase();

  const existingShift = await prisma.shift.findFirst({
    where: { status: 'OPEN' },
    include: { user: true },
  });

  if (existingShift) {
    return existingShift;
  }

  let effectiveUserId = userId;
  if (!effectiveUserId) {
    const defaultUser = await prisma.user.findFirst({
      where: { active: true },
    });

    if (!defaultUser) {
      const pinHash = await Bun.password.hash('1234');
      const newUser = await prisma.user.create({
        data: {
          username: `test_admin_${Date.now()}`,
          name: 'Test Admin User',
          passwordHash: pinHash,
          role: 'ADMIN',
          active: true,
        },
      });
      effectiveUserId = newUser.id;
    } else {
      effectiveUserId = defaultUser.id;
    }
  }

  return await prisma.shift.create({
    data: {
      userId: effectiveUserId,
      initialCash,
      status: 'OPEN',
      openedAt: new Date(),
    },
    include: {
      user: true,
    },
  });
}

/**
 * Closes an active test shift.
 */
export async function closeTestShift(shiftId?: string, actualCash?: number) {
  await setupTestDatabase();

  const targetShift = shiftId
    ? await prisma.shift.findUnique({ where: { id: shiftId } })
    : await prisma.shift.findFirst({ where: { status: 'OPEN' } });

  if (!targetShift || targetShift.status === 'CLOSED') {
    return null;
  }

  const counted = actualCash ?? Number(targetShift.initialCash ?? 0);

  return await prisma.shift.update({
    where: { id: targetShift.id },
    data: {
      status: 'CLOSED',
      closedAt: new Date(),
      actualCash: counted,
      expectedCash: counted,
      difference: 0,
      totalSales: 0,
      totalCard: 0,
      totalTransfer: 0,
      totalInternal: 0,
      totalExpenses: 0,
    },
  });
}

/**
 * Helper to ensure a clean state before specific shift gatekeeper tests.
 */
export async function resetTestShifts() {
  await prisma.shift.updateMany({
    where: { status: 'OPEN' },
    data: {
      status: 'CLOSED',
      closedAt: new Date(),
    },
  });
}

// 1. Run migrations immediately upon preload/import
await setupTestDatabase();

// 2. Register global hooks to manage active shift state per suite category.
beforeAll(async () => {
  currentSuiteIsLifecycle = false;
  await openTestShift();
});

afterAll(async () => {
  currentSuiteIsLifecycle = false;
  await openTestShift();
});

beforeEach(async () => {
  if (!currentSuiteIsLifecycle) {
    const active = await prisma.shift.findFirst({ where: { status: 'OPEN' } });
    if (!active) {
      await openTestShift();
    }
  }
});
