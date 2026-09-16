import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import api from '../src/api';
import { prisma } from '../src/db';
import { getAuthSessions, AuthSession, createTestProduct, resetTestShifts, setSuiteIsLifecycle, openTestShift } from './fixtures/test-setup';

describe('Milestone 1 — Shifts, Cash Drawer & Guided Arqueo API', () => {
  let auth: AuthSession;
  let testProduct: any;
  let openedShiftId: string = '';

  beforeAll(async () => {
    auth = await getAuthSessions();
    await resetTestShifts();

    testProduct = await createTestProduct({
      name: 'Shift M1 Test Item',
      price: 10000,
      cost: 4000,
      stock: 50,
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
    } catch {}
    setSuiteIsLifecycle(false);
    await openTestShift();
  });

  // ---------------------------------------------------------------------------
  // 1. Initial State & Active Shift Gatekeeper
  // ---------------------------------------------------------------------------
  it('GET /shifts/current should return null shift when no shift is open', async () => {
    const res = await api.request('/shifts/current', {
      headers: { Cookie: auth.cashierCookie },
    });

    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      const data = await res.json();
      expect(data.shift === null || data.shift?.status === 'CLOSED').toBe(true);
    }
  });

  it('POST /sales should be rejected with 400 when no active shift exists', async () => {
    const res = await api.request('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        total: 10000,
        items: [{ productId: testProduct.id, quantity: 1, price: 10000 }],
        payments: [{ method: 'CASH', amount: 10000 }],
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('turno');
  });

  it('POST /expenses should be rejected with 400 when no active shift exists', async () => {
    const res = await api.request('/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        description: 'Gasto sin turno abierto',
        amount: 5000,
        category: 'supplies',
        department: 'GENERAL',
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('turno');
  });

  // ---------------------------------------------------------------------------
  // 2. Opening Shifts
  // ---------------------------------------------------------------------------
  it('POST /shifts/open should reject negative initial cash with 400', async () => {
    const res = await api.request('/shifts/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({ initialCash: -1000 }),
    });

    expect(res.status).toBe(400);
  });

  it('POST /shifts/open should successfully open a new shift', async () => {
    const res = await api.request('/shifts/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({ initialCash: 50000, notes: 'Apertura inicial turno 1' }),
    });

    expect([200, 201]).toContain(res.status);
    const data = await res.json();
    expect(data.shift).toBeDefined();
    expect(data.shift.status).toBe('OPEN');
    expect(Number(data.shift.initialCash)).toBe(50000);
    openedShiftId = data.shift.id;
  });

  it('POST /shifts/open should return 400 if a shift is already open', async () => {
    const res = await api.request('/shifts/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({ initialCash: 30000 }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('abierto');
  });

  // ---------------------------------------------------------------------------
  // 3. Operating with Active Shift & Real-Time Tracking
  // ---------------------------------------------------------------------------
  it('GET /shifts/current should return open shift and realTimeTotals', async () => {
    const res = await api.request('/shifts/current', {
      headers: { Cookie: auth.cashierCookie },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.shift).toBeDefined();
    expect(data.shift.id).toBe(openedShiftId);
    expect(data.shift.status).toBe('OPEN');
    expect(data.realTimeTotals).toBeDefined();
    expect(Number(data.realTimeTotals.initialCash)).toBe(50000);
  });

  it('POST /sales should attach shiftId to created sale', async () => {
    const res = await api.request('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        total: 20000,
        items: [{ productId: testProduct.id, quantity: 2, price: 10000 }],
        payments: [{ method: 'CASH', amount: 20000 }],
      }),
    });

    expect([200, 201]).toContain(res.status);
    const data = await res.json();
    expect(data.sale).toBeDefined();
    expect(data.sale.shiftId).toBe(openedShiftId);
  });

  it('POST /expenses should attach shiftId to created expense', async () => {
    const res = await api.request('/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        description: 'Compra de bolsas de papel',
        amount: 5000,
        category: 'supplies',
        department: 'GENERAL',
        userId: auth.cashierUser.id,
      }),
    });

    expect([200, 201]).toContain(res.status);
    const data = await res.json();
    expect(data.expense).toBeDefined();
    expect(data.expense.shiftId).toBe(openedShiftId);
  });

  // ---------------------------------------------------------------------------
  // 4. Closing Shift & Guided Arqueo Arithmetic
  // ---------------------------------------------------------------------------
  it('POST /shifts/close should compute theoretical cash and physical difference', async () => {
    // Initial cash = 50,000
    // Cash Sales = 20,000
    // Expenses = 5,000
    // Expected Cash = 50,000 + 20,000 - 5,000 = 65,000
    // Actual Cash entered = 64,500
    // Difference = 64,500 - 65,000 = -500 (faltante)
    const res = await api.request('/shifts/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        actualCash: 64500,
        notes: 'Cierre de prueba con faltante de 500',
      }),
    });

    expect([200, 201]).toContain(res.status);
    const data = await res.json();
    expect(data.report).toBeDefined();
    expect(data.report.shift.status).toBe('CLOSED');
    expect(Number(data.report.initialCash)).toBe(50000);
    expect(Number(data.report.expectedCash)).toBe(65000);
    expect(Number(data.report.actualCash)).toBe(64500);
    expect(Number(data.report.difference)).toBe(-500);
    expect(Number(data.report.totalSales)).toBe(20000);
    expect(Number(data.report.totalExpenses)).toBe(5000);
  });

  it('POST /shifts/close should return 400 if no shift is currently open', async () => {
    const res = await api.request('/shifts/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({ actualCash: 10000 }),
    });

    expect(res.status).toBe(400);
  });

  // ---------------------------------------------------------------------------
  // 5. Immediate Shift Changeover & Historical Reporting
  // ---------------------------------------------------------------------------
  it('Immediate shift changeover should succeed after closing', async () => {
    const res = await api.request('/shifts/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
      body: JSON.stringify({ initialCash: 80000, notes: 'Segundo turno inmediato' }),
    });

    expect([200, 201]).toContain(res.status);
    const data = await res.json();
    expect(data.shift.status).toBe('OPEN');
    expect(Number(data.shift.initialCash)).toBe(80000);

    // Clean up second shift
    await api.request('/shifts/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
      body: JSON.stringify({ actualCash: 80000 }),
    });
  });

  it('GET /shifts/:id should retrieve historical shift closure report', async () => {
    const res = await api.request(`/shifts/${openedShiftId}`, {
      headers: { Cookie: auth.cashierCookie },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    const shift = data.shift || data;
    expect(shift.id).toBe(openedShiftId);
    expect(shift.status).toBe('CLOSED');
    expect(Number(shift.expectedCash)).toBe(65000);
    expect(Number(shift.actualCash)).toBe(64500);
    expect(Number(shift.difference)).toBe(-500);
  });

  it('GET /shifts should list shifts with pagination', async () => {
    const res = await api.request('/shifts?limit=5', {
      headers: { Cookie: auth.adminCookie },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.shifts;
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });
});
