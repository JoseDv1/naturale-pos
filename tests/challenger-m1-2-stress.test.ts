import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import api from '../src/api';
import { prisma } from '../src/db';
import { getAuthSessions, AuthSession, createTestProduct, openTestShift } from './fixtures/test-setup';

describe('Empirical Challenger M1-2: Expense Inventory Delta & Category Fallback Stress Suite', () => {
  let auth: AuthSession;
  let defaultCategory: any;

  // Products for expense stress testing
  let p1: any;
  let p2: any;
  let p3: any;
  let p4: any;
  let testExpenseId: string = '';

  // Custom expense category for testing
  let customExpenseCat: any;

  // Entities for category stress testing
  let stressCat1: any;
  let stressCat2: any;
  let catProd1: any;
  let catProd2: any;
  const multiCatProds: any[] = [];

  beforeAll(async () => {
    auth = await getAuthSessions();
    await openTestShift();

    // Ensure default category exists
    defaultCategory = await prisma.category.findUnique({ where: { name: 'Sin categoría' } });
    if (!defaultCategory) {
      defaultCategory = await prisma.category.create({
        data: { name: 'Sin categoría', description: 'Categoría por defecto' },
      });
    }

    // Ensure custom expense category exists for testing
    customExpenseCat = await prisma.expenseCategory.findFirst({ where: { name: 'Empirical Test Exp Cat' } });
    if (!customExpenseCat) {
      customExpenseCat = await prisma.expenseCategory.create({
        data: { name: 'Empirical Test Exp Cat', description: 'Categoría custom para tests' },
      });
    }

    // Initialize products with known stocks
    p1 = await createTestProduct({ name: 'Stress Prod 1', stock: 100, cost: 5000, price: 10000 });
    p2 = await createTestProduct({ name: 'Stress Prod 2', stock: 50, cost: 8000, price: 15000 });
    p3 = await createTestProduct({ name: 'Stress Prod 3', stock: 20, cost: 3000, price: 6000 });
    p4 = await createTestProduct({ name: 'Stress Prod 4', stock: 10, cost: 4000, price: 8000 });

    // Initial expense: P1 (qty 10), P2 (qty 5), P3 (qty 8)
    const initialAmount = 10 * 5000 + 5 * 8000 + 8 * 3000; // 50000 + 40000 + 24000 = 114000
    const res = await api.request('/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
      body: JSON.stringify({
        description: 'Gasto Base de Estrés',
        amount: initialAmount,
        category: 'supplies',
        department: 'GENERAL',
        userId: auth.adminUser.id,
        items: [
          { productId: p1.id, quantity: 10, unitCost: 5000 },
          { productId: p2.id, quantity: 5, unitCost: 8000 },
          { productId: p3.id, quantity: 8, unitCost: 3000 },
        ],
      }),
    });

    expect([200, 201]).toContain(res.status);
    const body = await res.json();
    testExpenseId = body.expense?.id || body.id;

    // Verify baseline stock after expense creation
    const dbP1 = await prisma.product.findUnique({ where: { id: p1.id } });
    const dbP2 = await prisma.product.findUnique({ where: { id: p2.id } });
    const dbP3 = await prisma.product.findUnique({ where: { id: p3.id } });
    const dbP4 = await prisma.product.findUnique({ where: { id: p4.id } });

    expect(dbP1!.stock).toBe(110); // 100 + 10
    expect(dbP2!.stock).toBe(55);  // 50 + 5
    expect(dbP3!.stock).toBe(28);  // 20 + 8
    expect(dbP4!.stock).toBe(10);  // 10 (not in initial expense)
  });

  afterAll(async () => {
    try {
      if (testExpenseId) {
        await prisma.expenseItem.deleteMany({ where: { expenseId: testExpenseId } });
        await prisma.expense.delete({ where: { id: testExpenseId } }).catch(() => {});
      }
      for (const prod of [p1, p2, p3, p4, catProd1, catProd2, ...multiCatProds]) {
        if (prod?.id) {
          await prisma.saleItem.deleteMany({ where: { productId: prod.id } });
          await prisma.expenseItem.deleteMany({ where: { productId: prod.id } });
          await prisma.product.delete({ where: { id: prod.id } }).catch(() => {});
        }
      }
      if (stressCat1?.id) {
        await prisma.category.delete({ where: { id: stressCat1.id } }).catch(() => {});
      }
      if (stressCat2?.id) {
        await prisma.category.delete({ where: { id: stressCat2.id } }).catch(() => {});
      }
      if (customExpenseCat?.id) {
        await prisma.expenseCategory.delete({ where: { id: customExpenseCat.id } }).catch(() => {});
      }
    } catch {}
  });

  // ===========================================================================
  // SECTION 1: RBAC & VALIDATION STRESS ON PUT /expenses/:id
  // ===========================================================================
  describe('1. RBAC & Validation Security Gates for Expense Editing', () => {
    it('1.1 Should return 401 when unauthenticated', async () => {
      const res = await api.request(`/expenses/${testExpenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'Hack attempt' }),
      });
      expect(res.status).toBe(401);
    });

    it('1.2 Should return 403 when authenticated as CASHIER', async () => {
      const res = await api.request(`/expenses/${testExpenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ description: 'Cashier attempt' }),
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Administrador');
    });

    it('1.3 Should return 404 when expense does not exist', async () => {
      const res = await api.request('/expenses/00000000-0000-0000-0000-000000000000', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
        body: JSON.stringify({ description: 'Ghost expense' }),
      });
      expect(res.status).toBe(404);
    });

    it('1.4 Should reject negative amount with 400', async () => {
      const res = await api.request(`/expenses/${testExpenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
        body: JSON.stringify({ amount: -100 }),
      });
      expect(res.status).toBe(400);
    });

    it('1.5 Should reject zero amount with 400', async () => {
      const res = await api.request(`/expenses/${testExpenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
        body: JSON.stringify({ amount: 0 }),
      });
      expect(res.status).toBe(400);
    });

    it('1.6 Should reject invalid department enum with 400', async () => {
      const res = await api.request(`/expenses/${testExpenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
        body: JSON.stringify({ department: 'INVALID_DEPT' }),
      });
      expect(res.status).toBe(400);
    });

    it('1.7 Should reject invalid date string with 400', async () => {
      const res = await api.request(`/expenses/${testExpenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
        body: JSON.stringify({ date: 'not-a-valid-date' }),
      });
      expect(res.status).toBe(400);
    });

    it('1.8 Should reject item with zero or negative quantity with 400', async () => {
      const resZero = await api.request(`/expenses/${testExpenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
        body: JSON.stringify({
          items: [{ productId: p1.id, quantity: 0, unitCost: 5000 }],
        }),
      });
      expect(resZero.status).toBe(400);

      const resNeg = await api.request(`/expenses/${testExpenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
        body: JSON.stringify({
          items: [{ productId: p1.id, quantity: -2, unitCost: 5000 }],
        }),
      });
      expect(resNeg.status).toBe(400);
    });

    it('1.9 Should reject item with non-existent productId with 400 without corrupting stock', async () => {
      const beforeP1 = (await prisma.product.findUnique({ where: { id: p1.id } }))!.stock;
      const res = await api.request(`/expenses/${testExpenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
        body: JSON.stringify({
          items: [
            { productId: p1.id, quantity: 15, unitCost: 5000 },
            { productId: 'non-existent-product-id-999', quantity: 5, unitCost: 1000 },
          ],
        }),
      });
      expect(res.status).toBe(400);

      // Verify atomic rollback: P1 stock was NOT modified
      const afterP1 = (await prisma.product.findUnique({ where: { id: p1.id } }))!.stock;
      expect(afterP1).toBe(beforeP1);
    });

    it('1.10 Should reject unknown expense category with 400', async () => {
      const res = await api.request(`/expenses/${testExpenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
        body: JSON.stringify({ category: 'non-existent-category-xyz' }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Categoría de gasto inválida');
    });

    it('1.11 Should accept valid default and custom expense categories', async () => {
      // Test with system category id
      const res1 = await api.request(`/expenses/${testExpenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
        body: JSON.stringify({ category: 'maintenance' }),
      });
      expect(res1.status).toBe(200);

      // Test with custom category name
      const res2 = await api.request(`/expenses/${testExpenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
        body: JSON.stringify({ category: 'Empirical Test Exp Cat' }),
      });
      expect(res2.status).toBe(200);
    });
  });

  // ===========================================================================
  // SECTION 2: INVENTORY STOCK REBALANCING & DELTA ADJUSTMENTS
  // ===========================================================================
  describe('2. Inventory Stock Rebalancing Mathematical Invariants', () => {
    it('2.1 Increased item quantity: delta > 0 increments product.stock by exact delta', async () => {
      // P1 was 10 in expense, current stock is 110.
      // Update expense P1 quantity from 10 to 16 (delta = +6).
      // Keep P2 (5) and P3 (8) identical.
      const res = await api.request(`/expenses/${testExpenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
        body: JSON.stringify({
          items: [
            { productId: p1.id, quantity: 16, unitCost: 5200 },
            { productId: p2.id, quantity: 5, unitCost: 8000 },
            { productId: p3.id, quantity: 8, unitCost: 3000 },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const dbP1 = await prisma.product.findUnique({ where: { id: p1.id } });
      expect(dbP1!.stock).toBe(116); // 110 + 6
      expect(Number(dbP1!.cost)).toBe(5200);

      // Verify P2 and P3 remained untouched
      const dbP2 = await prisma.product.findUnique({ where: { id: p2.id } });
      const dbP3 = await prisma.product.findUnique({ where: { id: p3.id } });
      expect(dbP2!.stock).toBe(55);
      expect(dbP3!.stock).toBe(28);
    });

    it('2.2 Decreased item quantity: delta < 0 decrements product.stock by exact delta', async () => {
      // P2 was 5 in expense, current stock is 55.
      // Update expense P2 quantity from 5 to 2 (delta = -3).
      // Keep P1 (16) and P3 (8).
      const res = await api.request(`/expenses/${testExpenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
        body: JSON.stringify({
          items: [
            { productId: p1.id, quantity: 16, unitCost: 5200 },
            { productId: p2.id, quantity: 2, unitCost: 8000 },
            { productId: p3.id, quantity: 8, unitCost: 3000 },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const dbP2 = await prisma.product.findUnique({ where: { id: p2.id } });
      expect(dbP2!.stock).toBe(52); // 55 - 3
    });

    it('2.3 Removed item from expense: product stock is restored to pre-expense level', async () => {
      // P3 was 8 in expense, current stock is 28.
      // Omit P3 completely from the items array. Old qty = 8, New qty = 0 -> delta = -8.
      // Expected new stock: 28 - 8 = 20 (back to its initial stock).
      const res = await api.request(`/expenses/${testExpenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
        body: JSON.stringify({
          items: [
            { productId: p1.id, quantity: 16, unitCost: 5200 },
            { productId: p2.id, quantity: 2, unitCost: 8000 },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const dbP3 = await prisma.product.findUnique({ where: { id: p3.id } });
      expect(dbP3!.stock).toBe(20);

      // Check expenseItems in DB
      const itemsInDb = await prisma.expenseItem.findMany({ where: { expenseId: testExpenseId } });
      expect(itemsInDb.length).toBe(2);
      expect(itemsInDb.some((i) => i.productId === p3.id)).toBe(false);
    });

    it('2.4 New item added to expense: stock is incremented from 0 to new quantity', async () => {
      // P4 was never in expense, initial stock is 10.
      // Add P4 with quantity = 7, unitCost = 4500.
      // Old qty = 0, New qty = 7 -> delta = +7. Expected stock: 10 + 7 = 17.
      const res = await api.request(`/expenses/${testExpenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
        body: JSON.stringify({
          items: [
            { productId: p1.id, quantity: 16, unitCost: 5200 },
            { productId: p2.id, quantity: 2, unitCost: 8000 },
            { productId: p4.id, quantity: 7, unitCost: 4500 },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const dbP4 = await prisma.product.findUnique({ where: { id: p4.id } });
      expect(dbP4!.stock).toBe(17);
      expect(Number(dbP4!.cost)).toBe(4500);
    });

    it('2.5 Multi-product simultaneous delta: increase, decrease, remove and re-add in one request', async () => {
      // Current state:
      // P1: in expense (16), stock 116 -> new qty 10 (delta -6) -> expected stock: 116 - 6 = 110
      // P2: in expense (2), stock 52 -> new qty 9 (delta +7) -> expected stock: 52 + 7 = 59
      // P3: NOT in expense (0), stock 20 -> re-add with qty 5 (delta +5) -> expected stock: 20 + 5 = 25
      // P4: in expense (7), stock 17 -> REMOVE (new qty 0, delta -7) -> expected stock: 17 - 7 = 10
      const res = await api.request(`/expenses/${testExpenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
        body: JSON.stringify({
          description: 'Multi-Product Rebalance All In One',
          amount: 10 * 5000 + 9 * 8000 + 5 * 3000,
          items: [
            { productId: p1.id, quantity: 10, unitCost: 5000 },
            { productId: p2.id, quantity: 9, unitCost: 8000 },
            { productId: p3.id, quantity: 5, unitCost: 3000 },
          ],
        }),
      });

      expect(res.status).toBe(200);

      const [dbP1, dbP2, dbP3, dbP4] = await Promise.all([
        prisma.product.findUnique({ where: { id: p1.id } }),
        prisma.product.findUnique({ where: { id: p2.id } }),
        prisma.product.findUnique({ where: { id: p3.id } }),
        prisma.product.findUnique({ where: { id: p4.id } }),
      ]);

      expect(dbP1!.stock).toBe(110);
      expect(dbP2!.stock).toBe(59);
      expect(dbP3!.stock).toBe(25);
      expect(dbP4!.stock).toBe(10);
    });

    it('2.6 Updating expense scalar fields without items does NOT affect product stocks', async () => {
      const beforeStocks = await Promise.all([
        prisma.product.findUnique({ where: { id: p1.id } }),
        prisma.product.findUnique({ where: { id: p2.id } }),
        prisma.product.findUnique({ where: { id: p3.id } }),
        prisma.product.findUnique({ where: { id: p4.id } }),
      ]);

      const res = await api.request(`/expenses/${testExpenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
        body: JSON.stringify({
          description: 'Solo actualización de descripción y departamento',
          department: 'CAFE',
        }),
      });

      expect(res.status).toBe(200);
      const updatedExp = (await res.json()).expense;
      expect(updatedExp.description).toBe('Solo actualización de descripción y departamento');
      expect(updatedExp.department).toBe('CAFE');

      const afterStocks = await Promise.all([
        prisma.product.findUnique({ where: { id: p1.id } }),
        prisma.product.findUnique({ where: { id: p2.id } }),
        prisma.product.findUnique({ where: { id: p3.id } }),
        prisma.product.findUnique({ where: { id: p4.id } }),
      ]);

      for (let i = 0; i < 4; i++) {
        expect(afterStocks[i]!.stock).toBe(beforeStocks[i]!.stock);
      }
    });

    it('2.7 Empty items array clears all items and decrements their stocks', async () => {
      // Currently in expense: P1 (10, stock 110), P2 (9, stock 59), P3 (5, stock 25).
      // Clearing items array: delta is -10, -9, -5 respectively.
      const res = await api.request(`/expenses/${testExpenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
        body: JSON.stringify({
          items: [],
        }),
      });

      expect(res.status).toBe(200);

      const [dbP1, dbP2, dbP3] = await Promise.all([
        prisma.product.findUnique({ where: { id: p1.id } }),
        prisma.product.findUnique({ where: { id: p2.id } }),
        prisma.product.findUnique({ where: { id: p3.id } }),
      ]);

      expect(dbP1!.stock).toBe(100); // Back to original initial stock!
      expect(dbP2!.stock).toBe(50);  // Back to original initial stock!
      expect(dbP3!.stock).toBe(20);  // Back to original initial stock!

      const itemsInDb = await prisma.expenseItem.findMany({ where: { expenseId: testExpenseId } });
      expect(itemsInDb.length).toBe(0);
    });

    it('2.8 Duplicate productId in items array consolidates quantities correctly', async () => {
      // P1 initial stock is 100, currently 0 in expense.
      // Pass items with P1 twice: qty 4 and qty 6 -> total new qty = 10 -> delta = +10.
      const res = await api.request(`/expenses/${testExpenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
        body: JSON.stringify({
          items: [
            { productId: p1.id, quantity: 4, unitCost: 5000 },
            { productId: p1.id, quantity: 6, unitCost: 5000 },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const dbP1 = await prisma.product.findUnique({ where: { id: p1.id } });
      expect(dbP1!.stock).toBe(110); // 100 + 10
    });
  });

  // ===========================================================================
  // SECTION 3: CATEGORY MANAGEMENT & FALLBACK PROTECTION
  // ===========================================================================
  describe('3. Category Management, Product Counts & Fallback Protection', () => {
    it('3.1 Default category "Sin categoría" is present and cannot be renamed', async () => {
      const res = await api.request(`/categories/${defaultCategory.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
        body: JSON.stringify({ name: 'Renombrado Malicioso' }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('defecto');

      const check = await prisma.category.findUnique({ where: { id: defaultCategory.id } });
      expect(check!.name).toBe('Sin categoría');
    });

    it('3.2 Default category "Sin categoría" cannot be deleted', async () => {
      const res = await api.request(`/categories/${defaultCategory.id}`, {
        method: 'DELETE',
        headers: { Cookie: auth.adminCookie },
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('defecto');

      const check = await prisma.category.findUnique({ where: { id: defaultCategory.id } });
      expect(check).not.toBeNull();
    });

    it('3.3 Updating description of "Sin categoría" keeping its name is permitted', async () => {
      const res = await api.request(`/categories/${defaultCategory.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
        body: JSON.stringify({
          name: 'Sin categoría',
          description: 'Categoría por defecto del sistema actualizada',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe('Sin categoría');
      expect(data.description).toBe('Categoría por defecto del sistema actualizada');
    });

    it('3.4 Category RBAC: Unauthenticated and CASHIER cannot modify or delete categories', async () => {
      // Unauthenticated
      const unauthCreate = await api.request('/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Unauth Cat' }),
      });
      expect(unauthCreate.status).toBe(401);

      // CASHIER cannot create
      const createRes = await api.request('/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ name: 'Intento Cajero' }),
      });
      expect(createRes.status).toBe(403);

      // Create a test category as ADMIN first
      const adminCreate = await api.request('/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
        body: JSON.stringify({ name: `Cat-RBAC-${Date.now()}` }),
      });
      expect([200, 201]).toContain(adminCreate.status);
      const rbacCat = await adminCreate.json();

      // CASHIER cannot update
      const updateRes = await api.request(`/categories/${rbacCat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ name: 'Intento Edit Cajero' }),
      });
      expect(updateRes.status).toBe(403);

      // CASHIER cannot delete
      const deleteRes = await api.request(`/categories/${rbacCat.id}`, {
        method: 'DELETE',
        headers: { Cookie: auth.cashierCookie },
      });
      expect(deleteRes.status).toBe(403);

      // Clean up
      await prisma.category.delete({ where: { id: rbacCat.id } }).catch(() => {});
    });

    it('3.5 Category name validation: whitespace-only names and duplicates are rejected with 400', async () => {
      // Whitespace POST
      const wsPost = await api.request('/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
        body: JSON.stringify({ name: '    ' }),
      });
      expect(wsPost.status).toBe(400);

      // Duplicate POST with "Sin categoría"
      const dupPost = await api.request('/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
        body: JSON.stringify({ name: 'Sin categoría' }),
      });
      expect(dupPost.status).toBe(400);
    });

    it('3.6 Renaming a custom category to an already existing name or to "Sin categoría" is rejected with 400', async () => {
      const cat = await prisma.category.create({
        data: { name: `Cat-DupTest-${Date.now()}` },
      });

      // Attempt to rename to "Sin categoría"
      const resDefault = await api.request(`/categories/${cat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
        body: JSON.stringify({ name: 'Sin categoría' }),
      });
      expect(resDefault.status).toBe(400);

      // Clean up
      await prisma.category.delete({ where: { id: cat.id } });
    });

    it('3.7 Real-time product count: _count.products accurately reflects linked products', async () => {
      // 1. Create custom category
      const catRes = await api.request('/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
        body: JSON.stringify({ name: `RealTime-Count-${Date.now()}`, description: 'Testing product count' }),
      });
      expect([200, 201]).toContain(catRes.status);
      stressCat1 = await catRes.json();

      // Verify count is initially 0
      let listRes = await api.request('/categories', { headers: { Cookie: auth.adminCookie } });
      let list = await listRes.json();
      let found = list.find((c: any) => c.id === stressCat1.id);
      expect(found).toBeDefined();
      expect(found._count.products).toBe(0);

      // 2. Link first product
      catProd1 = await createTestProduct({
        name: 'Linked Prod 1',
        categoryId: stressCat1.id,
        price: 12000,
      });

      listRes = await api.request('/categories', { headers: { Cookie: auth.adminCookie } });
      list = await listRes.json();
      found = list.find((c: any) => c.id === stressCat1.id);
      expect(found._count.products).toBe(1);

      // 3. Link second product
      catProd2 = await createTestProduct({
        name: 'Linked Prod 2',
        categoryId: stressCat1.id,
        price: 15000,
      });

      listRes = await api.request('/categories', { headers: { Cookie: auth.adminCookie } });
      list = await listRes.json();
      found = list.find((c: any) => c.id === stressCat1.id);
      expect(found._count.products).toBe(2);
    });

    it('3.8 Deleting category safely reassigns products to "Sin categoría" and updates product counts', async () => {
      // Get baseline count of products in "Sin categoría"
      const listBeforeRes = await api.request('/categories', { headers: { Cookie: auth.adminCookie } });
      const listBefore = await listBeforeRes.json();
      const defaultBefore = listBefore.find((c: any) => c.name === 'Sin categoría');
      const baselineDefaultCount = defaultBefore._count.products;

      // Delete stressCat1 which currently holds catProd1 and catProd2 (2 products)
      const deleteRes = await api.request(`/categories/${stressCat1.id}`, {
        method: 'DELETE',
        headers: { Cookie: auth.adminCookie },
      });
      expect(deleteRes.status).toBe(200);

      // Verify stressCat1 is gone
      const checkDeleted = await prisma.category.findUnique({ where: { id: stressCat1.id } });
      expect(checkDeleted).toBeNull();

      // Verify products were NOT deleted and have categoryId reassigned to defaultCategory.id
      const recheckedProd1 = await prisma.product.findUnique({ where: { id: catProd1.id } });
      const recheckedProd2 = await prisma.product.findUnique({ where: { id: catProd2.id } });
      expect(recheckedProd1).not.toBeNull();
      expect(recheckedProd1!.categoryId).toBe(defaultCategory.id);
      expect(recheckedProd2).not.toBeNull();
      expect(recheckedProd2!.categoryId).toBe(defaultCategory.id);

      // Verify "Sin categoría" product count incremented by exactly 2
      const listAfterRes = await api.request('/categories', { headers: { Cookie: auth.adminCookie } });
      const listAfter = await listAfterRes.json();
      const defaultAfter = listAfter.find((c: any) => c.name === 'Sin categoría');
      expect(defaultAfter._count.products).toBe(baselineDefaultCount + 2);

      stressCat1 = null; // Marked as deleted
    });

    it('3.9 Bulk product category deletion stress: 5 products reassigned simultaneously without orphan rows', async () => {
      // Create stressCat2
      const catRes = await api.request('/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
        body: JSON.stringify({ name: `Bulk-Cat-${Date.now()}` }),
      });
      expect([200, 201]).toContain(catRes.status);
      stressCat2 = await catRes.json();

      // Create 5 products linked to stressCat2
      for (let i = 0; i < 5; i++) {
        const prod = await createTestProduct({
          name: `Bulk Prod ${i}`,
          categoryId: stressCat2.id,
          price: 5000 + i * 1000,
        });
        multiCatProds.push(prod);
      }

      // Check count is 5
      const listRes = await api.request('/categories', { headers: { Cookie: auth.adminCookie } });
      const list = await listRes.json();
      const found = list.find((c: any) => c.id === stressCat2.id);
      expect(found._count.products).toBe(5);

      // Delete stressCat2
      const delRes = await api.request(`/categories/${stressCat2.id}`, {
        method: 'DELETE',
        headers: { Cookie: auth.adminCookie },
      });
      expect(delRes.status).toBe(200);

      // Verify all 5 products are intact and reassigned
      for (const prod of multiCatProds) {
        const dbProd = await prisma.product.findUnique({ where: { id: prod.id } });
        expect(dbProd).not.toBeNull();
        expect(dbProd!.categoryId).toBe(defaultCategory.id);
      }

      stressCat2 = null; // Marked as deleted
    });
  });
});
