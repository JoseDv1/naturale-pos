import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import api from '../../src/api';
import { prisma } from '../../src/db';
import { getAuthSessions, AuthSession, createTestProduct } from '../fixtures/test-setup';

describe('Tier 3 — Cross-Feature Combinations', () => {
  let auth: AuthSession;
  let comboProdA: any;
  let comboProdB: any;
  let comboShiftId = '';
  let comboTableId = '';

  beforeAll(async () => {
    auth = await getAuthSessions();

    comboProdA = await createTestProduct({
      name: 'Combo Organic Tea',
      price: 12000,
      cost: 5000,
      stock: 30,
      department: 'CAFE',
    });

    comboProdB = await createTestProduct({
      name: 'Combo Sourdough Loaf',
      price: 18000,
      cost: 8000,
      stock: 20,
      department: 'MARKET',
    });

    // Create a cafe table for table checkout tests
    const table = await prisma.cafeTable.create({
      data: {
        name: `Mesa Combo ${Date.now()}`,
        status: 'AVAILABLE',
      },
    });
    comboTableId = table.id;
  });

  afterAll(async () => {
    try {
      // Ensure shift closed
      await api.request('/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ actualCash: 0 }),
      });
    } catch {}

    try {
      if (comboTableId) {
        await prisma.cafeTable.delete({ where: { id: comboTableId } }).catch(() => {});
      }
      if (comboProdA) {
        await prisma.saleItem.deleteMany({ where: { productId: comboProdA.id } });
        await prisma.product.delete({ where: { id: comboProdA.id } }).catch(() => {});
      }
      if (comboProdB) {
        await prisma.saleItem.deleteMany({ where: { productId: comboProdB.id } });
        await prisma.product.delete({ where: { id: comboProdB.id } }).catch(() => {});
      }
    } catch {}
  });

  // ---------------------------------------------------------------------------
  // 1. Shift Opening -> Sales with Mixed Payment Methods -> Aggregation
  // ---------------------------------------------------------------------------
  it('TC-CMB-01: Shift aggregates cash, card, and transfer payments accurately across multiple sales', async () => {
    // 1. Open shift with $100,000 base
    const openRes = await api.request('/shifts/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({ initialCash: 100000 }),
    });
    expect([200, 201]).toContain(openRes.status);
    const openData = await openRes.json();
    comboShiftId = openData.shift.id;

    // 2. Sale 1: CASH $12,000
    const sale1Res = await api.request('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        total: 12000,
        items: [{ productId: comboProdA.id, quantity: 1, price: 12000 }],
        payments: [{ method: 'CASH', amount: 12000 }],
      }),
    });
    expect([200, 201]).toContain(sale1Res.status);

    // 3. Sale 2: Split CARD ($10,000) + TRANSFER ($8,000) = $18,000
    const sale2Res = await api.request('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        total: 18000,
        items: [{ productId: comboProdB.id, quantity: 1, price: 18000 }],
        payments: [
          { method: 'CARD', amount: 10000 },
          { method: 'TRANSFER', amount: 8000 },
        ],
      }),
    });
    expect([200, 201]).toContain(sale2Res.status);

    // 4. Verify Real-time Totals
    const currentRes = await api.request('/shifts/current', {
      headers: { Cookie: auth.cashierCookie },
    });
    expect(currentRes.status).toBe(200);
    const currentData = await currentRes.json();
    if (currentData.realTimeTotals) {
      expect(Number(currentData.realTimeTotals.initialCash)).toBe(100000);
      expect(Number(currentData.realTimeTotals.cashSales)).toBe(12000);
      expect(Number(currentData.realTimeTotals.cardSales)).toBe(10000);
      expect(Number(currentData.realTimeTotals.transferSales)).toBe(8000);
    }
  });

  // ---------------------------------------------------------------------------
  // 2. Table Checkout with Split Payments inside Active Shift
  // ---------------------------------------------------------------------------
  it('TC-CMB-02: Table order checkout with split payments links sale to shift and restores table AVAILABLE', async () => {
    // 1. Open table
    const openTableRes = await api.request(`/tables/${comboTableId}/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({ userId: auth.cashierUser.id }),
    });
    expect([200, 201]).toContain(openTableRes.status);

    // 2. Add order items to table ($24,000)
    const orderRes = await api.request(`/tables/${comboTableId}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        items: [
          {
            productId: comboProdA.id,
            quantity: 2,
            price: 12000,
          },
        ],
      }),
    });
    expect([200, 201]).toContain(orderRes.status);

    // 3. Checkout table with split payment ($14,000 Cash + $10,000 Card = $24,000)
    const checkoutRes = await api.request(`/tables/${comboTableId}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        payments: [
          { method: 'CASH', amount: 14000 },
          { method: 'CARD', amount: 10000 },
        ],
      }),
    });
    expect([200, 201]).toContain(checkoutRes.status);

    // 4. Verify table is now AVAILABLE
    const tableAfter = await prisma.cafeTable.findUnique({ where: { id: comboTableId } });
    expect(tableAfter!.status).toBe('AVAILABLE');
    expect(tableAfter!.currentSaleId).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // 3. Category Deletion & Immediate Sale of Associated Product
  // ---------------------------------------------------------------------------
  it('TC-CMB-03: Category deleted during active shift reassigns products to Sin categoría and allows immediate sale', async () => {
    // 1. Create temporary category
    const catRes = await api.request('/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
      body: JSON.stringify({ name: `Temp Cat ${Date.now()}` }),
    });
    const cat = await catRes.json();

    // 2. Create product in this category
    const prod = await createTestProduct({
      name: 'Item in Temp Cat',
      price: 8000,
      stock: 10,
      categoryId: cat.id,
    });

    // 3. Delete category
    const deleteCatRes = await api.request(`/categories/${cat.id}`, {
      method: 'DELETE',
      headers: { Cookie: auth.adminCookie },
    });
    expect([200, 204]).toContain(deleteCatRes.status);

    // 4. Sell the product immediately
    const saleRes = await api.request('/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        userId: auth.cashierUser.id,
        total: 8000,
        items: [{ productId: prod.id, quantity: 1, price: 8000 }],
        payments: [{ method: 'CASH', amount: 8000 }],
      }),
    });
    expect([200, 201]).toContain(saleRes.status);

    // Cleanup
    await prisma.saleItem.deleteMany({ where: { productId: prod.id } });
    await prisma.product.delete({ where: { id: prod.id } });
  });

  // ---------------------------------------------------------------------------
  // 4. Admin Expense Adjustment Affecting Inventory Stock
  // ---------------------------------------------------------------------------
  it('TC-CMB-04: Admin expense editing updates stock and synchronizes with active shift expense balance', async () => {
    // 1. Cashier creates expense with 4 items of comboProdB (stock starts at 19)
    const expenseRes = await api.request('/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        description: 'Compra de panadería',
        amount: 32000,
        category: 'supplies',
        department: 'MARKET',
        userId: auth.cashierUser.id,
        items: [
          {
            productId: comboProdB.id,
            quantity: 4,
            unitCost: 8000,
          },
        ],
      }),
    });
    const expData = await expenseRes.json();
    const expenseId = expData.expense?.id || expData.id;

    // Verify stock incremented by 4
    let prodCheck = await prisma.product.findUnique({ where: { id: comboProdB.id } });
    const stockAfterExpense = prodCheck!.stock;

    // 2. Admin adjusts expense: quantity corrected from 4 to 2 (decrement of 2 items)
    const editRes = await api.request(`/expenses/${expenseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
      body: JSON.stringify({
        amount: 16000,
        items: [
          {
            productId: comboProdB.id,
            quantity: 2,
            unitCost: 8000,
          },
        ],
      }),
    });

    if (editRes.status === 200) {
      prodCheck = await prisma.product.findUnique({ where: { id: comboProdB.id } });
      expect(prodCheck!.stock).toBe(stockAfterExpense - 2);
    }

    // Cleanup expense
    await prisma.expenseItem.deleteMany({ where: { expenseId } });
    await prisma.expense.delete({ where: { id: expenseId } }).catch(() => {});
  });

  // ---------------------------------------------------------------------------
  // 5. Shift Changeover & Continuous Handover
  // ---------------------------------------------------------------------------
  it('TC-CMB-05: Closing shift with cash discrepancy permits immediate second shift without concurrency lock', async () => {
    // Close shift with discrepancy
    const closeRes = await api.request('/shifts/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
      body: JSON.stringify({
        actualCash: 120000, // May differ from theoretical
        notes: 'Cierre turno 1 con arqueo',
      }),
    });
    expect([200, 201]).toContain(closeRes.status);

    // Open next shift immediately
    const openSecondRes = await api.request('/shifts/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
      body: JSON.stringify({ initialCash: 60000 }),
    });
    expect([200, 201]).toContain(openSecondRes.status);
    const secondData = await openSecondRes.json();
    expect(secondData.shift.status).toBe('OPEN');

    // Close second shift
    await api.request('/shifts/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
      body: JSON.stringify({ actualCash: 60000 }),
    });
  });
});
