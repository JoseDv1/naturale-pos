import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import api from '../src/api';
import { prisma } from '../src/db';
import { getAuthSessions, AuthSession, createTestProduct, openTestShift } from './fixtures/test-setup';

describe('Milestone 1 — Admin Expense Editing & Inventory Coherence', () => {
  let auth: AuthSession;
  let testProduct: any;
  let testExpenseId: string = '';

  beforeAll(async () => {
    auth = await getAuthSessions();
    await openTestShift();

    // Create test product with initial stock 50
    testProduct = await createTestProduct({
      name: 'Inventory Expense Test Item',
      price: 20000,
      cost: 10000,
      stock: 50,
      department: 'MARKET',
    });

    // Create initial expense with 5 items
    const createRes = await api.request('/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
      body: JSON.stringify({
        description: 'Compra inicial de prueba',
        amount: 50000,
        category: 'supplies',
        department: 'MARKET',
        userId: auth.adminUser.id,
        items: [
          {
            productId: testProduct.id,
            quantity: 5,
            unitCost: 10000,
          },
        ],
      }),
    });

    expect([200, 201]).toContain(createRes.status);
    const body = await createRes.json();
    testExpenseId = body.expense?.id || body.id;

    // Stock was incremented by 5 during creation: 50 + 5 = 55
    const stockAfterCreate = (await prisma.product.findUnique({ where: { id: testProduct.id } }))!.stock;
    expect(stockAfterCreate).toBe(55);
  });

  afterAll(async () => {
    try {
      if (testExpenseId) {
        await prisma.expenseItem.deleteMany({ where: { expenseId: testExpenseId } });
        await prisma.expense.delete({ where: { id: testExpenseId } }).catch(() => {});
      }
      if (testProduct) {
        await prisma.saleItem.deleteMany({ where: { productId: testProduct.id } });
        await prisma.expenseItem.deleteMany({ where: { productId: testProduct.id } });
        await prisma.product.delete({ where: { id: testProduct.id } }).catch(() => {});
      }
    } catch {}
  });

  // ---------------------------------------------------------------------------
  // 1. RBAC Security Gates
  // ---------------------------------------------------------------------------
  it('PUT /expenses/:id should reject unauthenticated requests with 401', async () => {
    const res = await api.request(`/expenses/${testExpenseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Modificación sin auth' }),
    });

    expect(res.status).toBe(401);
  });

  it('PUT /expenses/:id should reject CASHIER role with 403', async () => {
    const res = await api.request(`/expenses/${testExpenseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({ description: 'Modificación por cajero' }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('PUT /expenses/:id should return 404 if expense does not exist', async () => {
    const res = await api.request('/expenses/non-existent-expense-id', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
      body: JSON.stringify({ description: 'Gasto inexistente' }),
    });

    expect(res.status).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // 2. Admin Expense Metadata Update
  // ---------------------------------------------------------------------------
  it('PUT /expenses/:id should allow ADMIN to update metadata fields', async () => {
    const res = await api.request(`/expenses/${testExpenseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
      body: JSON.stringify({
        description: 'Compra corregida por admin',
        amount: 55000,
        category: 'maintenance',
        department: 'GENERAL',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const updated = body.expense || body;
    expect(updated.description).toBe('Compra corregida por admin');
    expect(Number(updated.amount)).toBe(55000);
    expect(updated.category).toBe('maintenance');
    expect(updated.department).toBe('GENERAL');
  });

  // ---------------------------------------------------------------------------
  // 3. Inventory Stock Delta Reconciliation
  // ---------------------------------------------------------------------------
  it('PUT /expenses/:id with increased item quantity should increment stock by delta', async () => {
    // Current stock: 55 (initial 50 + 5 from creation)
    // Update quantity from 5 to 8 (delta = +3)
    // New stock should be 55 + 3 = 58
    const res = await api.request(`/expenses/${testExpenseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
      body: JSON.stringify({
        items: [
          {
            productId: testProduct.id,
            quantity: 8,
            unitCost: 10500,
          },
        ],
      }),
    });

    expect(res.status).toBe(200);
    const productAfter = await prisma.product.findUnique({ where: { id: testProduct.id } });
    expect(productAfter!.stock).toBe(58);
    expect(Number(productAfter!.cost)).toBe(10500);
  });

  it('PUT /expenses/:id with decreased item quantity should decrement stock by delta', async () => {
    // Current stock: 58
    // Update quantity from 8 to 6 (delta = -2)
    // New stock should be 58 - 2 = 56
    const res = await api.request(`/expenses/${testExpenseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
      body: JSON.stringify({
        items: [
          {
            productId: testProduct.id,
            quantity: 6,
            unitCost: 10500,
          },
        ],
      }),
    });

    expect(res.status).toBe(200);
    const productAfter = await prisma.product.findUnique({ where: { id: testProduct.id } });
    expect(productAfter!.stock).toBe(56);
  });
});
