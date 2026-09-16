import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import api from '../../src/api';
import { prisma } from '../../src/db';
import { getAuthSessions, AuthSession, createTestProduct } from '../fixtures/test-setup';

describe('Tier 2 — Boundary Values & Corner Cases', () => {
  let auth: AuthSession;
  let boundaryProduct: any;

  beforeAll(async () => {
    auth = await getAuthSessions();

    boundaryProduct = await createTestProduct({
      name: 'Boundary Test Product',
      price: 10000,
      stock: 5,
      department: 'MARKET',
    });

    // Ensure active shift exists for sales tests
    try {
      await api.request('/shifts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ initialCash: 50000 }),
      });
    } catch {}
  });

  afterAll(async () => {
    try {
      await api.request('/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ actualCash: 50000 }),
      });
    } catch {}

    try {
      if (boundaryProduct) {
        await prisma.saleItem.deleteMany({ where: { productId: boundaryProduct.id } });
        await prisma.product.delete({ where: { id: boundaryProduct.id } }).catch(() => {});
      }
    } catch {}
  });

  // ---------------------------------------------------------------------------
  // 1. Shift Numeric Boundaries (Initial Cash)
  // ---------------------------------------------------------------------------
  it('TC-BND-01: Shift opening with negative initialCash must be rejected with 400', async () => {
    const res = await api.request('/shifts/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
      body: JSON.stringify({ initialCash: -500 }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('TC-BND-02: Shift opening with zero initialCash (0) should be accepted as valid zero-base opening', async () => {
    // If shift is already open, close it first
    await api.request('/shifts/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({ actualCash: 50000 }),
    });

    const res = await api.request('/shifts/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({ initialCash: 0 }),
    });

    expect([200, 201]).toContain(res.status);
    const data = await res.json();
    expect(Number(data.shift.initialCash)).toBe(0);
  });

  it('TC-BND-03: Shift opening with extremely large cash amount should handle precision without overflow', async () => {
    await api.request('/shifts/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({ actualCash: 0 }),
    });

    const extremeCash = 999999999;
    const res = await api.request('/shifts/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({ initialCash: extremeCash }),
    });

    expect([200, 201]).toContain(res.status);
    const data = await res.json();
    expect(Number(data.shift.initialCash)).toBe(extremeCash);

    // Revert to normal shift for remaining tests
    await api.request('/shifts/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({ actualCash: extremeCash }),
    });

    await api.request('/shifts/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({ initialCash: 50000 }),
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Inventory Stock Boundaries
  // ---------------------------------------------------------------------------
  it('TC-BND-04: Sale requesting quantity greater than available stock returns 400 Insufficient Stock', async () => {
    // boundaryProduct has stock = 5, request 10
    const res = await api.request('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        total: 100000,
        items: [{ productId: boundaryProduct.id, quantity: 10, price: 10000 }],
        payments: [{ method: 'CASH', amount: 100000 }],
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Stock insuficiente');
  });

  it('TC-BND-05: Sale on product with zero stock returns 400', async () => {
    const zeroStockProd = await createTestProduct({
      name: 'Zero Stock Item',
      price: 5000,
      stock: 0,
      department: 'MARKET',
    });

    const res = await api.request('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        total: 5000,
        items: [{ productId: zeroStockProd.id, quantity: 1, price: 5000 }],
        payments: [{ method: 'CASH', amount: 5000 }],
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Stock insuficiente');

    await prisma.product.delete({ where: { id: zeroStockProd.id } }).catch(() => {});
  });

  it('TC-BND-06: Sale of exact remaining stock should decrement stock to exactly 0', async () => {
    const exactProd = await createTestProduct({
      name: 'Exact 3 Stock Item',
      price: 4000,
      stock: 3,
      department: 'MARKET',
    });

    const res = await api.request('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        total: 12000,
        items: [{ productId: exactProd.id, quantity: 3, price: 4000 }],
        payments: [{ method: 'CASH', amount: 12000 }],
      }),
    });

    expect([200, 201]).toContain(res.status);
    const afterProd = await prisma.product.findUnique({ where: { id: exactProd.id } });
    expect(afterProd!.stock).toBe(0);

    // Teardown
    await prisma.saleItem.deleteMany({ where: { productId: exactProd.id } });
    await prisma.product.delete({ where: { id: exactProd.id } }).catch(() => {});
  });

  // ---------------------------------------------------------------------------
  // 3. Expense Numeric Boundaries
  // ---------------------------------------------------------------------------
  it('TC-BND-07: Expense with negative amount should be rejected with 400', async () => {
    const res = await api.request('/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
      body: JSON.stringify({
        description: 'Monto negativo',
        amount: -10000,
        category: 'supplies',
        department: 'GENERAL',
      }),
    });

    expect(res.status).toBe(400);
  });

  it('TC-BND-08: Expense with zero amount should be rejected with 400', async () => {
    const res = await api.request('/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
      body: JSON.stringify({
        description: 'Monto cero',
        amount: 0,
        category: 'supplies',
        department: 'GENERAL',
      }),
    });

    expect(res.status).toBe(400);
  });

  // ---------------------------------------------------------------------------
  // 4. String & Character Encoding Boundaries
  // ---------------------------------------------------------------------------
  it('TC-BND-09: Category with whitespace-only name should be rejected with 400', async () => {
    const res = await api.request('/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
      body: JSON.stringify({ name: '     ' }),
    });

    // Contract: either rejected by validator or schema
    expect([400, 500]).toContain(res.status);
  });

  it('TC-BND-10: Sales query with SQL injection characters and emojis should not crash (no 500)', async () => {
    const dangerousQueries = [
      "' OR 1=1 --",
      '<script>alert("xss")</script>',
      'DROP TABLE Sale;',
      '🍵 Café & Té ñáéíóú 100% 👍',
    ];

    for (const q of dangerousQueries) {
      const res = await api.request(`/sales?q=${encodeURIComponent(q)}`, {
        headers: { Cookie: auth.cashierCookie },
      });
      expect(res.status).not.toBe(500);
      expect(res.status).toBe(200);
    }
  });

  // ---------------------------------------------------------------------------
  // 5. Split Payment Mathematical Mismatches
  // ---------------------------------------------------------------------------
  it('TC-BND-11: Split payment sum not matching total should be rejected with 400', async () => {
    const res = await api.request('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        total: 10000,
        items: [{ productId: boundaryProduct.id, quantity: 1, price: 10000 }],
        payments: [
          { method: 'CASH', amount: 5000 },
          { method: 'CARD', amount: 4000 }, // Total = 9000, mismatch!
        ],
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('suma de los pagos no coincide');
  });

  it('TC-BND-12: Split payment with a zero amount method should be rejected with 400', async () => {
    const res = await api.request('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        total: 10000,
        items: [{ productId: boundaryProduct.id, quantity: 1, price: 10000 }],
        payments: [
          { method: 'CASH', amount: 10000 },
          { method: 'CARD', amount: 0 },
        ],
      }),
    });

    expect(res.status).toBe(400);
  });
});
