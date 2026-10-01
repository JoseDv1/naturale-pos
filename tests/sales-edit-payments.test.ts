import { describe, it, expect, beforeAll } from 'bun:test';
import api from '../src/api';
import { prisma } from '../src/db';
import { getAuthSessions, AuthSession, createTestProduct, openTestShift } from './fixtures/test-setup';

describe('Sales Payment Methods Edit API', () => {
  let auth: AuthSession;
  let product: any;
  let activeShiftSaleId: string = '';
  let cancelledSaleId: string = '';
  let closedShiftSaleId: string = '';

  beforeAll(async () => {
    auth = await getAuthSessions();
    await openTestShift();

    product = await createTestProduct({
      name: 'Café de Especialidad 250g',
      price: 25000,
      stock: 50,
      department: 'CAFE',
    });

    // 1. Create a normal CASH sale in active shift
    const res1 = await api.request('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        total: 25000,
        items: [{ productId: product.id, quantity: 1, price: 25000 }],
        payments: [{ method: 'CASH', amount: 25000 }],
      }),
    });
    const body1 = await res1.json();
    activeShiftSaleId = body1.sale?.id || body1.id;

    // 2. Create another sale and cancel it
    const res2 = await api.request('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        total: 25000,
        items: [{ productId: product.id, quantity: 1, price: 25000 }],
        payments: [{ method: 'CASH', amount: 25000 }],
      }),
    });
    const body2 = await res2.json();
    cancelledSaleId = body2.sale?.id || body2.id;
    await api.request(`/sales/${cancelledSaleId}/cancel`, {
      method: 'POST',
      headers: { Cookie: auth.cashierCookie },
    });
  });

  it('TC-SEP-01: GET /sales and GET /sales/:id must include shift object with status', async () => {
    const listRes = await api.request(`/sales?q=${activeShiftSaleId}`, {
      headers: { Cookie: auth.cashierCookie },
    });
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    const found = list.find((s: any) => s.id === activeShiftSaleId);
    expect(found).toBeDefined();
    expect(found.shift).toBeDefined();
    expect(found.shift.status).toBe('OPEN');

    const detailRes = await api.request(`/sales/${activeShiftSaleId}`, {
      headers: { Cookie: auth.cashierCookie },
    });
    expect(detailRes.status).toBe(200);
    const detail = await detailRes.json();
    expect(detail.shift).toBeDefined();
    expect(detail.shift.status).toBe('OPEN');
  });

  it('TC-SEP-02: Successfully update single payment method (CASH -> CARD) for open shift sale', async () => {
    const res = await api.request(`/sales/${activeShiftSaleId}/payments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        payments: [{ method: 'CARD', amount: 25000 }],
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.sale.payments.length).toBe(1);
    expect(body.sale.payments[0].method).toBe('CARD');
    expect(Number(body.sale.payments[0].amount)).toBe(25000);
  });

  it('TC-SEP-03: Successfully update with split payments (CASH + TRANSFER) matching sale total', async () => {
    const res = await api.request(`/sales/${activeShiftSaleId}/payments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        payments: [
          { method: 'CASH', amount: 10000 },
          { method: 'TRANSFER', amount: 15000 },
        ],
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.sale.payments.length).toBe(2);

    const cashPay = body.sale.payments.find((p: any) => p.method === 'CASH');
    const transferPay = body.sale.payments.find((p: any) => p.method === 'TRANSFER');
    expect(cashPay).toBeDefined();
    expect(Number(cashPay.amount)).toBe(10000);
    expect(transferPay).toBeDefined();
    expect(Number(transferPay.amount)).toBe(15000);
  });

  it('TC-SEP-04: Real-time shift metrics reflect updated payment breakdown', async () => {
    const shiftRes = await api.request('/shifts/current', {
      headers: { Cookie: auth.cashierCookie },
    });
    expect(shiftRes.status).toBe(200);
    const shiftData = await shiftRes.json();
    expect(shiftData.shift).toBeDefined();
    expect(shiftData.shift.status).toBe('OPEN');

    // In TC-SEP-03 we allocated 10,000 to cash and 15,000 to transfer
    expect(shiftData.realTimeTotals.cashSales).toBeGreaterThanOrEqual(10000);
    expect(shiftData.realTimeTotals.transferSales).toBeGreaterThanOrEqual(15000);
  });

  it('TC-SEP-05: Reject update when payment sum does not equal sale total', async () => {
    const res = await api.request(`/sales/${activeShiftSaleId}/payments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        payments: [{ method: 'CARD', amount: 20000 }], // Sale total is 25000!
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('no coincide con el total de la venta');
  });

  it('TC-SEP-06: Reject update when payment amount is zero or negative', async () => {
    const res = await api.request(`/sales/${activeShiftSaleId}/payments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        payments: [
          { method: 'CASH', amount: 0 },
          { method: 'CARD', amount: 25000 },
        ],
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('TC-SEP-07: Reject update when payments array is empty', async () => {
    const res = await api.request(`/sales/${activeShiftSaleId}/payments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        payments: [],
      }),
    });

    expect(res.status).toBe(400);
  });

  it('TC-SEP-08: Reject update for CANCELLED sale', async () => {
    const res = await api.request(`/sales/${cancelledSaleId}/payments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        payments: [{ method: 'CARD', amount: 25000 }],
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('cancelada');
  });

  it('TC-SEP-09: Reject update for sale belonging to a CLOSED shift', async () => {
    // 1. Close current shift
    const closeRes = await api.request('/shifts/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({ actualCash: 50000 }),
    });
    expect(closeRes.status).toBe(200);

    // activeShiftSaleId now belongs to a CLOSED shift
    const updateRes = await api.request(`/sales/${activeShiftSaleId}/payments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        payments: [{ method: 'INTERNAL', amount: 25000 }],
      }),
    });

    expect(updateRes.status).toBe(400);
    const body = await updateRes.json();
    expect(body.error).toContain('turno actualmente abierto');

    // Restore shift state for any subsequent test runs
    await openTestShift();
  });

  it('TC-SEP-10: Reject update with 404 when sale ID does not exist', async () => {
    const res = await api.request('/sales/00000000-0000-0000-0000-000000000000/payments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        payments: [{ method: 'CASH', amount: 25000 }],
      }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('no encontrada');
  });

  it('TC-SEP-11: Reject update with 400 when payment method is invalid enum', async () => {
    const res = await api.request(`/sales/${activeShiftSaleId}/payments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        payments: [{ method: 'CRYPTO', amount: 25000 }],
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('TC-SEP-12: Accept string payment amount and coerce to number', async () => {
    // Create a new sale in the reopened shift
    const createRes = await api.request('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        total: 25000,
        items: [{ productId: product.id, quantity: 1, price: 25000 }],
        payments: [{ method: 'CASH', amount: 25000 }],
      }),
    });
    const createBody = await createRes.json();
    const newSaleId = createBody.sale?.id || createBody.id;

    const res = await api.request(`/sales/${newSaleId}/payments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        payments: [{ method: 'CARD', amount: '25000' }],
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Number(body.sale.payments[0].amount)).toBe(25000);
    expect(body.sale.payments[0].method).toBe('CARD');
  });
});

