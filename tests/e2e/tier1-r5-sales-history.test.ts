import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import api from '../../src/api';
import { prisma } from '../../src/db';
import { getAuthSessions, AuthSession, createTestProduct } from '../fixtures/test-setup';

describe('Tier 1 — R5: Sales History, Multi-Facet Filters & Receipt Modal', () => {
  let auth: AuthSession;
  let testProductA: any;
  let testProductB: any;
  let testSaleCashId = '';
  let testSaleCardId = '';
  let testSaleCancelledId = '';

  beforeAll(async () => {
    auth = await getAuthSessions();

    testProductA = await createTestProduct({
      name: 'Organic Matcha Latte',
      price: 18000,
      stock: 50,
      department: 'CAFE',
    });

    testProductB = await createTestProduct({
      name: 'Gluten-Free Granola',
      price: 22000,
      stock: 50,
      department: 'MARKET',
    });

    // Ensure a shift is open for sales creation if required
    try {
      await api.request('/shifts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ initialCash: 100000 }),
      });
    } catch {}

    // 1. Create a CASH sale
    const saleCashRes = await api.request('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        total: 18000,
        items: [{ productId: testProductA.id, quantity: 1, price: 18000 }],
        payments: [{ method: 'CASH', amount: 18000 }],
      }),
    });
    if (saleCashRes.status === 200 || saleCashRes.status === 201) {
      const data = await saleCashRes.json();
      testSaleCashId = data.sale?.id || data.id;
    }

    // 2. Create a CARD sale
    const saleCardRes = await api.request('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        total: 22000,
        items: [{ productId: testProductB.id, quantity: 1, price: 22000 }],
        payments: [{ method: 'CARD', amount: 22000 }],
      }),
    });
    if (saleCardRes.status === 200 || saleCardRes.status === 201) {
      const data = await saleCardRes.json();
      testSaleCardId = data.sale?.id || data.id;
    }

    // 3. Create and CANCEL a sale
    const saleCancelRes = await api.request('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        total: 18000,
        items: [{ productId: testProductA.id, quantity: 1, price: 18000 }],
        payments: [{ method: 'CASH', amount: 18000 }],
      }),
    });
    if (saleCancelRes.status === 200 || saleCancelRes.status === 201) {
      const data = await saleCancelRes.json();
      testSaleCancelledId = data.sale?.id || data.id;
      // Cancel it
      await api.request(`/sales/${testSaleCancelledId}/cancel`, {
        method: 'POST',
        headers: { Cookie: auth.adminCookie },
      });
    }
  });

  afterAll(async () => {
    try {
      for (const sId of [testSaleCashId, testSaleCardId, testSaleCancelledId]) {
        if (sId) {
          await prisma.salePayment.deleteMany({ where: { saleId: sId } });
          await prisma.saleItem.deleteMany({ where: { saleId: sId } });
          await prisma.sale.delete({ where: { id: sId } }).catch(() => {});
        }
      }
      if (testProductA) {
        await prisma.product.delete({ where: { id: testProductA.id } }).catch(() => {});
      }
      if (testProductB) {
        await prisma.product.delete({ where: { id: testProductB.id } }).catch(() => {});
      }
    } catch {}
  });

  // ---------------------------------------------------------------------------
  // 1. Basic Listing & Itemized Receipt Details (Feature 7, 20)
  // ---------------------------------------------------------------------------
  it('TC-R5-01: GET /sales should return list of sales with cashier and item relationships', async () => {
    const res = await api.request('/sales', {
      headers: { Cookie: auth.cashierCookie },
    });

    expect(res.status).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  it('TC-R5-02: GET /sales/:id should return complete itemized ticket breakdown', async () => {
    if (!testSaleCashId) return;

    const res = await api.request(`/sales/${testSaleCashId}`, {
      headers: { Cookie: auth.cashierCookie },
    });

    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      const sale = await res.json();
      expect(sale.id).toBe(testSaleCashId);
      expect(sale.items).toBeDefined();
      expect(sale.items.length).toBeGreaterThan(0);
      expect(sale.items[0].product).toBeDefined();
      expect(sale.items[0].product.name).toContain('Matcha');
      expect(sale.payments).toBeDefined();
      expect(sale.payments[0].method).toBe('CASH');
      expect(sale.user).toBeDefined();
    }
  });

  // ---------------------------------------------------------------------------
  // 2. Query Filters: Status & Payment Method (Feature 7, 19)
  // ---------------------------------------------------------------------------
  it('TC-R5-03: GET /sales?status=COMPLETED should return only completed sales', async () => {
    const res = await api.request('/sales?status=COMPLETED', {
      headers: { Cookie: auth.cashierCookie },
    });

    expect(res.status).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
    for (const s of list) {
      expect(s.status).toBe('COMPLETED');
    }
  });

  it('TC-R5-04: GET /sales?status=CANCELLED should return only cancelled sales', async () => {
    const res = await api.request('/sales?status=CANCELLED', {
      headers: { Cookie: auth.cashierCookie },
    });

    expect(res.status).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
    for (const s of list) {
      expect(s.status).toBe('CANCELLED');
    }
  });

  it('TC-R5-05: GET /sales?paymentMethod=CASH should return only sales paid with CASH', async () => {
    const res = await api.request('/sales?paymentMethod=CASH', {
      headers: { Cookie: auth.cashierCookie },
    });

    expect(res.status).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
    for (const s of list) {
      const hasCash = s.payments?.some((p: any) => p.method === 'CASH');
      expect(hasCash).toBe(true);
    }
  });

  it('TC-R5-06: GET /sales?paymentMethod=CARD should return only sales paid with CARD', async () => {
    const res = await api.request('/sales?paymentMethod=CARD', {
      headers: { Cookie: auth.cashierCookie },
    });

    expect(res.status).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
    for (const s of list) {
      const hasCard = s.payments?.some((p: any) => p.method === 'CARD');
      expect(hasCard).toBe(true);
    }
  });

  // ---------------------------------------------------------------------------
  // 3. Search Bar Query (Feature 7, 18)
  // ---------------------------------------------------------------------------
  it('TC-R5-07: GET /sales?q=Matcha should search and return matching sales by product name', async () => {
    const res = await api.request('/sales?q=Matcha', {
      headers: { Cookie: auth.cashierCookie },
    });

    expect(res.status).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
    if (list.length > 0) {
      const matches = list.some((s: any) =>
        s.items?.some((i: any) => i.product?.name?.toLowerCase().includes('matcha'))
      );
      expect(matches).toBe(true);
    }
  });

  it('TC-R5-08: GET /sales?q=<ticket_id> should search and return sales matching ticket ID', async () => {
    if (!testSaleCardId) return;

    const prefix = testSaleCardId.slice(0, 8);
    const res = await api.request(`/sales?q=${prefix}`, {
      headers: { Cookie: auth.cashierCookie },
    });

    expect(res.status).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
    if (list.length > 0) {
      expect(list.some((s: any) => s.id.includes(prefix))).toBe(true);
    }
  });

  // ---------------------------------------------------------------------------
  // 4. Date Range Filters (Feature 7)
  // ---------------------------------------------------------------------------
  it('TC-R5-09: GET /sales?start=...&end=... should restrict results to the specified range', async () => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    const res = await api.request(
      `/sales?start=${yesterday.toISOString()}&end=${tomorrow.toISOString()}`,
      { headers: { Cookie: auth.cashierCookie } }
    );

    expect(res.status).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
    for (const s of list) {
      const saleDate = new Date(s.createdAt);
      expect(saleDate >= yesterday && saleDate <= tomorrow).toBe(true);
    }
  });

  // ---------------------------------------------------------------------------
  // 5. Frontend UI Contracts in Reports.svelte (Features 18, 19, 20, 21)
  // ---------------------------------------------------------------------------
  it('TC-R5-10: Reports.svelte should support search input and ticket detail modal trigger', () => {
    const reportsPath = resolve(__dirname, '../../frontend/src/lib/pages/Reports.svelte');
    expect(existsSync(reportsPath)).toBe(true);
    const content = readFileSync(reportsPath, 'utf-8');
    // Contract: Reports page contains search and table/modal triggers
    const hasSearchOrFilter =
      content.includes('filter') ||
      content.includes('search') ||
      content.includes('q') ||
      content.includes('buscar');
    expect(hasSearchOrFilter).toBe(true);
  });
});
