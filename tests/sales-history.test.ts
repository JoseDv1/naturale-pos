import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import api from '../src/api';
import { prisma } from '../src/db';
import { getAuthSessions, AuthSession, createTestProduct, openTestShift } from './fixtures/test-setup';

describe('Milestone 1 — Sales History & Multi-Facet Filters API', () => {
  let auth: AuthSession;
  let productA: any;
  let productB: any;
  let saleCashId: string = '';
  let saleCardId: string = '';
  let saleTransferId: string = '';
  let saleCancelledId: string = '';

  beforeAll(async () => {
    auth = await getAuthSessions();
    await openTestShift();

    productA = await createTestProduct({
      name: 'Matcha Latte Bio',
      price: 12000,
      stock: 100,
      department: 'CAFE',
    });

    productB = await createTestProduct({
      name: 'Granola Almendra',
      price: 18000,
      stock: 100,
      department: 'MARKET',
    });

    // 1. Create CASH sale
    const cashRes = await api.request('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        total: 12000,
        items: [{ productId: productA.id, quantity: 1, price: 12000 }],
        payments: [{ method: 'CASH', amount: 12000 }],
      }),
    });
    const cashBody = await cashRes.json();
    saleCashId = cashBody.sale?.id || cashBody.id;

    // 2. Create CARD sale
    const cardRes = await api.request('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        total: 18000,
        items: [{ productId: productB.id, quantity: 1, price: 18000 }],
        payments: [{ method: 'CARD', amount: 18000 }],
      }),
    });
    const cardBody = await cardRes.json();
    saleCardId = cardBody.sale?.id || cardBody.id;

    // 3. Create TRANSFER sale
    const transRes = await api.request('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        total: 30000,
        items: [
          { productId: productA.id, quantity: 1, price: 12000 },
          { productId: productB.id, quantity: 1, price: 18000 },
        ],
        payments: [{ method: 'TRANSFER', amount: 30000 }],
      }),
    });
    const transBody = await transRes.json();
    saleTransferId = transBody.sale?.id || transBody.id;

    // 4. Create sale and cancel it
    const cancelTargetRes = await api.request('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        total: 12000,
        items: [{ productId: productA.id, quantity: 1, price: 12000 }],
        payments: [{ method: 'CASH', amount: 12000 }],
      }),
    });
    const cancelTargetBody = await cancelTargetRes.json();
    saleCancelledId = cancelTargetBody.sale?.id || cancelTargetBody.id;

    await api.request(`/sales/${saleCancelledId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
      body: JSON.stringify({ reason: 'Prueba de filtro de estado cancelado' }),
    });
  });

  afterAll(async () => {
    try {
      const saleIds = [saleCashId, saleCardId, saleTransferId, saleCancelledId].filter(Boolean);
      for (const id of saleIds) {
        await prisma.salePayment.deleteMany({ where: { saleId: id } });
        await prisma.saleItem.deleteMany({ where: { saleId: id } });
        await prisma.sale.delete({ where: { id: id } }).catch(() => {});
      }
      if (productA) {
        await prisma.product.delete({ where: { id: productA.id } }).catch(() => {});
      }
      if (productB) {
        await prisma.product.delete({ where: { id: productB.id } }).catch(() => {});
      }
    } catch {}
  });

  // ---------------------------------------------------------------------------
  // 1. Single Sale Retrieval (Feature 7)
  // ---------------------------------------------------------------------------
  it('GET /sales/:id should return complete sale details including items, payments, user', async () => {
    const res = await api.request(`/sales/${saleCashId}`, {
      headers: { Cookie: auth.cashierCookie },
    });

    expect(res.status).toBe(200);
    const sale = await res.json();
    expect(sale.id).toBe(saleCashId);
    expect(Number(sale.total)).toBe(12000);
    expect(sale.user).toBeDefined();
    expect(sale.items).toBeDefined();
    expect(sale.items.length).toBe(1);
    expect(sale.items[0].product.name).toBe('Matcha Latte Bio');
    expect(sale.payments).toBeDefined();
    expect(sale.payments.length).toBe(1);
    expect(sale.payments[0].method).toBe('CASH');
  });

  it('GET /sales/:id with non-existent id should return 404', async () => {
    const res = await api.request('/sales/non-existent-sale-uuid', {
      headers: { Cookie: auth.cashierCookie },
    });

    expect(res.status).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // 2. Status Filters
  // ---------------------------------------------------------------------------
  it('GET /sales?status=CANCELLED should return only cancelled sales', async () => {
    const res = await api.request('/sales?status=CANCELLED', {
      headers: { Cookie: auth.adminCookie },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.sales;
    expect(list.length).toBeGreaterThan(0);
    for (const sale of list) {
      expect(sale.status).toBe('CANCELLED');
    }
  });

  it('GET /sales?status=COMPLETED should return only completed sales', async () => {
    const res = await api.request('/sales?status=COMPLETED', {
      headers: { Cookie: auth.adminCookie },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.sales;
    expect(list.length).toBeGreaterThan(0);
    for (const sale of list) {
      expect(sale.status).toBe('COMPLETED');
    }
  });

  // ---------------------------------------------------------------------------
  // 3. Payment Method Filters
  // ---------------------------------------------------------------------------
  it('GET /sales?paymentMethod=CARD should return sales containing CARD payments', async () => {
    const res = await api.request('/sales?paymentMethod=CARD', {
      headers: { Cookie: auth.cashierCookie },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.sales;
    expect(list.length).toBeGreaterThan(0);
    const foundCardSale = list.find((s: any) => s.id === saleCardId);
    expect(foundCardSale).toBeDefined();
  });

  it('GET /sales?paymentMethod=TRANSFER should return sales containing TRANSFER payments', async () => {
    const res = await api.request('/sales?paymentMethod=TRANSFER', {
      headers: { Cookie: auth.cashierCookie },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.sales;
    const foundTransferSale = list.find((s: any) => s.id === saleTransferId);
    expect(foundTransferSale).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // 4. Text Search Query (q)
  // ---------------------------------------------------------------------------
  it('GET /sales?q=Matcha should search and return matching sales by product name', async () => {
    const res = await api.request('/sales?q=Matcha', {
      headers: { Cookie: auth.cashierCookie },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.sales;
    expect(list.length).toBeGreaterThan(0);
    const target = list.find((s: any) => s.id === saleCashId);
    expect(target).toBeDefined();
    expect(target.items.some((i: any) => i.product.name.includes('Matcha'))).toBe(true);
  });

  it('GET /sales?q=... should search and return matching sales by ticket ID prefix', async () => {
    const prefix = saleCardId.slice(0, 8);
    const res = await api.request(`/sales?q=${prefix}`, {
      headers: { Cookie: auth.cashierCookie },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.sales;
    expect(list.length).toBeGreaterThan(0);
    const target = list.find((s: any) => s.id === saleCardId);
    expect(target).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // 5. Date Range Filters (start & end)
  // ---------------------------------------------------------------------------
  it('GET /sales?start=...&end=... should filter sales within temporal boundaries', async () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const oneHourAhead = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

    const res = await api.request(`/sales?start=${encodeURIComponent(oneHourAgo)}&end=${encodeURIComponent(oneHourAhead)}`, {
      headers: { Cookie: auth.cashierCookie },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.sales;
    expect(list.length).toBeGreaterThan(0);
    const foundSale = list.find((s: any) => s.id === saleCashId);
    expect(foundSale).toBeDefined();
  });
});
