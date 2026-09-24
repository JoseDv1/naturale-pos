import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import api from '../src/api';
import { prisma } from '../src/db';

describe('Recipe & Product Modifiers System Test Suite', () => {
  let adminCookie = '';
  let cashierCookie = '';
  let cashierUser: any = null;
  let testCategoryId = '';
  let createdProductId = '';
  let shiftId = '';

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

    // 2. Authenticate cashier
    const cashierLoginRes = await api.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'cajero', pin: '0000' }),
    });
    expect(cashierLoginRes.status).toBe(200);
    const cashierSetCookie = cashierLoginRes.headers.get('set-cookie');
    cashierCookie = cashierSetCookie!.split(';')[0];
    const cashierBody = await cashierLoginRes.json();
    cashierUser = cashierBody.user;

    // 3. Ensure test category exists
    const cat = await prisma.category.findFirst();
    if (cat) {
      testCategoryId = cat.id;
    } else {
      const newCat = await prisma.category.create({
        data: { name: 'Bowls & Parfaits' },
      });
      testCategoryId = newCat.id;
    }

    // 4. Ensure an active shift exists
    const currentShiftRes = await api.request('/shifts/current', {
      headers: { Cookie: adminCookie },
    });
    const currentShiftData = await currentShiftRes.json();
    if (currentShiftData.shift) {
      shiftId = currentShiftData.shift.id;
    } else {
      const openShiftRes = await api.request('/shifts/open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({ initialCash: 100000 }),
      });
      const openShiftData = await openShiftRes.json();
      shiftId = openShiftData.shift.id;
    }
  });

  afterAll(async () => {
    if (createdProductId) {
      try {
        await prisma.saleItem.deleteMany({ where: { productId: createdProductId } });
        await prisma.productModifier.deleteMany({ where: { productId: createdProductId } });
        await prisma.product.deleteMany({ where: { id: createdProductId } });
      } catch (e) {
        // ignore
      }
    }
  });

  describe('1. Product Creation & Modification with Modifiers / Recipe Additions', () => {
    it('POST /products with modifiers should create product with modifiers', async () => {
      const uniqueSku = `PARFAIT-TEST-${Date.now()}`;
      const payload = {
        name: 'Parfait Frutos Silvestres Test',
        sku: uniqueSku,
        price: 12000,
        cost: 5000,
        stock: 50,
        department: 'CAFE',
        categoryId: testCategoryId,
        modifiers: [
          { name: 'Mermelada de Mora Silvestre', price: 2000, isDefault: true },
          { name: 'Granola Artesanal Extra', price: 1500, isDefault: false },
          { name: 'Mantequilla de Almendras', price: 2500, isDefault: false },
        ],
      };

      const res = await api.request('/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(200);
      const product = await res.json();
      expect(product.id).toBeTruthy();
      expect(product.modifiers).toHaveLength(3);
      const moraMod = product.modifiers.find((m: any) => m.name === 'Mermelada de Mora Silvestre');
      expect(moraMod).toBeTruthy();
      expect(Number(moraMod.price)).toBe(2000);
      createdProductId = product.id;
    });

    it('GET /products/:id should include active modifiers', async () => {
      const res = await api.request(`/products/${createdProductId}`, {
        headers: { Cookie: adminCookie },
      });
      expect(res.status).toBe(200);
      const product = await res.json();
      expect(product.modifiers).toHaveLength(3);
    });

    it('PUT /products/:id should update modifiers (add new modifier and update existing)', async () => {
      // First fetch to get existing modifier ids
      const fetchRes = await api.request(`/products/${createdProductId}`, {
        headers: { Cookie: adminCookie },
      });
      const existingProduct = await fetchRes.json();
      const existingMods = existingProduct.modifiers;

      const updatedPayload = {
        name: 'Parfait Frutos Silvestres Test Premium',
        price: 13000,
        modifiers: [
          {
            id: existingMods[0].id,
            name: 'Mermelada de Mora Silvestre Orgánica',
            price: 2500,
            isDefault: true,
          },
          // New modifier
          {
            name: 'Semillas de Chía y Lino',
            price: 1200,
            isDefault: false,
          },
        ],
      };

      const res = await api.request(`/products/${createdProductId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify(updatedPayload),
      });

      expect(res.status).toBe(200);
      const updatedProduct = await res.json();
      // Should have 2 active modifiers (the unmentioned ones are deactivated)
      expect(updatedProduct.modifiers).toHaveLength(2);
      expect(updatedProduct.modifiers.find((m: any) => m.name === 'Semillas de Chía y Lino')).toBeTruthy();
      expect(Number(updatedProduct.price)).toBe(13000);
    });
  });

  describe('2. Sales Flow with Recipe Customization and Notes', () => {
    it('POST /sales should record customized recipe items with notes and adjusted prices', async () => {
      // Item unitPrice = 13000 (base) + 2500 (mermelada) + 1200 (chia) = 16700
      // quantity = 2 -> subtotal = 33400
      const salePayload = {
        userId: cashierUser.id,
        items: [
          {
            productId: createdProductId,
            quantity: 2,
            price: 16700,
            notes: 'Mermelada de Mora Silvestre Orgánica (+$2,500), Semillas de Chía y Lino (+$1,200) | Sin azúcar añadida',
          },
        ],
        payments: [
          {
            method: 'CASH',
            amount: 33400,
          },
        ],
        total: 33400,
      };

      const res = await api.request('/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cashierCookie,
        },
        body: JSON.stringify(salePayload),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.sale).toBeTruthy();
      expect(data.sale.items).toHaveLength(1);
      expect(data.sale.items[0].notes).toBe(
        'Mermelada de Mora Silvestre Orgánica (+$2,500), Semillas de Chía y Lino (+$1,200) | Sin azúcar añadida'
      );
      expect(Number(data.sale.items[0].price)).toBe(16700);

      // Verify sale can be retrieved with notes
      const getSaleRes = await api.request(`/sales/${data.sale.id}`, {
        headers: { Cookie: cashierCookie },
      });
      expect(getSaleRes.status).toBe(200);
      const getSale = await getSaleRes.json();
      expect(getSale.items[0].notes).toBe(
        'Mermelada de Mora Silvestre Orgánica (+$2,500), Semillas de Chía y Lino (+$1,200) | Sin azúcar añadida'
      );
    });
  });

  describe('3. Table Orders with Recipe Customization and Checkout', () => {
    let testTable: any = null;

    it('should save order to table with recipe notes and calculate total correctly', async () => {
      // Find an available table or create one
      const tablesRes = await api.request('/tables', {
        headers: { Cookie: cashierCookie },
      });
      const tables = await tablesRes.json();
      testTable = tables.find((t: any) => t.status === 'AVAILABLE');
      if (!testTable) {
        testTable = await prisma.cafeTable.create({
          data: { name: `Mesa Test ${Date.now()}`, status: 'AVAILABLE' },
        });
      }
      expect(testTable).toBeTruthy();

      // 1. Open table
      const openRes = await api.request(`/tables/${testTable.id}/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({ userId: cashierUser.id }),
      });
      expect(openRes.status).toBe(200);

      // 2. Save table order with recipe additions
      const orderPayload = {
        items: [
          {
            productId: createdProductId,
            quantity: 1,
            price: 15500,
            notes: 'Mermelada de Mora Silvestre Orgánica (+$2,500) | Servir bien frío',
          },
        ],
      };

      const saveRes = await api.request(`/tables/${testTable.id}/save`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify(orderPayload),
      });

      expect(saveRes.status).toBe(200);
      const saveData = await saveRes.json();
      expect(saveData.sale.items).toHaveLength(1);
      expect(saveData.sale.items[0].notes).toBe(
        'Mermelada de Mora Silvestre Orgánica (+$2,500) | Servir bien frío'
      );
      expect(Number(saveData.sale.items[0].price)).toBe(15500);

      // 3. Checkout table
      const checkoutRes = await api.request(`/tables/${testTable.id}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({
          payments: [{ method: 'TRANSFER', amount: 15500 }],
        }),
      });

      expect(checkoutRes.status).toBe(200);
      const checkoutData = await checkoutRes.json();
      expect(checkoutData.sale.items[0].notes).toBe(
        'Mermelada de Mora Silvestre Orgánica (+$2,500) | Servir bien frío'
      );
    });
  });
});
