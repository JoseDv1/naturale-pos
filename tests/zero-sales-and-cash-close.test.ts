import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import api from '../src/api';
import { prisma } from '../src/db';
import { getAuthSessions, AuthSession, createTestProduct, resetTestShifts, setSuiteIsLifecycle, openTestShift } from './fixtures/test-setup';

describe('QA Audit: $0 Sales, Free Products & $0 Cash Close', () => {
  let auth: AuthSession;
  let testProductNormal: any;
  let testProductFree: any;
  let testTable: any;

  beforeAll(async () => {
    auth = await getAuthSessions();
    setSuiteIsLifecycle(true);
    await resetTestShifts();

    // Create a fresh test shift with initialCash = 50000
    await openTestShift(auth.cashierUser.id, 50000);

    const cat = await prisma.category.findFirst();

    // Product with normal price
    testProductNormal = await createTestProduct({
      name: 'QA Normal Item',
      price: 15000,
      cost: 5000,
      stock: 50,
      department: 'GENERAL',
      categoryId: cat!.id,
    });

    // Product with 0 price (e.g. promotional courtesy / degustación)
    testProductFree = await createTestProduct({
      name: 'QA Courtesy Item Free',
      price: 0,
      cost: 1000,
      stock: 30,
      department: 'GENERAL',
      categoryId: cat!.id,
    });

    // Test Table
    testTable = await prisma.cafeTable.create({
      data: {
        name: `Mesa QA Zero-${Date.now()}`,
        status: 'AVAILABLE',
      },
    });
  });

  afterAll(async () => {
    try {
      if (testProductNormal) {
        await prisma.saleItem.deleteMany({ where: { productId: testProductNormal.id } });
        await prisma.product.delete({ where: { id: testProductNormal.id } }).catch(() => {});
      }
      if (testProductFree) {
        await prisma.saleItem.deleteMany({ where: { productId: testProductFree.id } });
        await prisma.product.delete({ where: { id: testProductFree.id } }).catch(() => {});
      }
      if (testTable) {
        await prisma.cafeTable.delete({ where: { id: testTable.id } }).catch(() => {});
      }
    } catch {}
    setSuiteIsLifecycle(false);
    await openTestShift();
  });

  // ===========================================================================
  // SECTION 1: Direct Sales Schema & Execution (src/routes/sales.ts)
  // ===========================================================================

  describe('1. Direct Sales ($0 Sales & Schema Edge Cases)', () => {
    it('TC-SALE-01: Rejects negative sale total with 400', async () => {
      const res = await api.request('/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          userId: auth.cashierUser.id,
          total: -5000,
          items: [{ productId: testProductNormal.id, quantity: 1, price: -5000 }],
          payments: [{ method: 'CASH', amount: -5000 }],
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('TC-SALE-02: Rejects negative payment amount with 400', async () => {
      const res = await api.request('/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          userId: auth.cashierUser.id,
          total: 0,
          items: [{ productId: testProductFree.id, quantity: 1, price: 0 }],
          payments: [{ method: 'CASH', amount: -100 }],
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('no puede ser negativo');
    });

    it('TC-SALE-03: Rejects sale with total > 0 when payments array is empty []', async () => {
      const res = await api.request('/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          userId: auth.cashierUser.id,
          total: 15000,
          items: [{ productId: testProductNormal.id, quantity: 1, price: 15000 }],
          payments: [],
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('La venta debe contener al menos un método de pago');
    });

    it('TC-SALE-04: Rejects sale with total = 0 when payments sum > 0', async () => {
      const res = await api.request('/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          userId: auth.cashierUser.id,
          total: 0,
          items: [{ productId: testProductFree.id, quantity: 1, price: 0 }],
          payments: [{ method: 'CASH', amount: 5000 }],
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Una venta con total cero no puede tener pagos mayores a cero');
    });

    it('TC-SALE-05: Processes free courtesy sale ($0 total, empty payments array [])', async () => {
      const initialStock = (await prisma.product.findUnique({ where: { id: testProductFree.id } }))!.stock;

      const res = await api.request('/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          userId: auth.cashierUser.id,
          total: 0,
          items: [{ productId: testProductFree.id, quantity: 2, price: 0, notes: 'Degustación de cortesía' }],
          payments: [],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.sale).toBeDefined();
      expect(Number(data.sale.total)).toBe(0);
      expect(data.sale.status).toBe('COMPLETED');
      expect(data.sale.payments.length).toBe(0);

      // Verify stock was decremented properly
      const updatedProduct = await prisma.product.findUnique({ where: { id: testProductFree.id } });
      expect(updatedProduct!.stock).toBe(initialStock - 2);
    });

    it('TC-SALE-06: Processes free courtesy sale ($0 total, payment with amount 0)', async () => {
      const initialStock = (await prisma.product.findUnique({ where: { id: testProductFree.id } }))!.stock;

      const res = await api.request('/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          userId: auth.cashierUser.id,
          total: 0,
          items: [{ productId: testProductFree.id, quantity: 1, price: 0 }],
          payments: [{ method: 'CASH', amount: 0 }],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Number(data.sale.total)).toBe(0);
      expect(data.sale.status).toBe('COMPLETED');
      expect(data.sale.payments.length).toBe(1);
      expect(Number(data.sale.payments[0].amount)).toBe(0);

      const updatedProduct = await prisma.product.findUnique({ where: { id: testProductFree.id } });
      expect(updatedProduct!.stock).toBe(initialStock - 1);
    });
  });

  // ===========================================================================
  // SECTION 2: Table Routes ($0 Orders, Checkout & Partial Checkout)
  // ===========================================================================

  describe('2. Table Routes ($0 Checkout & Partial Checkout)', () => {
    it('TC-TBL-01: Table checkout with total > 0 rejects empty payments array with 400', async () => {
      // 1. Open table
      await api.request(`/tables/${testTable.id}/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ userId: auth.cashierUser.id }),
      });

      // 2. Save normal item (total 15000)
      await api.request(`/tables/${testTable.id}/save`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          items: [{ productId: testProductNormal.id, quantity: 1, price: 15000 }],
        }),
      });

      // 3. Attempt checkout with empty payments
      const checkoutRes = await api.request(`/tables/${testTable.id}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          payments: [],
        }),
      });

      expect(checkoutRes.status).toBe(400);
      const data = await checkoutRes.json();
      expect(data.error).toContain('La suma de pagos no coincide con el total de la cuenta');

      // Cancel table sale to leave table ready for next tests
      await api.request(`/tables/${testTable.id}/cancel`, {
        method: 'POST',
        headers: { Cookie: auth.cashierCookie },
      });
    });

    it('TC-TBL-02: Table checkout with total $0 succeeds with empty payments array []', async () => {
      // 1. Open table
      await api.request(`/tables/${testTable.id}/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ userId: auth.cashierUser.id }),
      });

      // 2. Save free item (total $0)
      const saveRes = await api.request(`/tables/${testTable.id}/save`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          items: [{ productId: testProductFree.id, quantity: 1, price: 0, notes: 'Degustación mesa' }],
        }),
      });
      expect(saveRes.status).toBe(200);

      // Verify table is OCCUPIED with total 0
      const tableCheck = await prisma.cafeTable.findUnique({
        where: { id: testTable.id },
        include: { currentSale: true },
      });
      expect(tableCheck!.status).toBe('OCCUPIED');
      expect(Number(tableCheck!.currentSale!.total)).toBe(0);

      // 3. Checkout table with empty payments array []
      const checkoutRes = await api.request(`/tables/${testTable.id}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          payments: [],
        }),
      });

      expect(checkoutRes.status).toBe(200);
      const data = await checkoutRes.json();
      expect(data.success).toBe(true);
      expect(data.sale.status).toBe('COMPLETED');
      expect(Number(data.sale.total)).toBe(0);

      // Verify table is now AVAILABLE
      const freedTable = await prisma.cafeTable.findUnique({ where: { id: testTable.id } });
      expect(freedTable!.status).toBe('AVAILABLE');
      expect(freedTable!.currentSaleId).toBeNull();
    });

    it('TC-TBL-03: Table partial checkout of $0 item succeeds with payments: []', async () => {
      // 1. Open table
      await api.request(`/tables/${testTable.id}/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ userId: auth.cashierUser.id }),
      });

      // 2. Save 1 normal item ($15000) and 1 free item ($0)
      await api.request(`/tables/${testTable.id}/save`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          items: [
            { productId: testProductNormal.id, quantity: 1, price: 15000 },
            { productId: testProductFree.id, quantity: 1, price: 0 },
          ],
        }),
      });

      // 3. Partial checkout only the free item ($0 total) with payments: []
      const partialRes = await api.request(`/tables/${testTable.id}/partial-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          userId: auth.cashierUser.id,
          items: [{ productId: testProductFree.id, quantity: 1, price: 0 }],
          payments: [],
        }),
      });

      expect(partialRes.status).toBe(200);
      const data = await partialRes.json();
      expect(data.success).toBe(true);
      expect(Number(data.sale.total)).toBe(0);
      expect(data.sale.status).toBe('COMPLETED');

      // Table should remain OCCUPIED with the normal item remaining
      const occupiedTable = await prisma.cafeTable.findUnique({
        where: { id: testTable.id },
        include: { currentSale: { include: { items: true } } },
      });
      expect(occupiedTable!.status).toBe('OCCUPIED');
      expect(occupiedTable!.currentSale!.items.length).toBe(1);
      expect(occupiedTable!.currentSale!.items[0].productId).toBe(testProductNormal.id);

      // Clean up table
      await api.request(`/tables/${testTable.id}/cancel`, {
        method: 'POST',
        headers: { Cookie: auth.cashierCookie },
      });
    });

    it('TC-TBL-04: Table partial checkout of $0 item rejects payments > 0 with 400', async () => {
      // 1. Open table
      await api.request(`/tables/${testTable.id}/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ userId: auth.cashierUser.id }),
      });

      // 2. Save 1 free item
      await api.request(`/tables/${testTable.id}/save`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          items: [{ productId: testProductFree.id, quantity: 1, price: 0 }],
        }),
      });

      // 3. Attempt partial checkout of $0 item with $1000 payment
      const partialRes = await api.request(`/tables/${testTable.id}/partial-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          userId: auth.cashierUser.id,
          items: [{ productId: testProductFree.id, quantity: 1, price: 0 }],
          payments: [{ method: 'CASH', amount: 1000 }],
        }),
      });

      expect(partialRes.status).toBe(400);
      const data = await partialRes.json();
      expect(data.error).toContain('La suma de pagos no coincide');

      // Clean up
      await api.request(`/tables/${testTable.id}/cancel`, {
        method: 'POST',
        headers: { Cookie: auth.cashierCookie },
      });
    });

    it('TC-TBL-05: Table checkout with total $0 succeeds with payment amount 0', async () => {
      // 1. Open table
      await api.request(`/tables/${testTable.id}/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ userId: auth.cashierUser.id }),
      });

      // 2. Save free item ($0 total)
      await api.request(`/tables/${testTable.id}/save`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          items: [{ productId: testProductFree.id, quantity: 1, price: 0 }],
        }),
      });

      // 3. Checkout with payment of amount 0
      const checkoutRes = await api.request(`/tables/${testTable.id}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          payments: [{ method: 'CASH', amount: 0 }],
        }),
      });

      expect(checkoutRes.status).toBe(200);
      const data = await checkoutRes.json();
      expect(data.success).toBe(true);
      expect(Number(data.sale.total)).toBe(0);
      expect(data.sale.status).toBe('COMPLETED');
      expect(data.sale.payments.length).toBe(1);
      expect(Number(data.sale.payments[0].amount)).toBe(0);

      // Verify table is freed
      const freedTable = await prisma.cafeTable.findUnique({ where: { id: testTable.id } });
      expect(freedTable!.status).toBe('AVAILABLE');
    });

    it('TC-TBL-06: Rejects negative payment amount on table checkout with 400', async () => {
      const checkoutRes = await api.request(`/tables/${testTable.id}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          payments: [{ method: 'CASH', amount: -500 }],
        }),
      });

      expect(checkoutRes.status).toBe(400);
      const data = await checkoutRes.json();
      expect(data.error).toContain('no puede ser negativo');
    });
  });

  // ===========================================================================
  // SECTION 3: Shift Closing Logic & Arqueo with $0 Cash (src/routes/shifts.ts)
  // ===========================================================================

  describe('3. Shift Closing & $0 Cash Arqueo Calculations', () => {
    it('TC-SHIFT-01: Rejects negative actualCash with 400', async () => {
      const res = await api.request('/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          actualCash: -500,
          notes: 'Negative cash test',
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('debe ser mayor o igual a cero');
    });

    it('TC-SHIFT-02: Successfully closes active shift with actualCash = 0 when expectedCash > 0', async () => {
      // Current active shift was opened with initialCash = 50000.
      // Expected cash is at least 50000.
      // Cashier counts 0 cash in drawer (e.g. money stolen, drawer emptied, or all cash deposited).
      const res = await api.request('/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          actualCash: 0,
          notes: 'Cierre con cero efectivo en caja',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('Turno de caja cerrado exitosamente');
      expect(data.report).toBeDefined();

      const report = data.report;
      expect(report.shift.status).toBe('CLOSED');
      expect(report.actualCash).toBe(0);
      expect(report.expectedCash).toBeGreaterThanOrEqual(50000);
      // Difference must be precisely 0 - expectedCash (negative difference indicating shortage)
      expect(report.difference).toBe(0 - report.expectedCash);
    });

    it('TC-SHIFT-03: Successfully opens shift with initialCash = 0 and closes with actualCash = 0 (difference = 0)', async () => {
      // 1. Open shift with $0 initial cash
      const openRes = await api.request('/shifts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          initialCash: 0,
          notes: 'Turno iniciado en 0 base',
        }),
      });

      expect(openRes.status).toBe(201);
      const openData = await openRes.json();
      expect(Number(openData.shift.initialCash)).toBe(0);
      expect(openData.shift.status).toBe('OPEN');

      // 2. Perform a free courtesy sale ($0) in this shift
      const saleRes = await api.request('/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          userId: auth.cashierUser.id,
          total: 0,
          items: [{ productId: testProductFree.id, quantity: 1, price: 0 }],
          payments: [],
        }),
      });
      expect(saleRes.status).toBe(200);

      // 3. Verify real-time totals report $0 expected cash and salesCount includes free sale
      const currentRes = await api.request('/shifts/current', {
        headers: { Cookie: auth.cashierCookie },
      });
      expect(currentRes.status).toBe(200);
      const currentData = await currentRes.json();
      expect(currentData.realTimeTotals.initialCash).toBe(0);
      expect(currentData.realTimeTotals.cashSales).toBe(0);
      expect(currentData.realTimeTotals.expectedCash).toBe(0);
      expect(currentData.realTimeTotals.totalSales).toBe(0);
      expect(currentData.realTimeTotals.salesCount).toBeGreaterThanOrEqual(1);

      // 4. Close shift with actualCash = 0
      const closeRes = await api.request('/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          actualCash: 0,
          notes: 'Cierre perfecto balanceado en cero',
        }),
      });

      expect(closeRes.status).toBe(200);
      const closeData = await closeRes.json();
      const report = closeData.report;

      expect(report.actualCash).toBe(0);
      expect(report.expectedCash).toBe(0);
      expect(report.difference).toBe(0);
      expect(report.totalSales).toBe(0);
    });
  });
});
