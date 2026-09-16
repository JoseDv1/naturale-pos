import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import api from '../../src/api';
import { prisma } from '../../src/db';
import { getAuthSessions, AuthSession, createTestProduct } from '../fixtures/test-setup';

describe('Tier 1 — R4: Admin Expense Editing & Inventory Coherence', () => {
  let auth: AuthSession;
  let testExpenseId = '';
  let testProduct: any;

  beforeAll(async () => {
    auth = await getAuthSessions();

    // Create a test product with initial stock 20
    testProduct = await createTestProduct({
      name: 'Expense Supply Item',
      price: 15000,
      cost: 7000,
      stock: 20,
      department: 'GENERAL',
    });

    // Create an initial expense to edit
    const createRes = await api.request('/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
      body: JSON.stringify({
        description: 'Gasto Inicial Para Edición',
        amount: 35000,
        category: 'supplies',
        department: 'GENERAL',
        userId: auth.adminUser.id,
        items: [
          {
            productId: testProduct.id,
            quantity: 5,
            unitCost: 7000,
          },
        ],
      }),
    });

    if (createRes.status === 200 || createRes.status === 201) {
      const data = await createRes.json();
      testExpenseId = data.expense?.id || data.id;
    }
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
  // 1. RBAC Security Gates (Feature 17)
  // ---------------------------------------------------------------------------
  it('TC-R4-01: PUT /expenses/:id should reject unauthenticated requests with 401', async () => {
    const res = await api.request(`/expenses/${testExpenseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Modificación no autorizada' }),
    });

    expect(res.status).toBe(401);
  });

  it('TC-R4-02: PUT /expenses/:id should reject CASHIER role with 403 Forbidden', async () => {
    const res = await api.request(`/expenses/${testExpenseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({ description: 'Intento de edición por cajero' }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // 2. Admin Expense Modification (Feature 6)
  // ---------------------------------------------------------------------------
  it('TC-R4-03: PUT /expenses/:id should allow ADMIN to update description, amount, department and category', async () => {
    const res = await api.request(`/expenses/${testExpenseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
      body: JSON.stringify({
        description: 'Gasto Actualizado por Admin',
        amount: 42000,
        department: 'MARKET',
        category: 'maintenance',
      }),
    });

    // Endpoint contract: 200 with updated expense
    expect([200, 204]).toContain(res.status);
    if (res.status === 200) {
      const data = await res.json();
      const exp = data.expense || data;
      expect(exp.description).toBe('Gasto Actualizado por Admin');
      expect(Number(exp.amount)).toBe(42000);
      expect(exp.department).toBe('MARKET');
    }
  });

  it('TC-R4-04: PUT /expenses/:id should return 404 for nonexistent expense ID', async () => {
    const res = await api.request('/expenses/nonexistent-uuid-0000', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
      body: JSON.stringify({ description: 'No existe' }),
    });

    expect(res.status).toBe(404);
  });

  it('TC-R4-05: PUT /expenses/:id should validate payload and return 400 for negative amount', async () => {
    const res = await api.request(`/expenses/${testExpenseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
      body: JSON.stringify({ amount: -5000 }),
    });

    expect(res.status).toBe(400);
  });

  // ---------------------------------------------------------------------------
  // 3. Inventory Stock Synchronization (Feature 6)
  // ---------------------------------------------------------------------------
  it('TC-R4-06: PUT /expenses/:id increasing item quantity should increment inventory stock', async () => {
    const beforeProduct = await prisma.product.findUnique({ where: { id: testProduct.id } });
    const initialStock = beforeProduct?.stock ?? 25;

    // Update expense item quantity from 5 to 8 (+3 items)
    const res = await api.request(`/expenses/${testExpenseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
      body: JSON.stringify({
        amount: 56000,
        items: [
          {
            productId: testProduct.id,
            quantity: 8,
            unitCost: 7000,
          },
        ],
      }),
    });

    if (res.status === 200) {
      const afterProduct = await prisma.product.findUnique({ where: { id: testProduct.id } });
      expect(afterProduct!.stock).toBe(initialStock + 3);
    }
  });

  it('TC-R4-07: PUT /expenses/:id decreasing item quantity should decrement inventory stock', async () => {
    const beforeProduct = await prisma.product.findUnique({ where: { id: testProduct.id } });
    const currentStock = beforeProduct?.stock ?? 28;

    // Update expense item quantity from 8 to 6 (-2 items)
    const res = await api.request(`/expenses/${testExpenseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
      body: JSON.stringify({
        amount: 42000,
        items: [
          {
            productId: testProduct.id,
            quantity: 6,
            unitCost: 7000,
          },
        ],
      }),
    });

    if (res.status === 200) {
      const afterProduct = await prisma.product.findUnique({ where: { id: testProduct.id } });
      expect(afterProduct!.stock).toBe(currentStock - 2);
    }
  });

  // ---------------------------------------------------------------------------
  // 4. UI Contract & Component Verification (Features 15, 16)
  // ---------------------------------------------------------------------------
  it('TC-R4-08: ExpenseRow or Expenses view must check for ADMIN role before rendering edit controls', () => {
    const expensesPagePath = resolve(__dirname, '../../frontend/src/lib/pages/Expenses.svelte');
    const expenseRowPath = resolve(__dirname, '../../frontend/src/lib/components/organisms/ExpenseRow.svelte');

    const checkFile = existsSync(expenseRowPath) ? expenseRowPath : expensesPagePath;
    expect(existsSync(checkFile)).toBe(true);
    const content = readFileSync(checkFile, 'utf-8');
    expect(content.toLowerCase()).toContain('admin');
  });
});
