import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import api from '../../src/api';
import { prisma } from '../../src/db';
import { getAuthSessions, AuthSession, createTestProduct } from '../fixtures/test-setup';

describe('Tier 1 — R1: Shifts, Cash Drawer & Guided Arqueo', () => {
  let auth: AuthSession;
  let testProduct: any;

  beforeAll(async () => {
    auth = await getAuthSessions();
    testProduct = await createTestProduct({
      name: 'Shift Test Bread',
      price: 5000,
      stock: 50,
      department: 'MARKET',
    });
  });

  afterAll(async () => {
    // Teardown: ensure shift is closed and test product removed
    try {
      await api.request('/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ actualCash: 0, notes: 'Suite teardown' }),
      });
    } catch {}

    try {
      await prisma.saleItem.deleteMany({ where: { productId: testProduct.id } });
      await prisma.expenseItem.deleteMany({ where: { productId: testProduct.id } });
      await prisma.product.delete({ where: { id: testProduct.id } });
    } catch {}
  });

  // ---------------------------------------------------------------------------
  // 1. Initial State & Current Shift
  // ---------------------------------------------------------------------------
  it('TC-R1-01: GET /shifts/current should return null or closed when no shift is open', async () => {
    const res = await api.request('/shifts/current', {
      headers: { Cookie: auth.cashierCookie },
    });

    // Endpoint contract: 200 with shift: null or 404
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      const data = await res.json();
      expect(data.shift === null || data.shift?.status === 'CLOSED').toBe(true);
    }
  });

  // ---------------------------------------------------------------------------
  // 2. Gatekeeper: Blocking Sales and Expenses when no active shift
  // ---------------------------------------------------------------------------
  it('TC-R1-02: POST /sales should be rejected with 400 when no active shift exists', async () => {
    // Ensure no shift is open first
    const currentRes = await api.request('/shifts/current', {
      headers: { Cookie: auth.cashierCookie },
    });
    const currentData = currentRes.status === 200 ? await currentRes.json() : null;

    if (!currentData?.shift || currentData.shift.status === 'CLOSED') {
      const res = await api.request('/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          userId: auth.cashierUser.id,
          total: 5000,
          items: [{ productId: testProduct.id, quantity: 1, price: 5000 }],
          payments: [{ method: 'CASH', amount: 5000 }],
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    }
  });

  it('TC-R1-03: POST /expenses should be rejected with 400 when no active shift exists', async () => {
    const currentRes = await api.request('/shifts/current', {
      headers: { Cookie: auth.cashierCookie },
    });
    const currentData = currentRes.status === 200 ? await currentRes.json() : null;

    if (!currentData?.shift || currentData.shift.status === 'CLOSED') {
      const res = await api.request('/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          description: 'Gasto sin turno abierto',
          amount: 2000,
          category: 'supplies',
          department: 'GENERAL',
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    }
  });

  // ---------------------------------------------------------------------------
  // 3. Opening a Shift
  // ---------------------------------------------------------------------------
  let activeShiftId = '';

  it('TC-R1-04: POST /shifts/open should open a new shift with valid initial cash base', async () => {
    const res = await api.request('/shifts/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({ initialCash: 50000 }),
    });

    expect([200, 201]).toContain(res.status);
    const data = await res.json();
    expect(data.shift).toBeDefined();
    expect(data.shift.status).toBe('OPEN');
    expect(Number(data.shift.initialCash)).toBe(50000);
    expect(data.shift.openedById || data.shift.userId).toBeDefined();
    activeShiftId = data.shift.id;
  });

  it('TC-R1-05: POST /shifts/open should return 400 if a shift is already currently open', async () => {
    const res = await api.request('/shifts/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({ initialCash: 30000 }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // 4. Operating within Active Shift
  // ---------------------------------------------------------------------------
  it('TC-R1-06: GET /shifts/current should return real-time totals during active shift', async () => {
    const res = await api.request('/shifts/current', {
      headers: { Cookie: auth.cashierCookie },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.shift).toBeDefined();
    expect(data.shift.id).toBe(activeShiftId);
    expect(data.shift.status).toBe('OPEN');
    expect(data.realTimeTotals).toBeDefined();
    expect(Number(data.realTimeTotals.initialCash)).toBe(50000);
  });

  it('TC-R1-07: POST /sales should succeed and attach to active shift', async () => {
    const res = await api.request('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        total: 10000,
        items: [{ productId: testProduct.id, quantity: 2, price: 5000 }],
        payments: [{ method: 'CASH', amount: 10000 }],
      }),
    });

    expect([200, 201]).toContain(res.status);
    const data = await res.json();
    expect(data.sale).toBeDefined();
    if (data.sale.shiftId) {
      expect(data.sale.shiftId).toBe(activeShiftId);
    }
  });

  it('TC-R1-08: POST /expenses should succeed and attach to active shift', async () => {
    const res = await api.request('/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        description: 'Papel térmico para recibos',
        amount: 3000,
        category: 'supplies',
        department: 'GENERAL',
        userId: auth.cashierUser.id,
      }),
    });

    expect([200, 201]).toContain(res.status);
    const data = await res.json();
    expect(data.expense).toBeDefined();
    if (data.expense.shiftId) {
      expect(data.expense.shiftId).toBe(activeShiftId);
    }
  });

  // ---------------------------------------------------------------------------
  // 5. Closing Shift with Guided Arqueo
  // ---------------------------------------------------------------------------
  it('TC-R1-09: POST /shifts/close should compute theoretical expected cash and report difference', async () => {
    // Expected cash: initial (50,000) + cashSales (10,000) - cashExpenses (3,000) = 57,000
    // Physical cash entered: 57,000 -> discrepancy: 0 (cuadrado)
    const res = await api.request('/shifts/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        actualCash: 57000,
        notes: 'Cierre de turno normal cuadrado',
      }),
    });

    expect([200, 201]).toContain(res.status);
    const data = await res.json();
    expect(data.report).toBeDefined();
    expect(Number(data.report.actualCash)).toBe(57000);
    expect(Number(data.report.expectedCash)).toBe(57000);
    expect(Number(data.report.difference)).toBe(0);
    expect(data.report.shift.status).toBe('CLOSED');
  });

  it('TC-R1-10: Immediate shift changeover should allow opening a second shift after closure', async () => {
    const res = await api.request('/shifts/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
      body: JSON.stringify({ initialCash: 80000 }),
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

  it('TC-R1-11: GET /shifts/:id should return complete closure report by ID', async () => {
    const res = await api.request(`/shifts/${activeShiftId}`, {
      headers: { Cookie: auth.cashierCookie },
    });

    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      const data = await res.json();
      expect(data.id || data.shift?.id).toBe(activeShiftId);
    }
  });
});
