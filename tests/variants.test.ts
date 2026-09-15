import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import api from '../src/api';
import { prisma } from '../src/db';

describe('Product Variants Test Suite', () => {
  let adminCookie = '';
  let adminUser: any = null;
  let testCategoryId = '';
  let createdProductId = '';
  let variantSmallId = '';
  let variantMediumId = '';
  let variantLargeId = '';

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

    // 2. Get or create category
    const cat = await prisma.category.findFirst();
    if (cat) {
      testCategoryId = cat.id;
    } else {
      const newCat = await prisma.category.create({
        data: { name: 'Bebidas Calientes' },
      });
      testCategoryId = newCat.id;
    }
  });

  afterAll(async () => {
    // Clean up test product and variants if created
    if (createdProductId) {
      try {
        await prisma.saleItem.deleteMany({ where: { productId: createdProductId } });
        await prisma.productVariant.deleteMany({ where: { productId: createdProductId } });
        await prisma.product.deleteMany({ where: { id: createdProductId } });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  // ===========================================================================
  // 1. PRODUCT VARIANT CREATION
  // ===========================================================================
  describe('1. Variant Creation & Validation', () => {
    it('POST /products with variants should create product and associated variants', async () => {
      const res = await api.request('/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          name: 'Latte Aromático Test',
          sku: `LATTE-TEST-${Date.now()}`,
          price: 5000,
          cost: 2000,
          stock: 30, // Aggregate stock
          categoryId: testCategoryId,
          department: 'CAFE',
          isRawMaterial: false,
          variants: [
            {
              name: '8 oz (Pequeño)',
              sku: `LATTE-TEST-8OZ-${Date.now()}`,
              price: 4500,
              cost: 1800,
              stock: 10,
            },
            {
              name: '12 oz (Mediano)',
              sku: `LATTE-TEST-12OZ-${Date.now()}`,
              price: 5500,
              cost: 2200,
              stock: 15,
            },
            {
              name: '16 oz (Grande)',
              sku: `LATTE-TEST-16OZ-${Date.now()}`,
              price: 6500,
              cost: 2600,
              stock: 5,
            },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBeTruthy();
      expect(data.name).toBe('Latte Aromático Test');
      expect(data.variants).toBeArray();
      expect(data.variants.length).toBe(3);

      createdProductId = data.id;

      const small = data.variants.find((v: any) => v.name.includes('8 oz'));
      const med = data.variants.find((v: any) => v.name.includes('12 oz'));
      const large = data.variants.find((v: any) => v.name.includes('16 oz'));

      expect(small).toBeDefined();
      expect(Number(small.price)).toBe(4500);
      expect(small.stock).toBe(10);
      variantSmallId = small.id;

      expect(med).toBeDefined();
      expect(Number(med.price)).toBe(5500);
      expect(med.stock).toBe(15);
      variantMediumId = med.id;

      expect(large).toBeDefined();
      expect(Number(large.price)).toBe(6500);
      expect(large.stock).toBe(5);
      variantLargeId = large.id;
    });

    it('POST /products should reject duplicate variant SKU with 400', async () => {
      const existingVariant = await prisma.productVariant.findUnique({
        where: { id: variantSmallId },
      });

      const res = await api.request('/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          name: 'Dupe SKU Product',
          sku: `DUPE-PROD-${Date.now()}`,
          price: 3000,
          cost: 1000,
          stock: 10,
          categoryId: testCategoryId,
          department: 'MARKET',
          variants: [
            {
              name: 'Var 1',
              sku: existingVariant?.sku || 'LATTE-TEST-8OZ',
              price: 3000,
              cost: 1000,
              stock: 5,
            },
          ],
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('ya está en uso');
    });
  });

  // ===========================================================================
  // 2. PRODUCT & VARIANT QUERY
  // ===========================================================================
  describe('2. Querying Products with Variants', () => {
    it('GET /products/:id should include variants ordered by price asc', async () => {
      const res = await api.request(`/products/${createdProductId}`, {
        headers: { Cookie: adminCookie },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(createdProductId);
      expect(data.variants.length).toBe(3);
      expect(Number(data.variants[0].price)).toBe(4500);
      expect(Number(data.variants[1].price)).toBe(5500);
      expect(Number(data.variants[2].price)).toBe(6500);
    });

    it('GET /products should list product with its variants', async () => {
      const res = await api.request('/products', {
        headers: { Cookie: adminCookie },
      });
      expect(res.status).toBe(200);
      const list = await res.json();
      const found = list.find((p: any) => p.id === createdProductId);
      expect(found).toBeDefined();
      expect(found.variants.length).toBe(3);
    });
  });

  // ===========================================================================
  // 3. PRODUCT VARIANT UPDATES
  // ===========================================================================
  describe('3. Updating Products & Variants', () => {
    it('PUT /products/:id should update existing variants and add new ones', async () => {
      const existingSmall = await prisma.productVariant.findUnique({
        where: { id: variantSmallId },
      });
      const existingMed = await prisma.productVariant.findUnique({
        where: { id: variantMediumId },
      });

      const res = await api.request(`/products/${createdProductId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          name: 'Latte Aromático Especial',
          variants: [
            {
              id: variantSmallId,
              name: '8 oz (Pequeño Actualizado)',
              sku: existingSmall?.sku,
              price: 4800,
              cost: 1900,
              stock: 8,
            },
            {
              id: variantMediumId,
              name: '12 oz (Mediano)',
              sku: existingMed?.sku,
              price: 5800,
              cost: 2300,
              stock: 12,
            },
            {
              // Adding a 4th variant
              name: '20 oz (Extra Grande)',
              sku: `LATTE-TEST-20OZ-${Date.now()}`,
              price: 7500,
              cost: 3000,
              stock: 10,
            },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe('Latte Aromático Especial');
      // Large (16oz) was omitted, so it was deactivated; 3 active variants remain
      expect(data.variants.length).toBe(3);
      const updatedSmall = data.variants.find((v: any) => v.id === variantSmallId);
      expect(updatedSmall).toBeDefined();
      expect(Number(updatedSmall.price)).toBe(4800);
      expect(updatedSmall.stock).toBe(8);

      const newExtra = data.variants.find((v: any) => v.name.includes('20 oz'));
      expect(newExtra).toBeDefined();
      expect(Number(newExtra.price)).toBe(7500);
    });
  });

  // ===========================================================================
  // 4. SALES WITH VARIANTS (STOCK DEDUCTION & RESTORATION)
  // ===========================================================================
  describe('4. Sales Flow with Variants', () => {
    it('POST /sales should decrement variant stock and parent product stock', async () => {
      // Small variant stock is currently 8, parent product stock is 30
      const saleRes = await api.request('/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          userId: adminUser.id,
          total: 4800 * 2, // 9600
          items: [
            {
              productId: createdProductId,
              variantId: variantSmallId,
              quantity: 2,
              price: 4800,
            },
          ],
          payments: [
            {
              method: 'CASH',
              amount: 9600,
            },
          ],
        }),
      });

      expect(saleRes.status).toBe(200);
      const saleData = await saleRes.json();
      expect(saleData.sale.id).toBeTruthy();
      expect(saleData.sale.status).toBe('COMPLETED');
      expect(saleData.sale.items[0].variantId).toBe(variantSmallId);

      // Verify variant stock was decremented: 8 - 2 = 6
      const variantAfter = await prisma.productVariant.findUnique({
        where: { id: variantSmallId },
      });
      expect(variantAfter?.stock).toBe(6);

      // Verify parent product stock was decremented: 30 - 2 = 28
      const productAfter = await prisma.product.findUnique({
        where: { id: createdProductId },
      });
      expect(productAfter?.stock).toBe(28);

      // Cancel the sale and verify stock restoration
      const cancelRes = await api.request(`/sales/${saleData.sale.id}/cancel`, {
        method: 'POST',
        headers: { Cookie: adminCookie },
      });
      expect(cancelRes.status).toBe(200);

      // Variant stock restored to 8
      const variantRestored = await prisma.productVariant.findUnique({
        where: { id: variantSmallId },
      });
      expect(variantRestored?.stock).toBe(8);

      // Parent stock restored to 30
      const productRestored = await prisma.product.findUnique({
        where: { id: createdProductId },
      });
      expect(productRestored?.stock).toBe(30);
    });

    it('POST /sales should reject sale if variant stock is insufficient', async () => {
      const saleRes = await api.request('/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          userId: adminUser.id,
          total: 4800 * 100,
          items: [
            {
              productId: createdProductId,
              variantId: variantSmallId,
              quantity: 100, // Only 8 in stock!
              price: 4800,
            },
          ],
          payments: [
            {
              method: 'CASH',
              amount: 4800 * 100,
            },
          ],
        }),
      });

      expect(saleRes.status).toBe(400);
      const err = await saleRes.json();
      expect(err.error).toContain('Stock insuficiente');
    });
  });

  // ===========================================================================
  // 5. TABLES WITH VARIANTS
  // ===========================================================================
  describe('5. Table Orders with Variants', () => {
    let testTableId = '';

    beforeAll(async () => {
      const table = await prisma.cafeTable.create({
        data: { name: `Mesa Var Test ${Date.now()}` },
      });
      testTableId = table.id;
    });

    afterAll(async () => {
      if (testTableId) {
        await prisma.saleItem.deleteMany({ where: { sale: { tableId: testTableId } } });
        await prisma.sale.deleteMany({ where: { tableId: testTableId } });
        await prisma.cafeTable.deleteMany({ where: { id: testTableId } });
      }
    });

    it('should open table and save order with variant, reserving stock', async () => {
      // 1. Open table
      const openRes = await api.request(`/tables/${testTableId}/open`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({ userId: adminUser.id }),
      });
      expect(openRes.status).toBe(200);

      // 2. Save table order with variant (1 unit of small)
      const saveRes = await api.request(`/tables/${testTableId}/save`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          items: [
            {
              productId: createdProductId,
              variantId: variantSmallId,
              quantity: 1,
              price: 4800,
            },
          ],
        }),
      });
      expect(saveRes.status).toBe(200);

      // Verify variant stock reserved: 8 - 1 = 7
      const variantAfter = await prisma.productVariant.findUnique({
        where: { id: variantSmallId },
      });
      expect(variantAfter?.stock).toBe(7);

      // 3. Checkout table
      const checkoutRes = await api.request(`/tables/${testTableId}/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          payments: [{ method: 'CARD', amount: 4800 }],
        }),
      });
      expect(checkoutRes.status).toBe(200);
      const checkoutData = await checkoutRes.json();
      expect(checkoutData.sale.status).toBe('COMPLETED');
      expect(checkoutData.sale.items[0].variantId).toBe(variantSmallId);
      expect(checkoutData.sale.items[0].variant).toBeDefined();
      expect(checkoutData.sale.items[0].variant.name).toContain('8 oz');
    });
  });

  // ===========================================================================
  // 6. VARIANT VALIDATION & INTEGRITY ENFORCEMENT
  // ===========================================================================
  describe('6. Variant Validation & Integrity Enforcement', () => {
    let secondProductId = '';
    let secondVariantId = '';

    beforeAll(async () => {
      // Create a second product for cross-product validation tests
      const res = await api.request('/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          name: 'Té Chai Secundario',
          sku: `CHAI-SEC-${Date.now()}`,
          price: 6000,
          cost: 2500,
          categoryId: testCategoryId,
          department: 'CAFE',
          variants: [
            {
              name: 'Chai Vainilla',
              sku: `CHAI-VAN-${Date.now()}`,
              price: 6500,
              cost: 2800,
              stock: 10,
            },
          ],
        }),
      });
      const data = await res.json();
      secondProductId = data.id;
      secondVariantId = data.variants[0].id;
    });

    afterAll(async () => {
      if (secondProductId) {
        try {
          await prisma.saleItem.deleteMany({ where: { productId: secondProductId } });
          await prisma.productVariant.deleteMany({ where: { productId: secondProductId } });
          await prisma.product.deleteMany({ where: { id: secondProductId } });
        } catch (e) {}
      }
    });

    it('PUT /products/:id should reject duplicate variant SKUs within the payload', async () => {
      const dupeSku = `DUP-VAR-${Date.now()}`;
      const res = await api.request(`/products/${createdProductId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          variants: [
            { name: 'Var A', sku: dupeSku, price: 5000, cost: 2000, stock: 5 },
            { name: 'Var B', sku: dupeSku, price: 6000, cost: 2500, stock: 5 },
          ],
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('duplicados');
    });

    it('PUT /products/:id should reject variant SKU that matches parent product SKU', async () => {
      const parentProd = await prisma.product.findUnique({ where: { id: createdProductId } });
      const res = await api.request(`/products/${createdProductId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          variants: [
            { name: 'Var Colliding Parent', sku: parentProd?.sku, price: 5000, cost: 2000, stock: 5 },
          ],
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('coincide con el SKU del producto principal');
    });

    it('PUT /products/:id should reject variant SKU already used by another variant', async () => {
      const secondVar = await prisma.productVariant.findUnique({ where: { id: secondVariantId } });
      const res = await api.request(`/products/${createdProductId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          variants: [
            { name: 'Var Hijacking SKU', sku: secondVar?.sku, price: 5000, cost: 2000, stock: 5 },
          ],
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('ya está en uso');
    });

    it('PUT /products/:id should recalculate base product stock from updated variants', async () => {
      const res = await api.request(`/products/${createdProductId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          // Notice: stock 99 is intentionally sent (simulating stale form state)
          stock: 99,
          variants: [
            { name: 'Talla 1', sku: `SYNC-1-${Date.now()}`, price: 4000, cost: 1500, stock: 7 },
            { name: 'Talla 2', sku: `SYNC-2-${Date.now()}`, price: 5000, cost: 2000, stock: 13 },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      // Total stock must be 7 + 13 = 20, NOT 99!
      expect(data.stock).toBe(20);

      const dbProduct = await prisma.product.findUnique({ where: { id: createdProductId } });
      expect(dbProduct?.stock).toBe(20);
    });

    it('POST /sales should reject when variantId does not belong to productId', async () => {
      const res = await api.request('/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          userId: adminUser.id,
          total: 6500,
          items: [
            {
              productId: createdProductId,
              variantId: secondVariantId, // Mismatched! Belongs to secondProductId
              quantity: 1,
              price: 6500,
            },
          ],
          payments: [{ method: 'CASH', amount: 6500 }],
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('no pertenece al producto');
    });

    it('POST /sales should reject when variant is inactive', async () => {
      // Deactivate secondVariantId
      await prisma.productVariant.update({
        where: { id: secondVariantId },
        data: { active: false },
      });

      const res = await api.request('/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          userId: adminUser.id,
          total: 6500,
          items: [
            {
              productId: secondProductId,
              variantId: secondVariantId,
              quantity: 1,
              price: 6500,
            },
          ],
          payments: [{ method: 'CASH', amount: 6500 }],
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('no está disponible');

      // Re-activate
      await prisma.productVariant.update({
        where: { id: secondVariantId },
        data: { active: true },
      });
    });

    it('PUT /tables/:id/save should reject when variantId does not belong to productId', async () => {
      const table = await prisma.cafeTable.create({
        data: { name: `Mesa Mismatch Test ${Date.now()}` },
      });

      await api.request(`/tables/${table.id}/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ userId: adminUser.id }),
      });

      const saveRes = await api.request(`/tables/${table.id}/save`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          items: [
            {
              productId: createdProductId,
              variantId: secondVariantId, // Mismatched!
              quantity: 1,
              price: 6500,
            },
          ],
        }),
      });

      expect(saveRes.status).toBe(400);
      const data = await saveRes.json();
      expect(data.error).toContain('no pertenece al producto');

      // Cleanup
      await prisma.sale.deleteMany({ where: { tableId: table.id } });
      await prisma.cafeTable.delete({ where: { id: table.id } });
    });
  });

  // ===========================================================================
  // 7. REPORTS & INVENTORY ALERTS WITH VARIANTS
  // ===========================================================================
  describe('7. Reports & Margin Calculation with Variants', () => {
    it('GET /reports/dashboard should calculate cost of sales using variant cost', async () => {
      // Find a variant from createdProductId
      const prod = await prisma.product.findUnique({
        where: { id: createdProductId },
        include: { variants: { where: { active: true } } },
      });
      const testVar = prod!.variants[0];

      // Create a completed sale for this variant
      const varPrice = Number(testVar.price);
      const varCost = Number(testVar.cost);

      const sale = await prisma.sale.create({
        data: {
          userId: adminUser.id,
          total: varPrice * 2,
          status: 'COMPLETED',
          items: {
            create: [
              {
                productId: createdProductId,
                variantId: testVar.id,
                quantity: 2,
                price: varPrice,
              },
            ],
          },
          payments: {
            create: [
              {
                method: 'CASH',
                amount: varPrice * 2,
              },
            ],
          },
        },
      });

      const res = await api.request('/reports/dashboard', {
        headers: { Cookie: adminCookie },
      });
      expect(res.status).toBe(200);
      const report = await res.json();

      expect(report.CONSOLIDATED.costOfSales).toBeGreaterThan(0);

      // Cleanup test sale
      await prisma.salePayment.deleteMany({ where: { saleId: sale.id } });
      await prisma.saleItem.deleteMany({ where: { saleId: sale.id } });
      await prisma.sale.delete({ where: { id: sale.id } });
    });

    it('GET /reports/inventory-alerts should flag products whose active variant has stock <= 3', async () => {
      // Set variant stock to 2
      const prod = await prisma.product.findUnique({
        where: { id: createdProductId },
        include: { variants: { where: { active: true } } },
      });
      const testVar = prod!.variants[0];
      await prisma.productVariant.update({
        where: { id: testVar.id },
        data: { stock: 2 },
      });

      const res = await api.request('/reports/inventory-alerts', {
        headers: { Cookie: adminCookie },
      });
      expect(res.status).toBe(200);
      const alerts = await res.json();
      const found = alerts.find((p: any) => p.id === createdProductId);
      expect(found).toBeDefined();
      expect(found.variants).toBeArray();
    });
  });
});
