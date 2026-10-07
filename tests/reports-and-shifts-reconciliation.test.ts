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

  it('11. Audits shiftId=current and shiftId=<uuid> filters on /reports/dashboard, /sales, and /shifts for Este Turno', async () => {
    await resetTestShifts();
    // 1. Open a dedicated test shift
    const openRes = await api.request('/shifts/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({ initialCash: 100000, notes: 'Turno Prueba Temporalidad' }),
    });
    expect(openRes.status).toBe(201);
    const { shift: activeShift } = await openRes.json();
    expect(activeShift.status).toBe('OPEN');

    // 2. Create cash sale ($25,000) and card sale ($25,000)
    const sale1 = await api.request('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        total: 25000,
        payments: [{ method: 'CASH', amount: 25000 }],
        items: [{ productId: testProduct.id, quantity: 1, price: 25000 }],
      }),
    });
    expect([200, 201]).toContain(sale1.status);

    const sale2 = await api.request('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        total: 25000,
        payments: [{ method: 'CARD', amount: 25000 }],
        items: [{ productId: testProduct.id, quantity: 1, price: 25000 }],
      }),
    });
    expect([200, 201]).toContain(sale2.status);

    // 3. Create expense ($10,000)
    const expRes = await api.request('/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        department: 'MARKET',
        category: 'supplies',
        description: 'Bolsas para turno',
        amount: 10000,
      }),
    });
    expect([200, 201]).toContain(expRes.status);

    // 4. Test GET /reports/dashboard?shiftId=current
    const reportRes = await api.request('/reports/dashboard?shiftId=current', {
      headers: { Cookie: auth.adminCookie },
    });
    expect(reportRes.status).toBe(200);
    const reportData = await reportRes.json();
    expect(reportData.shiftInfo).toBeDefined();
    expect(reportData.shiftInfo.id).toBe(activeShift.id);
    expect(reportData.shiftInfo.status).toBe('OPEN');
    expect(reportData.paymentMethods.CASH).toBe(25000);
    expect(reportData.paymentMethods.CARD).toBe(25000);
    expect(reportData.CONSOLIDATED.revenue).toBe(50000);
    expect(reportData.CONSOLIDATED.expenses).toBe(10000);

    // 5. Test GET /sales?shiftId=current
    const salesRes = await api.request('/sales?shiftId=current', {
      headers: { Cookie: auth.cashierCookie },
    });
    expect(salesRes.status).toBe(200);
    const salesList = await salesRes.json();
    expect(salesList.length).toBe(2);
    expect(salesList.every((s: any) => s.shiftId === activeShift.id)).toBe(true);

    // 6. Test GET /shifts?shiftId=current
    const shiftsRes = await api.request('/shifts?shiftId=current', {
      headers: { Cookie: auth.cashierCookie },
    });
    expect(shiftsRes.status).toBe(200);
    const shiftsList = await shiftsRes.json();
    expect(shiftsList.length).toBe(1);
    expect(shiftsList[0].id).toBe(activeShift.id);
    expect(shiftsList[0].status).toBe('OPEN');
    expect(shiftsList[0].initialCash).toBe(100000);
    expect(shiftsList[0].totalSales).toBe(50000);
    expect(shiftsList[0].cashSales).toBe(25000);
    expect(shiftsList[0].cardSales).toBe(25000);
    expect(shiftsList[0].totalExpenses).toBe(10000);
    expect(shiftsList[0].expectedCash).toBe(115000); // 100,000 + 25,000 - 10,000

    // 7. Close shift and verify fallback to most recent closed shift
    const closeShiftRes = await api.request('/shifts/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({ actualCash: 115000 }),
    });
    expect(closeShiftRes.status).toBe(200);

    // After closure, shiftId=current returns the latest closed shift
    const postCloseReportRes = await api.request('/reports/dashboard?shiftId=current', {
      headers: { Cookie: auth.adminCookie },
    });
    expect(postCloseReportRes.status).toBe(200);
    const postCloseData = await postCloseReportRes.json();
    expect(postCloseData.shiftInfo.id).toBe(activeShift.id);
    expect(postCloseData.shiftInfo.status).toBe('CLOSED');
  });

  it('12. Audits non-existent shift UUID handling across /reports/dashboard, /sales, and /shifts', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';

    // GET /reports/dashboard with non-existent shiftId
    const reportRes = await api.request(`/reports/dashboard?shiftId=${nonExistentId}`, {
      headers: { Cookie: auth.adminCookie },
    });
    expect(reportRes.status).toBe(200);
    const reportData = await reportRes.json();
    expect(reportData.shiftInfo).toBeNull();
    expect(reportData.CONSOLIDATED.revenue).toBe(0);
    expect(reportData.CONSOLIDATED.expenses).toBe(0);
    expect(reportData.cashReconciliation.shiftsCount).toBe(0);
    expect(reportData.cashReconciliation.shifts).toEqual([]);

    // GET /sales with non-existent shiftId
    const salesRes = await api.request(`/sales?shiftId=${nonExistentId}`, {
      headers: { Cookie: auth.cashierCookie },
    });
    expect(salesRes.status).toBe(200);
    const salesList = await salesRes.json();
    expect(salesList).toEqual([]);

    // GET /shifts with non-existent shiftId
    const shiftsRes = await api.request(`/shifts?shiftId=${nonExistentId}`, {
      headers: { Cookie: auth.cashierCookie },
    });
    expect(shiftsRes.status).toBe(200);
    const shiftsList = await shiftsRes.json();
    expect(shiftsList).toEqual([]);
  });

  it('13. Audits fallback ordering among multiple closed shifts and explicit historical UUID lookup', async () => {
    await resetTestShifts();

    // Create Shift 1 (older)
    const shift1 = await prisma.shift.create({
      data: {
        userId: auth.cashierUser.id,
        status: 'CLOSED',
        initialCash: 40000,
        expectedCash: 40000,
        actualCash: 40000,
        difference: 0,
        openedAt: new Date(Date.now() + 10000),
        closedAt: new Date(Date.now() + 20000),
      },
    });

    // Create Shift 2 (newer)
    const shift2 = await prisma.shift.create({
      data: {
        userId: auth.cashierUser.id,
        status: 'CLOSED',
        initialCash: 60000,
        expectedCash: 60000,
        actualCash: 60000,
        difference: 0,
        openedAt: new Date(Date.now() + 30000),
        closedAt: new Date(Date.now() + 40000),
      },
    });

    // When no shift is open, shiftId=current MUST pick the newest closed shift (Shift 2)
    const reportCurrent = await api.request('/reports/dashboard?shiftId=current', {
      headers: { Cookie: auth.adminCookie },
    });
    expect(reportCurrent.status).toBe(200);
    const reportCurrentData = await reportCurrent.json();
    expect(reportCurrentData.shiftInfo.id).toBe(shift2.id);
    expect(reportCurrentData.shiftInfo.initialCash).toBe(60000);

    const shiftsCurrent = await api.request('/shifts?shiftId=current', {
      headers: { Cookie: auth.adminCookie },
    });
    expect(shiftsCurrent.status).toBe(200);
    const shiftsCurrentList = await shiftsCurrent.json();
    expect(shiftsCurrentList.length).toBe(1);
    expect(shiftsCurrentList[0].id).toBe(shift2.id);

    // Historical lookup: explicitly querying Shift 1 by UUID must return Shift 1
    const reportShift1 = await api.request(`/reports/dashboard?shiftId=${shift1.id}`, {
      headers: { Cookie: auth.adminCookie },
    });
    expect(reportShift1.status).toBe(200);
    const reportShift1Data = await reportShift1.json();
    expect(reportShift1Data.shiftInfo.id).toBe(shift1.id);
    expect(reportShift1Data.shiftInfo.initialCash).toBe(40000);

    const shiftsShift1 = await api.request(`/shifts?shiftId=${shift1.id}`, {
      headers: { Cookie: auth.adminCookie },
    });
    expect(shiftsShift1.status).toBe(200);
    const shiftsShift1List = await shiftsShift1.json();
    expect(shiftsShift1List.length).toBe(1);
    expect(shiftsShift1List[0].id).toBe(shift1.id);

    // Clean up created test shifts
    await prisma.shift.deleteMany({ where: { id: { in: [shift1.id, shift2.id] } } });
  });

  it('14. Audits shiftId=current behavior when no shifts exist in database', async () => {
    await resetTestShifts();

    // Temporarily backup and delete all shifts
    const existingShifts = await prisma.shift.findMany();
    await prisma.shift.deleteMany();

    try {
      // 1. GET /reports/dashboard?shiftId=current must return 200 with shiftInfo: null
      const reportRes = await api.request('/reports/dashboard?shiftId=current', {
        headers: { Cookie: auth.adminCookie },
      });
      expect(reportRes.status).toBe(200);
      const reportData = await reportRes.json();
      expect(reportData.shiftInfo).toBeNull();
      expect(reportData.CONSOLIDATED.revenue).toBe(0);
      expect(reportData.CONSOLIDATED.expenses).toBe(0);
      expect(reportData.cashReconciliation.shiftsCount).toBe(0);
      expect(reportData.cashReconciliation.shifts).toEqual([]);

      // 2. GET /sales?shiftId=current must return 200 with []
      const salesRes = await api.request('/sales?shiftId=current', {
        headers: { Cookie: auth.cashierCookie },
      });
      expect(salesRes.status).toBe(200);
      const salesList = await salesRes.json();
      expect(salesList).toEqual([]);

      // 3. GET /shifts?shiftId=current must return 200 with []
      const shiftsRes = await api.request('/shifts?shiftId=current', {
        headers: { Cookie: auth.cashierCookie },
      });
      expect(shiftsRes.status).toBe(200);
      const shiftsList = await shiftsRes.json();
      expect(shiftsList).toEqual([]);
    } finally {
      // Restore shifts
      for (const s of existingShifts) {
        await prisma.shift.create({
          data: {
            id: s.id,
            userId: s.userId,
            status: s.status,
            initialCash: s.initialCash,
            openedAt: s.openedAt,
            closedAt: s.closedAt,
            closedByUserId: s.closedByUserId,
            expectedCash: s.expectedCash,
            actualCash: s.actualCash,
            difference: s.difference,
            totalSales: s.totalSales,
            totalCard: s.totalCard,
            totalTransfer: s.totalTransfer,
            totalInternal: s.totalInternal,
            totalExpenses: s.totalExpenses,
            notes: s.notes,
          },
        }).catch(() => {});
      }
    }
  });

  it('15. Audits financial calculations: multi-method payments and exclusion of INTERNAL_TRANSFER expenses', async () => {
    await resetTestShifts();

    // 1. Open active shift
    const openRes = await api.request('/shifts/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({ initialCash: 100000, notes: 'Turno Reconciliación Financiera' }),
    });
    expect(openRes.status).toBe(201);
    const { shift: activeShift } = await openRes.json();

    // 2. Sale with multiple payment methods: Cash 25,000 + Card 25,000 = 50,000
    const saleRes = await api.request('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        total: 50000,
        items: [{ productId: testProduct.id, quantity: 2, price: 25000 }],
        payments: [
          { method: 'CASH', amount: 25000 },
          { method: 'CARD', amount: 25000 },
        ],
      }),
    });
    expect([200, 201]).toContain(saleRes.status);

    // 3. Regular operating expense: 15,000
    const opExpRes = await api.request('/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        department: 'MARKET',
        category: 'supplies',
        description: 'Limpieza e insumos de tienda',
        amount: 15000,
      }),
    });
    expect([200, 201]).toContain(opExpRes.status);

    // 4. Virtual expense record with category INTERNAL_TRANSFER: 20,000
    await prisma.expense.create({
      data: {
        userId: auth.cashierUser.id,
        department: 'MARKET',
        category: 'INTERNAL_TRANSFER',
        description: 'Transferencia interna de insumos (virtual)',
        amount: 20000,
        shiftId: activeShift.id,
      },
    });

    // 5. Audit GET /reports/dashboard?shiftId=current
    // Expected cash drawer: 100,000 (base) + 25,000 (cash sale) - 15,000 (regular expense) = 110,000
    // INTERNAL_TRANSFER must NOT be deducted!
    const reportRes = await api.request('/reports/dashboard?shiftId=current', {
      headers: { Cookie: auth.adminCookie },
    });
    expect(reportRes.status).toBe(200);
    const reportData = await reportRes.json();
    expect(reportData.paymentMethods.CASH).toBe(25000);
    expect(reportData.paymentMethods.CARD).toBe(25000);
    expect(reportData.CONSOLIDATED.expenses).toBe(15000); // 20,000 INTERNAL_TRANSFER excluded!
    expect(reportData.cashReconciliation.expectedCash).toBe(110000);

    // 6. Audit GET /shifts/current
    const currentShiftRes = await api.request('/shifts/current', {
      headers: { Cookie: auth.cashierCookie },
    });
    expect(currentShiftRes.status).toBe(200);
    const currentShiftData = await currentShiftRes.json();
    expect(currentShiftData.realTimeTotals.initialCash).toBe(100000);
    expect(currentShiftData.realTimeTotals.cashSales).toBe(25000);
    expect(currentShiftData.realTimeTotals.cardSales).toBe(25000);
    expect(currentShiftData.realTimeTotals.expenses).toBe(15000);
    expect(currentShiftData.realTimeTotals.expectedCash).toBe(110000);

    // 7. Audit GET /shifts?shiftId=current
    const shiftsListRes = await api.request('/shifts?shiftId=current', {
      headers: { Cookie: auth.cashierCookie },
    });
    expect(shiftsListRes.status).toBe(200);
    const shiftsList = await shiftsListRes.json();
    expect(shiftsList.length).toBe(1);
    expect(shiftsList[0].expectedCash).toBe(110000);
    expect(shiftsList[0].totalExpenses).toBe(15000);

    // 8. Close shift with actualCash 110,000 (counted)
    const closeRes = await api.request('/shifts/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({ actualCash: 110000, notes: 'Cierre cuadrado perfecto' }),
    });
    expect(closeRes.status).toBe(200);
    const closeData = await closeRes.json();
    expect(closeData.report.expectedCash).toBe(110000);
    expect(closeData.report.difference).toBe(0);
  });
});
