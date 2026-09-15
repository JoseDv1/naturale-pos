import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import api from '../src/api';
import { prisma } from '../src/db';

describe('Stock Editing & Expense Categories Test Suite', () => {
  let adminCookie = '';
  let cashierCookie = '';
  let adminUser: any = null;
  let testCategoryId = '';
  let singleProductId = '';
  let variantProductId = '';
  let variantAId = '';
  let variantBId = '';
  let createdCustomCatId = '';

  beforeAll(async () => {
    // 1. Authenticate admin
    const adminLoginRes = await api.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', pin: '1234' }),
    });
    expect(adminLoginRes.status).toBe(200);
    const adminSetCookie = adminLoginRes.headers.get('set-cookie');
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
    cashierCookie = cashierSetCookie!.split(';')[0];

    // 3. Category
    const cat = await prisma.category.findFirst();
    if (cat) {
      testCategoryId = cat.id;
    } else {
      const newCat = await prisma.category.create({
        data: { name: 'Stock Test Category' },
      });
      testCategoryId = newCat.id;
    }

    // 4. Create a single product (no variants)
    const singleProdRes = await api.request('/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        sku: `STOCK-SINGLE-${Date.now()}`,
        name: 'Producto Simple Para Stock',
        price: 15000,
        cost: 8000,
        stock: 5,
        categoryId: testCategoryId,
        department: 'MARKET',
      }),
    });
    expect(singleProdRes.status).toBe(200);
    const singleProd = await singleProdRes.json();
    singleProductId = singleProd.id;

    // 5. Create a product with variants
    const varProdRes = await api.request('/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        sku: `STOCK-VAR-${Date.now()}`,
        name: 'Producto Con Variantes Para Stock',
        price: 12000,
        cost: 6000,
        categoryId: testCategoryId,
        department: 'CAFE',
        variants: [
          { name: 'Chico', sku: `SKU-VARA-${Date.now()}`, price: 10000, cost: 5000, stock: 4 },
          { name: 'Grande', sku: `SKU-VARB-${Date.now()}`, price: 14000, cost: 7000, stock: 6 },
        ],
      }),
    });
    expect(varProdRes.status).toBe(200);
    const varProd = await varProdRes.json();
    variantProductId = varProd.id;
    variantAId = varProd.variants[0].id;
    variantBId = varProd.variants[1].id;
  });

  afterAll(async () => {
    if (singleProductId) {
      await prisma.product.deleteMany({ where: { id: singleProductId } });
    }
    if (variantProductId) {
      await prisma.productVariant.deleteMany({ where: { productId: variantProductId } });
      await prisma.product.deleteMany({ where: { id: variantProductId } });
    }
    if (createdCustomCatId) {
      await prisma.expenseCategory.deleteMany({ where: { id: createdCustomCatId } });
    }
    await prisma.expense.deleteMany({
      where: {
        OR: [
          { description: { contains: 'Gasto prueba' } },
          { description: { contains: 'póliza de seguro' } },
          { description: { contains: 'nómina mesero' } },
          { description: { contains: 'máquina espresso' } },
        ],
      },
    });
  });

  // ===========================================================================
  // 1. PRODUCT STOCK EDITING
  // ===========================================================================
  describe('1. Product Stock Editing via PATCH & PUT', () => {
    it('PATCH /products/:id/stock should update simple product stock directly', async () => {
      const res = await api.request(`/products/${singleProductId}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ stock: 25 }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.product.stock).toBe(25);

      const dbProduct = await prisma.product.findUnique({ where: { id: singleProductId } });
      expect(dbProduct?.stock).toBe(25);
    });

    it('PATCH /products/:id/stock should reject negative stock', async () => {
      const res = await api.request(`/products/${singleProductId}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ stock: -3 }),
      });
      expect(res.status).toBe(400);
    });

    it('PATCH /products/:id/stock should update variant stocks and sync base product total stock', async () => {
      const res = await api.request(`/products/${variantProductId}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          variants: [
            { id: variantAId, stock: 15 },
            { id: variantBId, stock: 20 },
          ],
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.product.stock).toBe(35); // 15 + 20

      const vA = await prisma.productVariant.findUnique({ where: { id: variantAId } });
      const vB = await prisma.productVariant.findUnique({ where: { id: variantBId } });
      expect(vA?.stock).toBe(15);
      expect(vB?.stock).toBe(20);
    });

    it('PATCH /products/:id/stock should reject non-existent variant ID', async () => {
      const res = await api.request(`/products/${variantProductId}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          variants: [
            { id: 'non-existent-variant-id', stock: 10 },
          ],
        }),
      });
      expect(res.status).toBe(400);
    });

    it('PATCH /products/:id/stock should require admin role', async () => {
      const res = await api.request(`/products/${singleProductId}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({ stock: 50 }),
      });
      expect(res.status).toBe(403);
    });

    it('PUT /products/:id should allow updating stock on simple product', async () => {
      const res = await api.request(`/products/${singleProductId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          name: 'Producto Simple Con Stock Actualizado',
          stock: 42,
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.stock).toBe(42);
    });

    it('PATCH /products/:id/stock should reject float / decimal stock with 400', async () => {
      const res = await api.request(`/products/${singleProductId}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ stock: 12.5 }),
      });
      expect(res.status).toBe(400);
    });

    it('PATCH /products/:id/stock should reject setting direct stock on product with active variants', async () => {
      const res = await api.request(`/products/${variantProductId}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ stock: 99 }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('variantes');
    });

    it('PUT /products/:id should preserve variants-derived stock when updating without variants payload', async () => {
      const res = await api.request(`/products/${variantProductId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          name: 'Producto Con Variantes Renombrado',
          stock: 999, // Attempt to corrupt stock
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      // Should remain 35 (15 + 20), not 999!
      expect(data.stock).toBe(35);
    });
  });

  // ===========================================================================
  // 2. EXPENSE CATEGORIES CRUD
  // ===========================================================================
  describe('2. Expense Categories Endpoints', () => {
    it('GET /expenses/categories should list all default system categories', async () => {
      const res = await api.request('/expenses/categories', {
        headers: { Cookie: adminCookie },
      });
      expect(res.status).toBe(200);
      const list = await res.json();
      expect(Array.isArray(list)).toBe(true);

      const ids = list.map((c: any) => c.id);
      expect(ids).toContain('utilities');
      expect(ids).toContain('rent');
      expect(ids).toContain('supplies');
      expect(ids).toContain('payroll');
      expect(ids).toContain('maintenance');
      expect(ids).toContain('marketing');
      expect(ids).toContain('taxes');
      expect(ids).toContain('transport');
      expect(ids).toContain('equipment');
      expect(ids).toContain('waste');
      expect(ids).toContain('other');
    });

    it('POST /expenses/categories should create a custom category', async () => {
      const customName = `Seguros Comerciales ${Date.now()}`;
      const res = await api.request('/expenses/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          name: customName,
          description: 'Pólizas y seguros de responsabilidad civil y local',
        }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.category.name).toBe(customName);
      expect(data.category.isSystem).toBe(false);
      createdCustomCatId = data.category.id;
    });

    it('POST /expenses/categories should reject duplicate custom category name', async () => {
      const existing = await prisma.expenseCategory.findUnique({ where: { id: createdCustomCatId } });
      const res = await api.request('/expenses/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          name: existing!.name,
          description: 'Intento duplicado',
        }),
      });
      expect(res.status).toBe(400);
    });

    it('POST /expenses/categories should reject colliding with default system category name (case-insensitive)', async () => {
      const res = await api.request('/expenses/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          name: 'nÓmInA y SuElDoS',
        }),
      });
      expect(res.status).toBe(400);
    });

    it('POST /expenses/categories should reject duplicate custom category name case-insensitively', async () => {
      const existing = await prisma.expenseCategory.findUnique({ where: { id: createdCustomCatId } });
      const res = await api.request('/expenses/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          name: existing!.name.toLowerCase(),
          description: 'Intento duplicado en minúsculas',
        }),
      });
      expect(res.status).toBe(400);
    });

    it('PUT /expenses/categories/:id should update a custom category and cascade new name to existing expenses', async () => {
      // First create an expense with this category
      const currentCat = await prisma.expenseCategory.findUnique({ where: { id: createdCustomCatId } });
      const desc = `Gasto prueba renombre categoria ${Date.now()}`;
      const expRes = await api.request('/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          description: desc,
          amount: 50000,
          category: currentCat!.id, // Test using category ID
          department: 'GENERAL',
          userId: adminUser.id,
        }),
      });
      expect(expRes.status).toBe(200);

      const updatedName = `Seguros y Polizas Renombrado ${Date.now()}`;
      const res = await api.request(`/expenses/categories/${createdCustomCatId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          name: updatedName,
          description: 'Descripción actualizada',
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.category.name).toBe(updatedName);

      // Verify the existing expense's category was updated to the new name!
      const updatedExpense = await prisma.expense.findFirst({
        where: { description: desc },
      });
      expect(updatedExpense?.category).toBe(updatedName);
    });

    it('PUT /expenses/categories/:id should reject editing a system category', async () => {
      const res = await api.request('/expenses/categories/rent', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          name: 'Nuevo Arriendo',
        }),
      });
      expect(res.status).toBe(400);
    });

    it('DELETE /expenses/categories/:id should reject deleting a system category', async () => {
      const res = await api.request('/expenses/categories/utilities', {
        method: 'DELETE',
        headers: { Cookie: adminCookie },
      });
      expect(res.status).toBe(400);
    });
  });

  // ===========================================================================
  // 3. EXPENSES CREATION WITH EXPANDED CATEGORIES
  // ===========================================================================
  describe('3. Expense Registration with Expanded Categories', () => {
    it('POST /expenses should create expense with standard category "payroll"', async () => {
      const res = await api.request('/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          description: 'Pago quincenal nómina mesero café',
          amount: 850000,
          category: 'payroll',
          department: 'CAFE',
          userId: adminUser.id,
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.expense.category).toBe('payroll');
      expect(Number(data.expense.amount)).toBe(850000);
    });

    it('POST /expenses should create expense with standard category "maintenance"', async () => {
      const res = await api.request('/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          description: 'Mantenimiento preventivo máquina espresso',
          amount: 180000,
          category: 'maintenance',
          department: 'CAFE',
          userId: adminUser.id,
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.expense.category).toBe('maintenance');
    });

    it('POST /expenses should create expense with custom category', async () => {
      const customCat = await prisma.expenseCategory.findUnique({ where: { id: createdCustomCatId } });
      const res = await api.request('/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          description: 'Pago mensual de póliza de seguro',
          amount: 220000,
          category: customCat!.name,
          department: 'GENERAL',
          userId: adminUser.id,
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.expense.category).toBe(customCat!.name);
    });

    it('POST /expenses should reject completely invalid category', async () => {
      const res = await api.request('/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          description: 'Categoría inventada no registrada',
          amount: 50000,
          category: 'categoria_totalmente_falsa_9999',
          department: 'MARKET',
        }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Categoría de gasto inválida');
    });

    it('DELETE /expenses/categories/:id should delete custom category and reassign expenses to other', async () => {
      const customCat = await prisma.expenseCategory.findUnique({ where: { id: createdCustomCatId } });
      const delRes = await api.request(`/expenses/categories/${createdCustomCatId}`, {
        method: 'DELETE',
        headers: { Cookie: adminCookie },
      });
      expect(delRes.status).toBe(200);

      // Check that the expense previously assigned to this category was reassigned to 'other'
      const reassigned = await prisma.expense.findFirst({
        where: { description: 'Pago mensual de póliza de seguro' },
      });
      expect(reassigned?.category).toBe('other');
    });
  });
});
