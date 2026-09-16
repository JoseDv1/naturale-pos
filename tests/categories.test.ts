import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import api from '../src/api';
import { prisma } from '../src/db';
import { getAuthSessions, AuthSession, createTestProduct } from './fixtures/test-setup';

describe('Milestone 1 — Categories API & Product Counts', () => {
  let auth: AuthSession;
  let defaultCategory: any;
  let customCategory: any;
  let linkedProduct: any;

  beforeAll(async () => {
    auth = await getAuthSessions();

    // Ensure default category exists
    defaultCategory = await prisma.category.findUnique({ where: { name: 'Sin categoría' } });
    if (!defaultCategory) {
      defaultCategory = await prisma.category.create({
        data: { name: 'Sin categoría', description: 'Categoría por defecto' },
      });
    }

    // Create a custom category for testing
    customCategory = await prisma.category.create({
      data: { name: 'M1 Test Category', description: 'Categoría temporal para pruebas M1' },
    });

    // Create a product linked to the custom category
    linkedProduct = await createTestProduct({
      name: 'Category Linked Product',
      price: 15000,
      stock: 10,
      categoryId: customCategory.id,
    });
  });

  afterAll(async () => {
    try {
      if (linkedProduct) {
        await prisma.saleItem.deleteMany({ where: { productId: linkedProduct.id } });
        await prisma.expenseItem.deleteMany({ where: { productId: linkedProduct.id } });
        await prisma.product.delete({ where: { id: linkedProduct.id } }).catch(() => {});
      }
      if (customCategory) {
        await prisma.category.delete({ where: { id: customCategory.id } }).catch(() => {});
      }
    } catch {}
  });

  // ---------------------------------------------------------------------------
  // 1. Category Listing & Product Count
  // ---------------------------------------------------------------------------
  it('GET /categories should return category list with _count.products', async () => {
    const res = await api.request('/categories', {
      headers: { Cookie: auth.cashierCookie },
    });

    expect(res.status).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);

    const targetCat = list.find((c: any) => c.id === customCategory.id);
    expect(targetCat).toBeDefined();
    expect(targetCat._count).toBeDefined();
    expect(targetCat._count.products).toBeGreaterThanOrEqual(1);
  });

  it('Default category "Sin categoría" should exist and be protected', async () => {
    const res = await api.request('/categories', {
      headers: { Cookie: auth.cashierCookie },
    });

    const list = await res.json();
    const defCat = list.find((c: any) => c.name === 'Sin categoría');
    expect(defCat).toBeDefined();
    expect(defCat.id).toBe(defaultCategory.id);
  });

  // ---------------------------------------------------------------------------
  // 2. RBAC Guards on Category Modification & Deletion
  // ---------------------------------------------------------------------------
  it('PUT /categories/:id should reject unauthenticated request with 401', async () => {
    const res = await api.request(`/categories/${customCategory.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Nuevo Nombre Sin Auth' }),
    });

    expect(res.status).toBe(401);
  });

  it('PUT /categories/:id should reject CASHIER role with 403', async () => {
    const res = await api.request(`/categories/${customCategory.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({ name: 'Nuevo Nombre Intento Cajero' }),
    });

    expect(res.status).toBe(403);
  });

  it('DELETE /categories/:id should reject CASHIER role with 403', async () => {
    const res = await api.request(`/categories/${customCategory.id}`, {
      method: 'DELETE',
      headers: { Cookie: auth.cashierCookie },
    });

    expect(res.status).toBe(403);
  });

  // ---------------------------------------------------------------------------
  // 3. Default Category Protection
  // ---------------------------------------------------------------------------
  it('PUT /categories/:id on default category "Sin categoría" should return 400', async () => {
    const res = await api.request(`/categories/${defaultCategory.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
      body: JSON.stringify({ name: 'Renombrar Default Prohibido' }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('defecto');
  });

  it('DELETE /categories/:id on default category "Sin categoría" should return 400', async () => {
    const res = await api.request(`/categories/${defaultCategory.id}`, {
      method: 'DELETE',
      headers: { Cookie: auth.adminCookie },
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('defecto');
  });

  // ---------------------------------------------------------------------------
  // 4. Admin Updates & Deletion with Product Reassignment
  // ---------------------------------------------------------------------------
  it('PUT /categories/:id should allow ADMIN to update category name and description', async () => {
    const res = await api.request(`/categories/${customCategory.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
      body: JSON.stringify({
        name: 'M1 Test Category Actualizada',
        description: 'Descripción actualizada por admin',
      }),
    });

    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.name).toBe('M1 Test Category Actualizada');
    expect(updated.description).toBe('Descripción actualizada por admin');
    expect(updated._count?.products).toBeDefined();
  });

  it('DELETE /categories/:id should reassign linked products to "Sin categoría" before deleting', async () => {
    const res = await api.request(`/categories/${customCategory.id}`, {
      method: 'DELETE',
      headers: { Cookie: auth.adminCookie },
    });

    expect(res.status).toBe(200);

    // Verify category is deleted
    const deletedCat = await prisma.category.findUnique({ where: { id: customCategory.id } });
    expect(deletedCat).toBeNull();

    // Verify linked product was reassigned to defaultCategory
    const productAfter = await prisma.product.findUnique({ where: { id: linkedProduct.id } });
    expect(productAfter).toBeDefined();
    expect(productAfter!.categoryId).toBe(defaultCategory.id);
  });
});
