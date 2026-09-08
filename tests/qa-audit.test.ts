import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import api from '../src/api';
import { prisma } from '../src/db';

describe('Naturale POS v1.2.0 QA Comprehensive Pre-Release Test Suite', () => {
  let adminCookie = '';
  let cashierCookie = '';
  let adminUser: any = null;
  let cashierUser: any = null;

  beforeAll(async () => {
    // 1. Authenticate admin
    const adminLoginRes = await api.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', pin: '1234' }),
    });
    expect(adminLoginRes.status).toBe(200);
    const adminSetCookie = adminLoginRes.headers.get('set-cookie');
    expect(adminSetCookie).toBeTruthy();
    adminCookie = adminSetCookie!.split(';')[0];
    const adminBody = await adminLoginRes.json();
    adminUser = adminBody.user;

    // 2. Authenticate cashier
    const cashierLoginRes = await api.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'cajero', pin: '0000' }),
    });
    expect(cashierLoginRes.status).toBe(200);
    const cashierSetCookie = cashierLoginRes.headers.get('set-cookie');
    expect(cashierSetCookie).toBeTruthy();
    cashierCookie = cashierSetCookie!.split(';')[0];
    const cashierBody = await cashierLoginRes.json();
    cashierUser = cashierBody.user;
  });

  // ===========================================================================
  // 1. HEALTH & GATEKEEPER TESTS
  // ===========================================================================
  describe('1. Health & Gatekeeper Middleware', () => {
    it('GET /status should return 200 without authentication', async () => {
      const res = await api.request('/status');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('ok');
      expect(data.database).toBe('connected');
    });

    it('GET /products should return 401 when no token is provided', async () => {
      const res = await api.request('/products');
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain('No autorizado');
    });

    it('GET /products should return 401 when invalid token is provided', async () => {
      const res = await api.request('/products', {
        headers: { Cookie: 'jwt_auth=invalid.token.here' },
      });
      expect(res.status).toBe(401);
    });

    it('GET /users should be publicly accessible without authentication for login screens', async () => {
      const res = await api.request('/users');
      expect(res.status).toBe(200);
      const list = await res.json();
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // 2. AUTHENTICATION & RBAC TESTS
  // ===========================================================================
  describe('2. Authentication & Role-Based Access Control', () => {
    it('POST /auth/login should return 400 for empty payload', async () => {
      const res = await api.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it('POST /auth/login should return 401 for incorrect PIN', async () => {
      const res = await api.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', pin: 'wrongpin' }),
      });
      expect(res.status).toBe(401);
    });

    it('GET /auth/me should return authenticated user profile', async () => {
      const res = await api.request('/auth/me', {
        headers: { Cookie: adminCookie },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user).toBeDefined();
      expect(data.user.username).toBe('admin');
      expect(data.user.role).toBe('ADMIN');
    });

    it('Cashier should receive 403 Forbidden when accessing admin-only routes', async () => {
      const res = await api.request('/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({
          username: 'testcashier',
          name: 'Test',
          pin: '9999',
          role: 'CASHIER',
        }),
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('permisos de Administrador');
    });
  });

  // ===========================================================================
  // 3. CATEGORIES API TESTS
  // ===========================================================================
  describe('3. Categories Route Validation & Operations', () => {
    let createdCatId = '';

    it('POST /categories should validate required fields (400 on empty name)', async () => {
      const res = await api.request('/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ name: '' }),
      });
      expect(res.status).toBe(400);
    });

    it('POST /categories should successfully create a new category as ADMIN', async () => {
      const res = await api.request('/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          name: 'QA Test Category ' + Date.now(),
          description: 'Created during QA audit',
        }),
      });
      expect(res.status).toBe(200);
      const cat = await res.json();
      expect(cat.id).toBeDefined();
      createdCatId = cat.id;
    });

    it('PUT /categories/:id should return 404 for non-existent category', async () => {
      const res = await api.request('/categories/non-existent-uuid', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ name: 'Updated Name' }),
      });
      expect(res.status).toBe(404);
    });

    it('DELETE /categories/:id should return 404 for non-existent category', async () => {
      const res = await api.request('/categories/non-existent-uuid', {
        method: 'DELETE',
        headers: { Cookie: adminCookie },
      });
      expect(res.status).toBe(404);
    });

    it('DELETE /categories/:id should successfully delete category and reassign products', async () => {
      const res = await api.request(`/categories/${createdCatId}`, {
        method: 'DELETE',
        headers: { Cookie: adminCookie },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  // ===========================================================================
  // 4. PRODUCTS API TESTS
  // ===========================================================================
  describe('4. Products Route Validation & CRUD', () => {
    let createdProductId = '';
    let categoryId = '';

    beforeAll(async () => {
      const cat = await prisma.category.findFirst();
      categoryId = cat!.id;
    });

    it('POST /products should reject invalid department with 400', async () => {
      const res = await api.request('/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          name: 'Invalid Dept Product',
          price: 1000,
          cost: 500,
          categoryId,
          department: 'INVALID_DEPT',
        }),
      });
      expect(res.status).toBe(400);
    });

    it('POST /products should reject negative price or cost with 400', async () => {
      const res = await api.request('/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          name: 'Negative Price Product',
          price: -100,
          cost: 500,
          categoryId,
          department: 'MARKET',
        }),
      });
      expect(res.status).toBe(400);
    });

    it('POST /products should create product with auto-generated SKU if omitted', async () => {
      const res = await api.request('/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          name: 'QA Auto SKU Product ' + Date.now(),
          price: 12500,
          cost: 7000,
          stock: 25,
          categoryId,
          department: 'MARKET',
        }),
      });
      expect(res.status).toBe(200);
      const prod = await res.json();
      expect(prod.id).toBeDefined();
      expect(prod.sku).toBeDefined();
      expect(prod.sku.length).toBeGreaterThan(0);
      createdProductId = prod.id;
    });

    it('POST /products should enforce unique SKU (reject duplicate SKU with 400)', async () => {
      const prod = await prisma.product.findUnique({ where: { id: createdProductId } });
      const res = await api.request('/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          sku: prod!.sku,
          name: 'Duplicate SKU Product',
          price: 5000,
          cost: 2000,
          stock: 10,
          categoryId,
          department: 'MARKET',
        }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('ya existe');
    });

    it('PUT /products/:id should return 404 for non-existent product', async () => {
      const res = await api.request('/products/non-existent-product-id', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ name: 'Updated' }),
      });
      expect(res.status).toBe(404);
    });

    it('DELETE /products/:id should soft-delete product (set active: false)', async () => {
      const res = await api.request(`/products/${createdProductId}`, {
        method: 'DELETE',
        headers: { Cookie: adminCookie },
      });
      expect(res.status).toBe(200);
      const dbProd = await prisma.product.findUnique({ where: { id: createdProductId } });
      expect(dbProd?.active).toBe(false);
    });
  });

  // ===========================================================================
  // 5. FINANCIAL & INVENTORY AUDIT: SALES
  // ===========================================================================
  describe('5. Sales Financial & Inventory Transaction Logic', () => {
    let testProduct: any = null;
    let cafeInfiniteProduct: any = null;

    beforeAll(async () => {
      // Find or create test market product
      testProduct = await prisma.product.findFirst({
        where: { department: 'MARKET', active: true, stock: { gt: 10 } },
      });
      cafeInfiniteProduct = await prisma.product.findFirst({
        where: { department: 'CAFE', stock: { gte: 900 } },
      });
    });

    it('POST /sales should reject when items subtotal does not match total (400)', async () => {
      const res = await api.request('/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({
          userId: cashierUser.id,
          total: 50000, // Mismatched!
          items: [
            { productId: testProduct.id, quantity: 1, price: 30000 },
          ],
          payments: [
            { method: 'CASH', amount: 50000 },
          ],
        }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('subtotales');
    });

    it('POST /sales should reject when payments sum does not match total (400)', async () => {
      const res = await api.request('/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({
          userId: cashierUser.id,
          total: 30000,
          items: [
            { productId: testProduct.id, quantity: 1, price: 30000 },
          ],
          payments: [
            { method: 'CASH', amount: 25000 }, // Underpaid!
          ],
        }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('pagos');
    });

    it('POST /sales should reject with 400 when stock is insufficient', async () => {
      const res = await api.request('/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({
          userId: cashierUser.id,
          total: 9999990,
          items: [
            { productId: testProduct.id, quantity: 999999, price: 10 },
          ],
          payments: [
            { method: 'CASH', amount: 9999990 },
          ],
        }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Stock insuficiente');
    });

    it('POST /sales should process valid sale: decrement stock and record payments accurately', async () => {
      const initialStock = (await prisma.product.findUnique({ where: { id: testProduct.id } }))!.stock;
      const initialCafeStock = (await prisma.product.findUnique({ where: { id: cafeInfiniteProduct.id } }))!.stock;

      const saleTotal = 20000;
      const res = await api.request('/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({
          userId: cashierUser.id,
          total: saleTotal,
          items: [
            { productId: testProduct.id, quantity: 2, price: 7500 },
            { productId: cafeInfiniteProduct.id, quantity: 1, price: 5000 },
          ],
          payments: [
            { method: 'CASH', amount: 15000 },
            { method: 'CARD', amount: 5000 },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      const saleId = data.sale.id;

      // Verify stock decrement on regular product
      const updatedStock = (await prisma.product.findUnique({ where: { id: testProduct.id } }))!.stock;
      expect(updatedStock).toBe(initialStock - 2);

      // Verify cafe infinite product (stock >= 900) was NOT decremented
      const updatedCafeStock = (await prisma.product.findUnique({ where: { id: cafeInfiniteProduct.id } }))!.stock;
      expect(updatedCafeStock).toBe(initialCafeStock);

      // Cancel the sale and verify stock restoration
      const cancelRes = await api.request(`/sales/${saleId}/cancel`, {
        method: 'POST',
        headers: { Cookie: cashierCookie },
      });
      expect(cancelRes.status).toBe(200);

      const restoredStock = (await prisma.product.findUnique({ where: { id: testProduct.id } }))!.stock;
      expect(restoredStock).toBe(initialStock);

      // Verify trying to cancel again returns 400
      const cancelAgainRes = await api.request(`/sales/${saleId}/cancel`, {
        method: 'POST',
        headers: { Cookie: cashierCookie },
      });
      expect(cancelAgainRes.status).toBe(400);
    });
  });

  // ===========================================================================
  // 6. FINANCIAL AUDIT: EXPENSES
  // ===========================================================================
  describe('6. Expenses Logic & Inventory Cost Updates', () => {
    let testProduct: any = null;

    beforeAll(async () => {
      testProduct = await prisma.product.findFirst({
        where: { department: 'MARKET', active: true },
      });
    });

    it('POST /expenses should reject invalid category or department with 400', async () => {
      const res = await api.request('/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          description: 'Invalid expense test',
          amount: 5000,
          category: 'invalid_category',
          department: 'MARKET',
        }),
      });
      expect(res.status).toBe(400);
    });

    it('POST /expenses with items should increment stock and update product unitCost', async () => {
      const initialStock = (await prisma.product.findUnique({ where: { id: testProduct.id } }))!.stock;
      const newCost = 4500.5;

      const res = await api.request('/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          description: 'Compra de inventario QA',
          amount: newCost * 10,
          category: 'supplies',
          department: 'MARKET',
          userId: adminUser.id,
          items: [
            { productId: testProduct.id, quantity: 10, unitCost: newCost },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);

      const updated = await prisma.product.findUnique({ where: { id: testProduct.id } });
      expect(updated!.stock).toBe(initialStock + 10);
      expect(Number(updated!.cost)).toBe(newCost);

      // Revert stock change to keep DB clean
      await prisma.product.update({
        where: { id: testProduct.id },
        data: { stock: initialStock },
      });
    });
  });

  // ===========================================================================
  // 7. PRODUCT TRANSFERS & BALANCING
  // ===========================================================================
  describe('7. Product Transfers & Interdepartmental Financial Balancing', () => {
    let sourceProduct: any = null;
    let targetProduct: any = null;

    beforeAll(async () => {
      sourceProduct = await prisma.product.findFirst({
        where: { department: 'MARKET', stock: { gt: 5 }, active: true },
      });
      targetProduct = await prisma.product.findFirst({
        where: { department: 'CAFE', active: true, id: { not: sourceProduct.id } },
      });
    });

    it('POST /transfers should reject if fromDepartment equals toDepartment (400)', async () => {
      const res = await api.request('/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          productId: sourceProduct.id,
          quantity: 2,
          fromDepartment: 'MARKET',
          toDepartment: 'MARKET',
          userId: adminUser.id,
        }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('diferentes');
    });

    it('POST /transfers should reject with 400 if quantity exceeds available stock', async () => {
      const res = await api.request('/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          productId: sourceProduct.id,
          quantity: 999999,
          fromDepartment: 'MARKET',
          toDepartment: 'CAFE',
          userId: adminUser.id,
        }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Stock insuficiente');
    });

    it('POST /transfers should execute complete financial balancing (transfer log + expense + sale)', async () => {
      const initialSourceStock = (await prisma.product.findUnique({ where: { id: sourceProduct.id } }))!.stock;
      const initialTargetStock = (await prisma.product.findUnique({ where: { id: targetProduct.id } }))!.stock;
      const qty = 2;

      const res = await api.request('/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          productId: sourceProduct.id,
          targetProductId: targetProduct.id,
          quantity: qty,
          fromDepartment: 'MARKET',
          toDepartment: 'CAFE',
          userId: adminUser.id,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);

      // Verify stock shifts
      const newSourceStock = (await prisma.product.findUnique({ where: { id: sourceProduct.id } }))!.stock;
      expect(newSourceStock).toBe(initialSourceStock - qty);

      const newTargetStock = (await prisma.product.findUnique({ where: { id: targetProduct.id } }))!.stock;
      expect(newTargetStock).toBe(initialTargetStock + qty);

      // Verify receiving department Expense was logged
      const transferExpense = await prisma.expense.findFirst({
        where: { category: 'INTERNAL_TRANSFER', department: 'CAFE' },
        orderBy: { createdAt: 'desc' },
      });
      expect(transferExpense).toBeDefined();
      expect(Number(transferExpense!.amount)).toBe(qty * Number(sourceProduct.cost));

      // Verify sending department Sale was logged
      const transferSale = await prisma.sale.findFirst({
        where: { status: 'TRANSFER_OUT' },
        orderBy: { createdAt: 'desc' },
      });
      expect(transferSale).toBeDefined();
      expect(Number(transferSale!.total)).toBe(qty * Number(sourceProduct.cost));

      // Restore stock
      await prisma.product.update({
        where: { id: sourceProduct.id },
        data: { stock: initialSourceStock },
      });
      await prisma.product.update({
        where: { id: targetProduct.id },
        data: { stock: initialTargetStock },
      });
    });
  });

  // ===========================================================================
  // 8. TABLE MANAGEMENT & OCCUPANCY TRANSITIONS
  // ===========================================================================
  describe('8. Table Occupancy Lifecycle & State Transitions', () => {
    let testTable: any = null;
    let testProduct: any = null;

    beforeAll(async () => {
      // Find an available table or create one
      testTable = await prisma.cafeTable.findFirst({ where: { status: 'AVAILABLE' } });
      if (!testTable) {
        testTable = await prisma.cafeTable.create({
          data: { name: 'Mesa QA ' + Date.now(), status: 'AVAILABLE', x: 50, y: 50 },
        });
      }
      testProduct = await prisma.product.findFirst({
        where: { department: 'CAFE', stock: { gt: 10, lt: 900 } },
      }) || await prisma.product.findFirst({ where: { active: true } });
    });

    it('POST /tables/:id/open should return 404 for non-existent table', async () => {
      const res = await api.request('/tables/non-existent-table-id/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({ userId: cashierUser.id }),
      });
      expect(res.status).toBe(404);
    });

    it('POST /tables/:id/open transitions table from AVAILABLE to OCCUPIED with an OPEN sale', async () => {
      const res = await api.request(`/tables/${testTable.id}/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({ userId: cashierUser.id }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.table.status).toBe('OCCUPIED');
      expect(data.table.currentSaleId).toBeDefined();
      expect(data.sale.status).toBe('OPEN');
    });

    it('POST /tables/:id/open should reject opening an already OCCUPIED table with 400', async () => {
      const res = await api.request(`/tables/${testTable.id}/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({ userId: cashierUser.id }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('no está disponible');
    });

    it('PUT /tables/:id/save should reserve stock and update sale total', async () => {
      const initialStock = (await prisma.product.findUnique({ where: { id: testProduct.id } }))!.stock;
      const orderQuantity = 2;
      const itemPrice = 5000;

      const res = await api.request(`/tables/${testTable.id}/save`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({
          items: [
            { productId: testProduct.id, quantity: orderQuantity, price: itemPrice },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Number(data.sale.total)).toBe(orderQuantity * itemPrice);

      // Verify stock was decremented
      const newStock = (await prisma.product.findUnique({ where: { id: testProduct.id } }))!.stock;
      expect(newStock).toBe(initialStock - orderQuantity);
    });

    it('POST /tables/:id/checkout should reject mismatched payments with 400', async () => {
      const res = await api.request(`/tables/${testTable.id}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({
          payments: [{ method: 'CASH', amount: 1000 }], // Total is 10000!
        }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('coincide');
    });

    it('POST /tables/:id/checkout should complete sale and free the table to AVAILABLE', async () => {
      const res = await api.request(`/tables/${testTable.id}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({
          payments: [{ method: 'CASH', amount: 10000 }],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.sale.status).toBe('COMPLETED');

      // Verify table is now AVAILABLE and currentSaleId is null
      const table = await prisma.cafeTable.findUnique({ where: { id: testTable.id } });
      expect(table?.status).toBe('AVAILABLE');
      expect(table?.currentSaleId).toBeNull();
    });

    it('PUT /tables/:id/save with empty items array should cancel sale and free the table', async () => {
      // Re-open table
      await api.request(`/tables/${testTable.id}/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({ userId: cashierUser.id }),
      });

      // Save order with 1 item
      await api.request(`/tables/${testTable.id}/save`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({
          items: [{ productId: testProduct.id, quantity: 1, price: 5000 }],
        }),
      });

      // Save order with empty items array (clearing table)
      const clearRes = await api.request(`/tables/${testTable.id}/save`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({ items: [] }),
      });

      expect(clearRes.status).toBe(200);
      const table = await prisma.cafeTable.findUnique({ where: { id: testTable.id } });
      expect(table?.status).toBe('AVAILABLE');
      expect(table?.currentSaleId).toBeNull();
    });
  });

  // ===========================================================================
  // 9. REPORTS & DASHBOARD PRECISION TESTS
  // ===========================================================================
  describe('9. Reports Dashboard Math & Precision Audit', () => {
    it('GET /reports/dashboard returns valid numbers (no string concatenation or NaN)', async () => {
      const res = await api.request('/reports/dashboard', {
        headers: { Cookie: adminCookie },
      });
      expect(res.status).toBe(200);
      const data = await res.json();

      // Check structure
      expect(data.MARKET).toBeDefined();
      expect(data.CAFE).toBeDefined();
      expect(data.CONSOLIDATED).toBeDefined();
      expect(data.paymentMethods).toBeDefined();

      // Verify strict number types for all fields
      expect(typeof data.CONSOLIDATED.revenue).toBe('number');
      expect(typeof data.CONSOLIDATED.costOfSales).toBe('number');
      expect(typeof data.CONSOLIDATED.grossProfit).toBe('number');
      expect(typeof data.CONSOLIDATED.expenses).toBe('number');
      expect(typeof data.CONSOLIDATED.netProfit).toBe('number');

      // Verify no NaN values
      expect(isNaN(data.CONSOLIDATED.revenue)).toBe(false);
      expect(isNaN(data.CONSOLIDATED.expenses)).toBe(false);
      expect(isNaN(data.CONSOLIDATED.netProfit)).toBe(false);

      // Verify mathematical identity: Gross = Revenue - CostOfSales; Net = Gross - Expenses
      const expectedGross = data.CONSOLIDATED.revenue - data.CONSOLIDATED.costOfSales;
      expect(Math.abs(data.CONSOLIDATED.grossProfit - expectedGross)).toBeLessThanOrEqual(0.01);

      const expectedNet = data.CONSOLIDATED.grossProfit - data.CONSOLIDATED.expenses;
      expect(Math.abs(data.CONSOLIDATED.netProfit - expectedNet)).toBeLessThanOrEqual(0.01);

      // Verify payment methods are all numbers
      for (const [method, amount] of Object.entries(data.paymentMethods)) {
        expect(typeof amount).toBe('number');
        expect(isNaN(amount as number)).toBe(false);
      }
    });

    it('GET /reports/inventory-alerts returns list of low-stock products', async () => {
      const res = await api.request('/reports/inventory-alerts', {
        headers: { Cookie: adminCookie },
      });
      expect(res.status).toBe(200);
      const list = await res.json();
      expect(Array.isArray(list)).toBe(true);
      for (const item of list) {
        expect(item.stock).toBeLessThanOrEqual(3);
        expect(item.stock).toBeLessThan(900); // Infinite stock products excluded
      }
    });
  });
});
