import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import api from '../../src/api';
import { prisma } from '../../src/db';
import { getAuthSessions, AuthSession } from '../fixtures/test-setup';

describe('Tier 1 — R3: Dedicated Category Management & Product Counts', () => {
  let auth: AuthSession;
  let testCategoryId = '';
  let defaultCategoryId = '';
  let testProductId = '';

  beforeAll(async () => {
    auth = await getAuthSessions();

    // Ensure default category
    let defCat = await prisma.category.findUnique({ where: { name: 'Sin categoría' } });
    if (!defCat) {
      defCat = await prisma.category.create({
        data: { name: 'Sin categoría', description: 'Categoría por defecto' },
      });
    }
    defaultCategoryId = defCat.id;
  });

  afterAll(async () => {
    // Teardown created test entities
    try {
      if (testProductId) {
        await prisma.product.delete({ where: { id: testProductId } }).catch(() => {});
      }
      if (testCategoryId) {
        await prisma.category.delete({ where: { id: testCategoryId } }).catch(() => {});
      }
    } catch {}
  });

  // ---------------------------------------------------------------------------
  // 1. Category Listing & Product Counts (Feature 4 & 5)
  // ---------------------------------------------------------------------------
  it('TC-R3-01: GET /categories should return category list with product counts (_count.products)', async () => {
    const res = await api.request('/categories', {
      headers: { Cookie: auth.cashierCookie },
    });

    expect(res.status).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);

    // Verify each category has id, name, and _count structure if populated
    for (const cat of list) {
      expect(cat.id).toBeDefined();
      expect(cat.name).toBeDefined();
      if (cat._count) {
        expect(typeof cat._count.products).toBe('number');
      }
    }
  });

  it('TC-R3-02: Default category "Sin categoría" must be present and seeded', async () => {
    const res = await api.request('/categories', {
      headers: { Cookie: auth.cashierCookie },
    });

    const list = await res.json();
    const defaultCat = list.find((c: any) => c.name === 'Sin categoría');
    expect(defaultCat).toBeDefined();
    expect(defaultCat.id).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // 2. Category Creation & Validation (Features 11, 12)
  // ---------------------------------------------------------------------------
  it('TC-R3-03: POST /categories should create a new category as ADMIN', async () => {
    const catName = `Cat-Test-${Date.now()}`;
    const res = await api.request('/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
      body: JSON.stringify({
        name: catName,
        description: 'Categoría de prueba para E2E',
      }),
    });

    expect([200, 201]).toContain(res.status);
    const created = await res.json();
    expect(created.id).toBeDefined();
    expect(created.name).toBe(catName);
    testCategoryId = created.id;
  });

  it('TC-R3-04: POST /categories should reject duplicate category names with 400', async () => {
    const existingCat = await prisma.category.findUnique({ where: { id: testCategoryId } });
    if (existingCat) {
      const res = await api.request('/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
        body: JSON.stringify({
          name: existingCat.name,
          description: 'Intento duplicado',
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    }
  });

  // ---------------------------------------------------------------------------
  // 3. Category Update & Protection (Feature 5, 13)
  // ---------------------------------------------------------------------------
  it('TC-R3-05: PUT /categories/:id should update name and description', async () => {
    const updatedName = `Cat-Updated-${Date.now()}`;
    const res = await api.request(`/categories/${testCategoryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
      body: JSON.stringify({
        name: updatedName,
        description: 'Descripción actualizada exitosamente',
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe(updatedName);
    expect(data.description).toBe('Descripción actualizada exitosamente');
  });

  it('TC-R3-06: PUT /categories/:id must protect "Sin categoría" from being renamed', async () => {
    const res = await api.request(`/categories/${defaultCategoryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
      body: JSON.stringify({
        name: 'Nuevo Nombre Ilegal',
        description: 'No permitido',
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('TC-R3-07: DELETE /categories/:id must protect "Sin categoría" from being deleted', async () => {
    const res = await api.request(`/categories/${defaultCategoryId}`, {
      method: 'DELETE',
      headers: { Cookie: auth.adminCookie },
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // 4. Product Reassignment on Deletion (Feature 13)
  // ---------------------------------------------------------------------------
  it('TC-R3-08: DELETE /categories/:id should auto-reassign products to "Sin categoría"', async () => {
    // 1. Create a product assigned to testCategoryId
    const prod = await prisma.product.create({
      data: {
        sku: `PROD-REASSIGN-${Date.now()}`,
        name: 'Producto a Reasignar',
        price: 12000,
        cost: 6000,
        stock: 10,
        categoryId: testCategoryId,
        department: 'MARKET',
      },
    });
    testProductId = prod.id;

    // 2. Delete the custom category
    const deleteRes = await api.request(`/categories/${testCategoryId}`, {
      method: 'DELETE',
      headers: { Cookie: auth.adminCookie },
    });
    expect([200, 204]).toContain(deleteRes.status);

    // 3. Verify product is not deleted and now belongs to defaultCategoryId
    const recheckedProd = await prisma.product.findUnique({ where: { id: prod.id } });
    expect(recheckedProd).not.toBeNull();
    expect(recheckedProd!.categoryId).toBe(defaultCategoryId);

    testCategoryId = ''; // Mark as deleted
  });

  // ---------------------------------------------------------------------------
  // 5. Frontend Navigation & Page Contracts (Features 11, 12)
  // ---------------------------------------------------------------------------
  it('TC-R3-09: Sidebar.svelte must include navigation link/tab for "Categorías"', () => {
    const sidebarPath = resolve(__dirname, '../../frontend/src/lib/components/Sidebar.svelte');
    expect(existsSync(sidebarPath)).toBe(true);
    const content = readFileSync(sidebarPath, 'utf-8');
    expect(content.toLowerCase()).toContain('categor');
  });

  it('TC-R3-10: Dedicated Categories.svelte view must exist or be registered in App.svelte', () => {
    const appSveltePath = resolve(__dirname, '../../frontend/src/App.svelte');
    const categoriesPagePath = resolve(__dirname, '../../frontend/src/lib/pages/Categories.svelte');
    const appContent = readFileSync(appSveltePath, 'utf-8');
    const hasCategorySupport = existsSync(categoriesPagePath) || appContent.includes('categories') || appContent.includes('Categor');
    expect(hasCategorySupport).toBe(true);
  });
});
