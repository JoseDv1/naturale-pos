import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import api from '../../src/api';
import { prisma } from '../../src/db';
import { getAuthSessions, AuthSession, createTestProduct } from '../fixtures/test-setup';

describe('Tier 4 — Real-World Workload: Full Business Day Lifecycle', () => {
  let auth: AuthSession;
  let prodColdBrew: any;
  let prodGranola: any;
  let prodKombucha: any;
  let prodSandwich: any;
  let workTableId = '';

  // Track state across the business day
  let shiftId = '';
  let expenseId = '';
  const saleIds: string[] = [];

  beforeAll(async () => {
    auth = await getAuthSessions();

    prodColdBrew = await createTestProduct({
      name: 'Workload Cold Brew 12oz',
      price: 12000,
      stock: 40,
      department: 'CAFE',
    });

    prodGranola = await createTestProduct({
      name: 'Workload Artisan Granola',
      price: 35000,
      stock: 25,
      department: 'MARKET',
    });

    prodKombucha = await createTestProduct({
      name: 'Workload Ginger Kombucha',
      price: 15000,
      stock: 30,
      department: 'CAFE',
    });

    prodSandwich = await createTestProduct({
      name: 'Workload Gourmet Sandwich',
      price: 25000,
      stock: 20,
      department: 'CAFE',
    });

    const table = await prisma.cafeTable.create({
      data: {
        name: `Mesa Workload ${Date.now()}`,
        status: 'AVAILABLE',
      },
    });
    workTableId = table.id;
  });

  afterAll(async () => {
    // Teardown everything
    try {
      await api.request('/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ actualCash: 0 }),
      });
    } catch {}

    try {
      if (workTableId) {
        await prisma.cafeTable.delete({ where: { id: workTableId } }).catch(() => {});
      }
      for (const sId of saleIds) {
        await prisma.salePayment.deleteMany({ where: { saleId: sId } });
        await prisma.saleItem.deleteMany({ where: { saleId: sId } });
        await prisma.sale.delete({ where: { id: sId } }).catch(() => {});
      }
      if (expenseId) {
        await prisma.expenseItem.deleteMany({ where: { expenseId } });
        await prisma.expense.delete({ where: { id: expenseId } }).catch(() => {});
      }
      for (const p of [prodColdBrew, prodGranola, prodKombucha, prodSandwich]) {
        if (p) {
          await prisma.saleItem.deleteMany({ where: { productId: p.id } });
          await prisma.product.delete({ where: { id: p.id } }).catch(() => {});
        }
      }
    } catch {}
  });

  // ---------------------------------------------------------------------------
  // ACT 1: Morning Cash Drawer Opening
  // ---------------------------------------------------------------------------
  it('Act 1: Cashier opens morning shift with initial base cash of $100,000', async () => {
    const res = await api.request('/shifts/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({ initialCash: 100000 }),
    });

    expect([200, 201]).toContain(res.status);
    const data = await res.json();
    expect(data.shift).toBeDefined();
    expect(data.shift.status).toBe('OPEN');
    expect(Number(data.shift.initialCash)).toBe(100000);
    shiftId = data.shift.id;
  });

  // ---------------------------------------------------------------------------
  // ACT 2: Morning Sales Rush (Cash, Card, Transfer)
  // ---------------------------------------------------------------------------
  it('Act 2: Cashier processes daytime customer sales with diverse payment methods', async () => {
    // 1. Sale 1: 2 Cold Brews in CASH = $24,000
    const sale1Res = await api.request('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        total: 24000,
        items: [{ productId: prodColdBrew.id, quantity: 2, price: 12000 }],
        payments: [{ method: 'CASH', amount: 24000 }],
      }),
    });
    expect([200, 201]).toContain(sale1Res.status);
    const s1 = await sale1Res.json();
    saleIds.push(s1.sale?.id || s1.id);

    // Verify Cold Brew stock decreased from 40 to 38
    const coldBrewAfter = await prisma.product.findUnique({ where: { id: prodColdBrew.id } });
    expect(coldBrewAfter!.stock).toBe(38);

    // 2. Sale 2: 1 Granola in CARD = $35,000
    const sale2Res = await api.request('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        total: 35000,
        items: [{ productId: prodGranola.id, quantity: 1, price: 35000 }],
        payments: [{ method: 'CARD', amount: 35000 }],
      }),
    });
    expect([200, 201]).toContain(sale2Res.status);
    const s2 = await sale2Res.json();
    saleIds.push(s2.sale?.id || s2.id);

    // 3. Sale 3: 1 Kombucha in TRANSFER = $15,000
    const sale3Res = await api.request('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        total: 15000,
        items: [{ productId: prodKombucha.id, quantity: 1, price: 15000 }],
        payments: [{ method: 'TRANSFER', amount: 15000 }],
      }),
    });
    expect([200, 201]).toContain(sale3Res.status);
    const s3 = await sale3Res.json();
    saleIds.push(s3.sale?.id || s3.id);
  });

  // ---------------------------------------------------------------------------
  // ACT 3: Midday Petty Cash Expense
  // ---------------------------------------------------------------------------
  it('Act 3: Cashier registers an unexpected petty cash expense in cash ($14,000)', async () => {
    const res = await api.request('/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        description: 'Compra de productos de limpieza',
        amount: 14000,
        category: 'supplies',
        department: 'GENERAL',
        userId: auth.cashierUser.id,
      }),
    });

    expect([200, 201]).toContain(res.status);
    const data = await res.json();
    expenseId = data.expense?.id || data.id;
  });

  // ---------------------------------------------------------------------------
  // ACT 4: Afternoon Table Dine-In & Split Checkout
  // ---------------------------------------------------------------------------
  it('Act 4: Table dine-in customer orders and completes split checkout ($30k Cash + $20k Card = $50k)', async () => {
    // Open table
    await api.request(`/tables/${workTableId}/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({ userId: auth.cashierUser.id }),
    });

    // Add order: 2 Sandwiches ($50,000)
    await api.request(`/tables/${workTableId}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        items: [{ productId: prodSandwich.id, quantity: 2, price: 25000 }],
      }),
    });

    // Split checkout: $30,000 Cash + $20,000 Card
    const checkoutRes = await api.request(`/tables/${workTableId}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        payments: [
          { method: 'CASH', amount: 30000 },
          { method: 'CARD', amount: 20000 },
        ],
      }),
    });
    expect([200, 201]).toContain(checkoutRes.status);
    const checkoutData = await checkoutRes.json();
    if (checkoutData.sale) {
      saleIds.push(checkoutData.sale.id);
    }
  });

  // ---------------------------------------------------------------------------
  // ACT 5: Admin Audit & Expense Adjustment
  // ---------------------------------------------------------------------------
  it('Act 5: Admin modifies expense amount from $14,000 to $16,000 to match official invoice', async () => {
    const editRes = await api.request(`/expenses/${expenseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
      body: JSON.stringify({
        description: 'Compra de productos de limpieza (factura ajustada)',
        amount: 16000,
        category: 'supplies',
        department: 'GENERAL',
      }),
    });

    expect([200, 204]).toContain(editRes.status);
  });

  // ---------------------------------------------------------------------------
  // ACT 6: End-of-Day Guided Arqueo & Closure
  // ---------------------------------------------------------------------------
  it('Act 6: Cashier performs guided arqueo cash count with expected cash and calculates difference', async () => {
    // Math audit:
    // Base: $100,000
    // Cash Sales: $24,000 (sale 1) + $30,000 (table) = $54,000
    // Cash Expenses: $16,000 (adjusted expense)
    // Expected Cash = 100,000 + 54,000 - 16,000 = $138,000
    // Physical Cash counted: $137,000 (difference: -$1,000 faltante)

    const closeRes = await api.request('/shifts/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        actualCash: 137000,
        notes: 'Cierre del día con faltante menor de $1,000',
      }),
    });

    expect([200, 201]).toContain(closeRes.status);
    const data = await closeRes.json();
    expect(data.report).toBeDefined();
    expect(data.report.shift.status).toBe('CLOSED');
    expect(Number(data.report.actualCash)).toBe(137000);
    expect(Number(data.report.expectedCash)).toBe(138000);
    expect(Number(data.report.difference)).toBe(-1000);
  });

  // ---------------------------------------------------------------------------
  // ACT 7: Sales History Reports Audit
  // ---------------------------------------------------------------------------
  it('Act 7: Reports view queries and audits sales history with status and payment filters', async () => {
    const res = await api.request('/sales?status=COMPLETED', {
      headers: { Cookie: auth.adminCookie },
    });

    expect(res.status).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);

    // Verify all sales from today appear in history
    const allFound = saleIds.every((id) => list.some((s: any) => s.id === id));
    expect(allFound).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // ACT 8: Continuous Night Shift Handover
  // ---------------------------------------------------------------------------
  it('Act 8: Night shift cashier immediately opens a new shift without system restart', async () => {
    const res = await api.request('/shifts/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
      body: JSON.stringify({ initialCash: 50000 }),
    });

    expect([200, 201]).toContain(res.status);
    const data = await res.json();
    expect(data.shift.status).toBe('OPEN');
    expect(Number(data.shift.initialCash)).toBe(50000);

    // Clean up night shift
    await api.request('/shifts/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
      body: JSON.stringify({ actualCash: 50000 }),
    });
  });
});
