import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import api from '../src/api';
import { prisma } from '../src/db';

describe('Table Merging & Splitting API Endpoints', () => {
  let adminCookie = '';
  let cashierCookie = '';
  let cashierUser: any = null;
  let testTableA: any = null;
  let testTableB: any = null;
  let testTableC: any = null;
  let testProduct1: any = null;
  let testProduct2: any = null;

  beforeAll(async () => {
    // 1. Authenticate admin & cashier
    const adminLoginRes = await api.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', pin: '1234' }),
    });
    const adminSetCookie = adminLoginRes.headers.get('set-cookie');
    adminCookie = adminSetCookie!.split(';')[0];

    const cashierLoginRes = await api.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'cajero', pin: '0000' }),
    });
    const cashierSetCookie = cashierLoginRes.headers.get('set-cookie');
    cashierCookie = cashierSetCookie!.split(';')[0];
    const cashierBody = await cashierLoginRes.json();
    cashierUser = cashierBody.user;

    // 2. Create test products
    const cat = await prisma.category.findFirst();
    testProduct1 = await prisma.product.create({
      data: {
        sku: `TEST-SPLIT-P1-${Date.now()}`,
        name: 'Café Espresso Test',
        price: 3000,
        cost: 1000,
        stock: 50,
        department: 'CAFE',
        categoryId: cat!.id,
      },
    });

    testProduct2 = await prisma.product.create({
      data: {
        sku: `TEST-SPLIT-P2-${Date.now()}`,
        name: 'Croissant Test',
        price: 6000,
        cost: 2500,
        stock: 30,
        department: 'CAFE',
        categoryId: cat!.id,
      },
    });

    // 3. Create test tables
    testTableA = await prisma.cafeTable.create({
      data: { name: `Mesa Test A ${Date.now()}`, status: 'AVAILABLE', x: 20, y: 20 },
    });
    testTableB = await prisma.cafeTable.create({
      data: { name: `Mesa Test B ${Date.now()}`, status: 'AVAILABLE', x: 40, y: 40 },
    });
    testTableC = await prisma.cafeTable.create({
      data: { name: `Mesa Test C ${Date.now()}`, status: 'AVAILABLE', x: 60, y: 60 },
    });
  });

  afterAll(async () => {
    // Cleanup created test records
    await prisma.cafeTable.deleteMany({
      where: { id: { in: [testTableA.id, testTableB.id, testTableC.id] } },
    });
    // Soft-delete test products
    await prisma.product.updateMany({
      where: { id: { in: [testProduct1.id, testProduct2.id] } },
      data: { active: false },
    });
  });

  // =========================================================================
  // 1. POST /tables/:id/merge Tests
  // =========================================================================
  describe('POST /tables/:id/merge', () => {
    it('should reject merging table with itself', async () => {
      const res = await api.request(`/tables/${testTableA.id}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({ targetTableId: testTableA.id }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('consigo misma');
    });

    it('should reject when source table is not occupied', async () => {
      const res = await api.request(`/tables/${testTableA.id}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({ targetTableId: testTableB.id }),
      });
      expect(res.status).toBe(400);
    });

    it('should move entire table to an AVAILABLE target table', async () => {
      // 1. Open and populate Table A
      await api.request(`/tables/${testTableA.id}/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({ userId: cashierUser.id }),
      });

      await api.request(`/tables/${testTableA.id}/save`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({
          items: [
            { productId: testProduct1.id, quantity: 2, price: 3000 },
          ],
        }),
      });

      // 2. Merge Table A into Table B (available)
      const mergeRes = await api.request(`/tables/${testTableA.id}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({ targetTableId: testTableB.id }),
      });

      expect(mergeRes.status).toBe(200);
      const mergeData = await mergeRes.json();
      expect(mergeData.success).toBe(true);
      expect(mergeData.source.status).toBe('AVAILABLE');
      expect(mergeData.source.currentSaleId).toBeNull();
      expect(mergeData.target.status).toBe('OCCUPIED');
      expect(Number(mergeData.target.currentSale.total)).toBe(6000);
      expect(mergeData.target.currentSale.items.length).toBe(1);
    });

    it('should consolidate items when merging into an OCCUPIED target table', async () => {
      // At this point Table B is OCCUPIED with 2 of testProduct1 ($6000).
      // Let's re-open Table A and add 1 testProduct1 ($3000) and 1 testProduct2 ($6000).
      await api.request(`/tables/${testTableA.id}/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({ userId: cashierUser.id }),
      });

      await api.request(`/tables/${testTableA.id}/save`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({
          items: [
            { productId: testProduct1.id, quantity: 1, price: 3000 },
            { productId: testProduct2.id, quantity: 1, price: 6000 },
          ],
        }),
      });

      // Merge Table A into Table B
      const mergeRes = await api.request(`/tables/${testTableA.id}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({ targetTableId: testTableB.id }),
      });

      expect(mergeRes.status).toBe(200);
      const mergeData = await mergeRes.json();
      expect(mergeData.success).toBe(true);
      expect(mergeData.source.status).toBe('AVAILABLE');

      // Target Table B should have consolidated testProduct1 (2 + 1 = 3 items) and testProduct2 (1 item)
      // Total = (3 * 3000) + (1 * 6000) = 15000
      expect(mergeData.target.status).toBe('OCCUPIED');
      expect(Number(mergeData.target.currentSale.total)).toBe(15000);

      const p1Item = mergeData.target.currentSale.items.find((i: any) => i.productId === testProduct1.id);
      expect(p1Item.quantity).toBe(3);

      const p2Item = mergeData.target.currentSale.items.find((i: any) => i.productId === testProduct2.id);
      expect(p2Item.quantity).toBe(1);

      // Free Table B for next tests
      await api.request(`/tables/${testTableB.id}/cancel`, {
        method: 'POST',
        headers: { Cookie: cashierCookie },
      });
    });
  });

  // =========================================================================
  // 2. POST /tables/:id/transfer-items Tests
  // =========================================================================
  describe('POST /tables/:id/transfer-items', () => {
    beforeAll(async () => {
      // Set up Table A with 3 testProduct1 ($3000 ea) and 2 testProduct2 ($6000 ea) -> Total: 21000
      await api.request(`/tables/${testTableA.id}/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({ userId: cashierUser.id }),
      });

      await api.request(`/tables/${testTableA.id}/save`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({
          items: [
            { productId: testProduct1.id, quantity: 3, price: 3000 },
            { productId: testProduct2.id, quantity: 2, price: 6000 },
          ],
        }),
      });
    });

    it('should reject transferring more quantity than available in source', async () => {
      const res = await api.request(`/tables/${testTableA.id}/transfer-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({
          targetTableId: testTableB.id,
          items: [{ productId: testProduct1.id, quantity: 5 }], // only 3 exist!
        }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('mayor a la existente');
    });

    it('should partially transfer items to an AVAILABLE table (Table C)', async () => {
      // Transfer 1 of testProduct1 ($3000) to Table C
      const res = await api.request(`/tables/${testTableA.id}/transfer-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({
          targetTableId: testTableC.id,
          items: [{ productId: testProduct1.id, quantity: 1 }],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Source Table A should still be OCCUPIED with 2 p1 ($6000) + 2 p2 ($12000) = 18000
      expect(data.source.status).toBe('OCCUPIED');
      expect(Number(data.source.currentSale.total)).toBe(18000);

      // Target Table C should now be OCCUPIED with 1 p1 ($3000)
      expect(data.target.status).toBe('OCCUPIED');
      expect(Number(data.target.currentSale.total)).toBe(3000);

      // Clean up Table C
      await api.request(`/tables/${testTableC.id}/cancel`, {
        method: 'POST',
        headers: { Cookie: cashierCookie },
      });
    });

    it('should free source table when ALL remaining items are transferred', async () => {
      // Table A currently has 2 p1 and 2 p2. Transfer all of them to Table B.
      const res = await api.request(`/tables/${testTableA.id}/transfer-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({
          targetTableId: testTableB.id,
          items: [
            { productId: testProduct1.id, quantity: 2 },
            { productId: testProduct2.id, quantity: 2 },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Table A should be freed
      expect(data.source.status).toBe('AVAILABLE');
      expect(data.source.currentSaleId).toBeNull();

      // Table B should be occupied with all items (total: 18000)
      expect(data.target.status).toBe('OCCUPIED');
      expect(Number(data.target.currentSale.total)).toBe(18000);

      // Clean up Table B
      await api.request(`/tables/${testTableB.id}/cancel`, {
        method: 'POST',
        headers: { Cookie: cashierCookie },
      });
    });
  });

  // =========================================================================
  // 3. POST /tables/:id/partial-checkout Tests
  // =========================================================================
  describe('POST /tables/:id/partial-checkout', () => {
    beforeAll(async () => {
      // Open Table A with 2 p1 ($3000 ea) and 1 p2 ($6000 ea) -> Total: 12000
      await api.request(`/tables/${testTableA.id}/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({ userId: cashierUser.id }),
      });

      await api.request(`/tables/${testTableA.id}/save`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({
          items: [
            { productId: testProduct1.id, quantity: 2, price: 3000 },
            { productId: testProduct2.id, quantity: 1, price: 6000 },
          ],
        }),
      });
    });

    it('should reject when payment amount does not match items total', async () => {
      const res = await api.request(`/tables/${testTableA.id}/partial-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({
          userId: cashierUser.id,
          items: [{ productId: testProduct1.id, quantity: 1, price: 3000 }],
          payments: [{ method: 'CASH', amount: 2000 }], // 2000 != 3000
        }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('coincide');
    });

    it('should process partial checkout, creating a COMPLETED sale and keeping remaining items on table', async () => {
      // Checkout 1 of testProduct1 ($3000)
      const res = await api.request(`/tables/${testTableA.id}/partial-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({
          userId: cashierUser.id,
          items: [{ productId: testProduct1.id, quantity: 1, price: 3000 }],
          payments: [{ method: 'CASH', amount: 3000 }],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify the new completed sale
      expect(data.sale.status).toBe('COMPLETED');
      expect(Number(data.sale.total)).toBe(3000);
      expect(data.sale.items.length).toBe(1);
      expect(data.sale.payments.length).toBe(1);

      // Verify Table A is still OCCUPIED with remaining 1 p1 ($3000) + 1 p2 ($6000) = 9000
      expect(data.table.status).toBe('OCCUPIED');
      expect(Number(data.table.currentSale.total)).toBe(9000);
      expect(data.table.currentSale.items.length).toBe(2);
    });

    it('should free table when the final remaining items are checked out', async () => {
      // Remaining on Table A: 1 p1 ($3000) + 1 p2 ($6000) = $9000
      const res = await api.request(`/tables/${testTableA.id}/partial-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cashierCookie },
        body: JSON.stringify({
          userId: cashierUser.id,
          items: [
            { productId: testProduct1.id, quantity: 1, price: 3000 },
            { productId: testProduct2.id, quantity: 1, price: 6000 },
          ],
          payments: [
            { method: 'CARD', amount: 9000 },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Completed sale
      expect(data.sale.status).toBe('COMPLETED');
      expect(Number(data.sale.total)).toBe(9000);

      // Table A should now be AVAILABLE
      expect(data.table.status).toBe('AVAILABLE');
      expect(data.table.currentSaleId).toBeNull();
    });
  });
});
