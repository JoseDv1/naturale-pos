import { describe, it, expect, beforeAll } from 'bun:test';
import api from '../src/api';
import { prisma } from '../src/db';

describe('Transfers with Variants Test Suite', () => {
  let adminCookie = '';
  let adminUser: any = null;

  let marketProductWithVariants: any = null;
  let variantMarketA: any = null;
  let variantMarketB: any = null;

  let cafeProductWithVariants: any = null;
  let variantCafeX: any = null;

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

    // 2. Fetch or create a category
    let category = await prisma.category.findFirst();
    if (!category) {
      category = await prisma.category.create({
        data: { name: 'Test Category' }
      });
    }

    // 3. Create a MARKET product with variants
    marketProductWithVariants = await prisma.product.create({
      data: {
        name: 'Proteína Vegetal en Polvo (Test)',
        sku: `PROT-VAR-${Date.now()}`,
        price: 90000,
        cost: 50000,
        stock: 30,
        department: 'MARKET',
        categoryId: category.id,
        variants: {
          create: [
            {
              name: 'Sabor Vainilla 1kg',
              sku: `PROT-VAN-${Date.now()}`,
              price: 90000,
              cost: 50000,
              stock: 12,
              active: true,
            },
            {
              name: 'Sabor Chocolate 1kg',
              sku: `PROT-CHOC-${Date.now()}`,
              price: 95000,
              cost: 52000,
              stock: 18,
              active: true,
            }
          ]
        }
      },
      include: { variants: true }
    });
    variantMarketA = marketProductWithVariants.variants[0];
    variantMarketB = marketProductWithVariants.variants[1];

    // 4. Create a CAFE product with variants
    cafeProductWithVariants = await prisma.product.create({
      data: {
        name: 'Scoop Proteína Extra Café (Test)',
        sku: `SCOOP-VAR-${Date.now()}`,
        price: 5000,
        cost: 2000,
        stock: 10,
        department: 'CAFE',
        categoryId: category.id,
        variants: {
          create: [
            {
              name: 'Scoop Vainilla',
              sku: `SCOOP-VAN-${Date.now()}`,
              price: 5000,
              cost: 2000,
              stock: 10,
              active: true,
            }
          ]
        }
      },
      include: { variants: true }
    });
    variantCafeX = cafeProductWithVariants.variants[0];
  });

  it('POST /transfers should allow transferring base product stock when variantId is omitted', async () => {
    const initialStock = marketProductWithVariants.stock;
    const res = await api.request('/transfers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        productId: marketProductWithVariants.id,
        quantity: 2,
        fromDepartment: 'MARKET',
        toDepartment: 'CAFE',
        userId: adminUser.id,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.transfer.variantId).toBeNull();
    const updated = await prisma.product.findUnique({ where: { id: marketProductWithVariants.id } });
    expect(updated!.stock).toBe(initialStock - 2);
  });

  it('POST /transfers should reject if variant does not belong to product', async () => {
    const res = await api.request('/transfers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        productId: marketProductWithVariants.id,
        variantId: variantCafeX.id, // belongs to cafe product, not market
        quantity: 2,
        fromDepartment: 'MARKET',
        toDepartment: 'CAFE',
        userId: adminUser.id,
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('pertenece');
  });

  it('POST /transfers should reject if quantity exceeds variant stock', async () => {
    const res = await api.request('/transfers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        productId: marketProductWithVariants.id,
        variantId: variantMarketA.id,
        quantity: 9999, // only 12 available
        fromDepartment: 'MARKET',
        toDepartment: 'CAFE',
        userId: adminUser.id,
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('insuficiente');
  });

  it('POST /transfers should transfer variant for kitchen consumption (no target product)', async () => {
    const currentVar = await prisma.productVariant.findUnique({ where: { id: variantMarketA.id } });
    const currentProd = await prisma.product.findUnique({ where: { id: marketProductWithVariants.id } });
    const initialVariantStock = currentVar!.stock;
    const initialProductStock = currentProd!.stock;
    const transferQty = 3;

    const res = await api.request('/transfers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        productId: marketProductWithVariants.id,
        variantId: variantMarketA.id,
        quantity: transferQty,
        fromDepartment: 'MARKET',
        toDepartment: 'CAFE',
        userId: adminUser.id,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.transfer).toBeDefined();
    expect(body.transfer.variantId).toBe(variantMarketA.id);
    expect(body.transfer.quantity).toBe(transferQty);

    // Verify source stock decremented
    const updatedVariant = await prisma.productVariant.findUnique({
      where: { id: variantMarketA.id }
    });
    expect(updatedVariant!.stock).toBe(initialVariantStock - transferQty);

    const updatedProduct = await prisma.product.findUnique({
      where: { id: marketProductWithVariants.id }
    });
    expect(updatedProduct!.stock).toBe(initialProductStock - transferQty);

    // Verify financial balancing records
    const expense = await prisma.expense.findFirst({
      where: {
        category: 'INTERNAL_TRANSFER',
        department: 'CAFE',
        userId: adminUser.id,
      },
      orderBy: { createdAt: 'desc' }
    });
    expect(expense).toBeDefined();
    expect(expense!.description).toContain(variantMarketA.name);

    const sale = await prisma.sale.findFirst({
      where: { status: 'TRANSFER_OUT', userId: adminUser.id },
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    });
    expect(sale).toBeDefined();
    expect(sale!.items[0].variantId).toBe(variantMarketA.id);
  });

  it('POST /transfers should transfer variant to another product variant (target product + target variant)', async () => {
    const initialSourceVarStock = (await prisma.productVariant.findUnique({ where: { id: variantMarketB.id } }))!.stock;
    const initialTargetVarStock = (await prisma.productVariant.findUnique({ where: { id: variantCafeX.id } }))!.stock;
    const transferQty = 4;

    const res = await api.request('/transfers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        productId: marketProductWithVariants.id,
        variantId: variantMarketB.id,
        targetProductId: cafeProductWithVariants.id,
        targetVariantId: variantCafeX.id,
        quantity: transferQty,
        fromDepartment: 'MARKET',
        toDepartment: 'CAFE',
        userId: adminUser.id,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.transfer.variantId).toBe(variantMarketB.id);
    expect(body.transfer.targetVariantId).toBe(variantCafeX.id);

    // Verify stock changes
    const updatedSourceVar = await prisma.productVariant.findUnique({ where: { id: variantMarketB.id } });
    expect(updatedSourceVar!.stock).toBe(initialSourceVarStock - transferQty);

    const updatedTargetVar = await prisma.productVariant.findUnique({ where: { id: variantCafeX.id } });
    expect(updatedTargetVar!.stock).toBe(initialTargetVarStock + transferQty);
  });

  it('GET /transfers should return list including variant and targetVariant', async () => {
    const res = await api.request('/transfers', {
      headers: { Cookie: adminCookie }
    });

    expect(res.status).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);

    const variantTransfer = list.find((t: any) => t.variantId === variantMarketA.id);
    expect(variantTransfer).toBeDefined();
    expect(variantTransfer.variant).toBeDefined();
    expect(variantTransfer.variant.name).toBe(variantMarketA.name);
  });

  it('POST /transfers should reject if targetVariantId is provided without targetProductId', async () => {
    const res = await api.request('/transfers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        productId: marketProductWithVariants.id,
        variantId: variantMarketA.id,
        targetVariantId: variantCafeX.id,
        quantity: 1,
        fromDepartment: 'MARKET',
        toDepartment: 'CAFE',
        userId: adminUser.id,
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('producto de destino');
  });

  it('POST /transfers should reject if targetVariant does not belong to targetProduct', async () => {
    const res = await api.request('/transfers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        productId: marketProductWithVariants.id,
        variantId: variantMarketA.id,
        targetProductId: cafeProductWithVariants.id,
        targetVariantId: variantMarketB.id, // belongs to market, not cafe
        quantity: 1,
        fromDepartment: 'MARKET',
        toDepartment: 'CAFE',
        userId: adminUser.id,
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('pertenece');
  });

  it('POST /transfers should return 404 if variantId does not exist', async () => {
    const res = await api.request('/transfers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        productId: marketProductWithVariants.id,
        variantId: '00000000-0000-0000-0000-000000000000',
        quantity: 1,
        fromDepartment: 'MARKET',
        toDepartment: 'CAFE',
        userId: adminUser.id,
      }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('no encontrada');
  });
});
