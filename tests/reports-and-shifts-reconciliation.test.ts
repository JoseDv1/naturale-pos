import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import api from '../src/api';
import { prisma } from '../src/db';
import { getAuthSessions, AuthSession, createTestProduct, resetTestShifts, setSuiteIsLifecycle, openTestShift } from './fixtures/test-setup';

describe('Reports & Shifts Reconciliation and Date Filter Suite', () => {
  let auth: AuthSession;
  let testProduct: any;
  let testShiftId: string = '';

  beforeAll(async () => {
    setSuiteIsLifecycle(true);
    await resetTestShifts();
    auth = await getAuthSessions();

    testProduct = await createTestProduct({
      name: 'Reconciliation Test Item',
      price: 25000,
      cost: 10000,
      stock: 100,
      department: 'MARKET',
    });
  });

  afterAll(async () => {
    try {
      if (testProduct) {
        await prisma.saleItem.deleteMany({ where: { productId: testProduct.id } });
        await prisma.expenseItem.deleteMany({ where: { productId: testProduct.id } });
        await prisma.product.delete({ where: { id: testProduct.id } }).catch(() => {});
      }
      setSuiteIsLifecycle(false);
      await resetTestShifts();
      await openTestShift();
    } catch {}
  });

  it('1. POST /shifts/open opens shift with initial cash base', async () => {
    await resetTestShifts();
    const res = await api.request('/shifts/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({ initialCash: 100000, notes: 'Turno Mañana' }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.shift).toBeDefined();
    expect(Number(data.shift.initialCash)).toBe(100000);
    testShiftId = data.shift.id;
  });

  it('2. POST /sales creates cash and card sales linked to the shift', async () => {
    // Sale 1: Cash $50,000 (2 items x 25,000)
    const sale1Res = await api.request('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        total: 50000,
        items: [{ productId: testProduct.id, quantity: 2, price: 25000 }],
        payments: [{ method: 'CASH', amount: 50000 }],
      }),
    });
    expect([200, 201]).toContain(sale1Res.status);

    // Sale 2: Card $25,000 (1 item x 25,000)
    const sale2Res = await api.request('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        total: 25000,
        items: [{ productId: testProduct.id, quantity: 1, price: 25000 }],
        payments: [{ method: 'CARD', amount: 25000 }],
      }),
    });
    expect([200, 201]).toContain(sale2Res.status);
  });

  it('3. POST /expenses creates an operating cash expense linked to the shift', async () => {
    const res = await api.request('/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        description: 'Papelería y cinta para empaque',
        amount: 15000,
        category: 'supplies',
        department: 'MARKET',
      }),
    });
    expect([200, 201]).toContain(res.status);
  });

  it('4. GET /shifts/current reports real-time expected cash accurately', async () => {
    const res = await api.request('/shifts/current', {
      headers: { Cookie: auth.cashierCookie },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.shift).toBeDefined();
    expect(data.realTimeTotals).toBeDefined();

    // Base: 100,000 + Cash: 50,000 - Expenses: 15,000 = 135,000
    expect(data.realTimeTotals.initialCash).toBe(100000);
    expect(data.realTimeTotals.cashSales).toBe(50000);
    expect(data.realTimeTotals.cardSales).toBe(25000);
    expect(data.realTimeTotals.expenses).toBe(15000);
    expect(data.realTimeTotals.expectedCash).toBe(135000);
  });

  it('5. POST /shifts/close closes the shift with counted cash and records arqueo', async () => {
    const res = await api.request('/shifts/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        actualCash: 135000,
        notes: 'Cierre cuadrado sin novedades',
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.report.expectedCash).toBe(135000);
    expect(data.report.actualCash).toBe(135000);
    expect(data.report.difference).toBe(0);
  });

  it('6. GET /shifts with date bounds returns enriched list matching closed shift totals', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await api.request(`/shifts?start=${today}&end=${today}`, {
      headers: { Cookie: auth.adminCookie },
    });
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);

    const closed = list.find((s: any) => s.id === testShiftId);
    expect(closed).toBeDefined();
    expect(closed.initialCash).toBe(100000);
    expect(closed.totalSales).toBe(75000);
    expect(closed.cashSales).toBe(50000);
    expect(closed.cardSales).toBe(25000);
    expect(closed.totalExpenses).toBe(15000);
    expect(closed.expectedCash).toBe(135000);
    expect(closed.actualCash).toBe(135000);
    expect(closed.difference).toBe(0);
  });

  it('7. GET /reports/dashboard with today bounds matches shift totals 1:1 and returns cashReconciliation', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await api.request(`/reports/dashboard?start=${today}&end=${today}`, {
      headers: { Cookie: auth.adminCookie },
    });
    expect(res.status).toBe(200);
    const data = await res.json();

    // Consolidated metrics
    expect(data.CONSOLIDATED).toBeDefined();
    expect(data.CONSOLIDATED.revenue).toBeGreaterThanOrEqual(75000);
    expect(data.paymentMethods.CASH).toBeGreaterThanOrEqual(50000);
    expect(data.paymentMethods.CARD).toBeGreaterThanOrEqual(25000);

    // Cash Drawer Reconciliation object
    expect(data.cashReconciliation).toBeDefined();
    expect(data.cashReconciliation.shiftsCount).toBeGreaterThanOrEqual(1);
    expect(data.cashReconciliation.initialCash).toBeGreaterThanOrEqual(100000);
    expect(data.cashReconciliation.cashSales).toBeGreaterThanOrEqual(50000);
    expect(data.cashReconciliation.expenses).toBeGreaterThanOrEqual(15000);
    expect(data.cashReconciliation.expectedCash).toBe(
      data.cashReconciliation.initialCash + data.cashReconciliation.cashSales - data.cashReconciliation.expenses
    );
  });

  it('8. Handles date filters in full ISO format symmetrically to YYYY-MM-DD and handles invalid dates gracefully', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const startISO = `${today}T00:00:00.000Z`;
    const endISO = `${today}T23:59:59.999Z`;

    // Test GET /shifts with ISO bounds
    const shiftsIsoRes = await api.request(`/shifts?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}`, {
      headers: { Cookie: auth.adminCookie },
    });
    expect(shiftsIsoRes.status).toBe(200);
    const shiftsIsoList = await shiftsIsoRes.json();
    expect(Array.isArray(shiftsIsoList)).toBe(true);
    const foundShift = shiftsIsoList.find((s: any) => s.id === testShiftId);
    expect(foundShift).toBeDefined();

    // Test GET /reports/dashboard with ISO bounds
    const reportsIsoRes = await api.request(`/reports/dashboard?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}`, {
      headers: { Cookie: auth.adminCookie },
    });
    expect(reportsIsoRes.status).toBe(200);
    const reportsIsoData = await reportsIsoRes.json();
    expect(reportsIsoData.cashReconciliation).toBeDefined();
    expect(reportsIsoData.cashReconciliation.shiftsCount).toBeGreaterThanOrEqual(1);

    // Test GET /shifts and /reports with invalid date bounds (should degrade gracefully, not throw 500)
    const invalidShiftsRes = await api.request('/shifts?start=invalid-date&end=another-invalid', {
      headers: { Cookie: auth.adminCookie },
    });
    expect(invalidShiftsRes.status).toBe(200);

    const invalidReportsRes = await api.request('/reports/dashboard?start=invalid-date&end=another-invalid', {
      headers: { Cookie: auth.adminCookie },
    });
    expect(invalidReportsRes.status).toBe(200);
  });

  it('9. Audits cash drawer difference calculations for shortage (faltante) and surplus (sobrante)', async () => {
    // Subtest A: Shortage (Faltante)
    await resetTestShifts();
    const openRes1 = await api.request('/shifts/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({ initialCash: 50000, notes: 'Turno Faltante Test' }),
    });
    expect(openRes1.status).toBe(201);

    await api.request('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        total: 25000,
        items: [{ productId: testProduct.id, quantity: 1, price: 25000 }],
        payments: [{ method: 'CASH', amount: 25000 }],
      }),
    });

    // Expected: 50,000 + 25,000 = 75,000. Cashier counts 70,000 physical cash. Shortage = -5,000.
    const closeRes1 = await api.request('/shifts/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({ actualCash: 70000, notes: 'Faltante de 5000' }),
    });
    expect(closeRes1.status).toBe(200);
    const closeData1 = await closeRes1.json();
    expect(closeData1.report.expectedCash).toBe(75000);
    expect(closeData1.report.actualCash).toBe(70000);
    expect(closeData1.report.difference).toBe(-5000);

    // Subtest B: Surplus (Sobrante)
    const openRes2 = await api.request('/shifts/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({ initialCash: 50000, notes: 'Turno Sobrante Test' }),
    });
    expect(openRes2.status).toBe(201);

    await api.request('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        total: 25000,
        items: [{ productId: testProduct.id, quantity: 1, price: 25000 }],
        payments: [{ method: 'CASH', amount: 25000 }],
      }),
    });

    // Expected: 50,000 + 25,000 = 75,000. Cashier counts 78,000 physical cash. Surplus = +3,000.
    const closeRes2 = await api.request('/shifts/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({ actualCash: 78000, notes: 'Sobrante de 3000' }),
    });
    expect(closeRes2.status).toBe(200);
    const closeData2 = await closeRes2.json();
    expect(closeData2.report.expectedCash).toBe(75000);
    expect(closeData2.report.actualCash).toBe(78000);
    expect(closeData2.report.difference).toBe(3000);
  });

  it('10. Asserts OPEN table orders do NOT inflate active shift or reports/dashboard totals before checkout', async () => {
    await resetTestShifts();
    // Open a fresh shift with 50,000 initial base
    const openShiftRes = await api.request('/shifts/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({ initialCash: 50000, notes: 'Turno Mesa Audit' }),
    });
    expect(openShiftRes.status).toBe(201);
    const activeShift = (await openShiftRes.json()).shift;

    // Find or create an available table
    let table = await prisma.cafeTable.findFirst({ where: { status: 'AVAILABLE' } });
    if (!table) {
      table = await prisma.cafeTable.create({
        data: { name: 'Mesa QA Audit ' + Date.now(), status: 'AVAILABLE', x: 20, y: 20 },
      });
    }

    // Step 1: Open the table (creates an OPEN sale)
    const openTableRes = await api.request(`/tables/${table.id}/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({ userId: auth.cashierUser.id }),
    });
    expect(openTableRes.status).toBe(200);

    // Step 2: Save items on table ($50,000 total = 2 items x $25,000)
    const saveItemsRes = await api.request(`/tables/${table.id}/save`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        items: [{ productId: testProduct.id, quantity: 2, price: 25000 }],
      }),
    });
    expect(saveItemsRes.status).toBe(200);

    // Step 3: Verify the table sale in DB has status 'OPEN' and total 50,000
    const occupiedTable = await prisma.cafeTable.findUnique({
      where: { id: table.id },
      include: { currentSale: true },
    });
    expect(occupiedTable?.status).toBe('OCCUPIED');
    expect(occupiedTable?.currentSale?.status).toBe('OPEN');
    expect(Number(occupiedTable?.currentSale?.total)).toBe(50000);

    // Step 4: Audit GET /shifts/current - OPEN table order MUST NOT inflate shift totals!
    const currentShiftRes = await api.request('/shifts/current', {
      headers: { Cookie: auth.cashierCookie },
    });
    expect(currentShiftRes.status).toBe(200);
    const currentShiftData = await currentShiftRes.json();
    expect(currentShiftData.realTimeTotals.totalSales).toBe(0);
    expect(currentShiftData.realTimeTotals.cashSales).toBe(0);
    expect(currentShiftData.realTimeTotals.cardSales).toBe(0);
    expect(currentShiftData.realTimeTotals.expectedCash).toBe(50000); // Only initialCash!

    // Step 5: Audit GET /shifts list - OPEN shift row MUST NOT include unbilled table order
    const today = new Date().toISOString().slice(0, 10);
    const shiftsListRes = await api.request(`/shifts?start=${today}&end=${today}`, {
      headers: { Cookie: auth.adminCookie },
    });
    const shiftsList = await shiftsListRes.json();
    const openShiftInList = shiftsList.find((s: any) => s.id === activeShift.id);
    expect(openShiftInList).toBeDefined();
    expect(openShiftInList.totalSales).toBe(0);
    expect(openShiftInList.cashSales).toBe(0);
    expect(openShiftInList.expectedCash).toBe(50000);

    // Step 6: Checkout table with CASH payment of $50,000
    const checkoutRes = await api.request(`/tables/${table.id}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        payments: [{ method: 'CASH', amount: 50000 }],
      }),
    });
    expect(checkoutRes.status).toBe(200);

    // Step 7: Now that sale is COMPLETED, audit that shift totals reflect the completed sale
    const postCheckoutShiftRes = await api.request('/shifts/current', {
      headers: { Cookie: auth.cashierCookie },
    });
    const postCheckoutData = await postCheckoutShiftRes.json();
    expect(postCheckoutData.realTimeTotals.totalSales).toBe(50000);
    expect(postCheckoutData.realTimeTotals.cashSales).toBe(50000);
    expect(postCheckoutData.realTimeTotals.expectedCash).toBe(100000); // 50,000 base + 50,000 cash

    // Clean up: Close this shift with exact counted cash
    const closeRes = await api.request('/shifts/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({ actualCash: 100000 }),
    });
    expect(closeRes.status).toBe(200);
  });
});
