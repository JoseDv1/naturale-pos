import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import api from '../src/api';
import { prisma } from '../src/db';
import {
  getAuthSessions,
  AuthSession,
  createTestProduct,
  resetTestShifts,
  setSuiteIsLifecycle,
  openTestShift,
} from './fixtures/test-setup';

describe('Empirical Challenger M1: Shifts & Arqueo Stress Test Suite', () => {
  let auth: AuthSession;
  let testProdStandard: any;
  let testProdDecimal: any;
  let testTable: any;
  const createdSaleIds: string[] = [];
  const createdExpenseIds: string[] = [];

  beforeAll(async () => {
    setSuiteIsLifecycle(true);
    auth = await getAuthSessions();
    await resetTestShifts();

    testProdStandard = await createTestProduct({
      name: 'Stress Standard Product',
      price: 10000,
      cost: 4000,
      stock: 1000,
      department: 'MARKET',
    });

    testProdDecimal = await createTestProduct({
      name: 'Stress Decimal Product',
      price: 49.99,
      cost: 20.0,
      stock: 1000,
      department: 'MARKET',
    });

    testTable = await prisma.cafeTable.create({
      data: {
        name: `Mesa Stress ${Date.now()}`,
        status: 'AVAILABLE',
        x: 10,
        y: 10,
      },
    });
  });

  beforeEach(async () => {
    setSuiteIsLifecycle(true);
  });

  afterAll(async () => {
    try {
      // Force close any lingering open shift
      await resetTestShifts();

      // Clean up sales, expenses, table, products
      for (const sId of createdSaleIds) {
        await prisma.salePayment.deleteMany({ where: { saleId: sId } });
        await prisma.saleItem.deleteMany({ where: { saleId: sId } });
        await prisma.sale.delete({ where: { id: sId } }).catch(() => {});
      }
      for (const eId of createdExpenseIds) {
        await prisma.expenseItem.deleteMany({ where: { expenseId: eId } });
        await prisma.expense.delete({ where: { id: eId } }).catch(() => {});
      }
      if (testTable) {
        await prisma.cafeTable.delete({ where: { id: testTable.id } }).catch(() => {});
      }
      if (testProdStandard) {
        await prisma.saleItem.deleteMany({ where: { productId: testProdStandard.id } });
        await prisma.product.delete({ where: { id: testProdStandard.id } }).catch(() => {});
      }
      if (testProdDecimal) {
        await prisma.saleItem.deleteMany({ where: { productId: testProdDecimal.id } });
        await prisma.product.delete({ where: { id: testProdDecimal.id } }).catch(() => {});
      }
    } catch {}

    setSuiteIsLifecycle(false);
    await openTestShift();
  });

  // ===========================================================================
  // 1. Zero Cash Opening & Negative / Invalid Amount Rejection
  // ===========================================================================
  describe('1. Zero Cash Opening & Amount Boundary Rejections', () => {
    it('should reject negative initialCash numbers (-1, -50000, -0.01) with HTTP 400', async () => {
      await resetTestShifts();
      const testCases = [-1, -50000, -0.01];

      for (const val of testCases) {
        const res = await api.request('/shifts/open', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
          body: JSON.stringify({ initialCash: val }),
        });

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toBeDefined();
        expect(data.error.toLowerCase()).toContain('cero');
      }
    });

    it('should reject negative string representations ("-100", "-0.5") with HTTP 400', async () => {
      await resetTestShifts();
      const stringCases = ['-100', '-0.5'];

      for (const val of stringCases) {
        const res = await api.request('/shifts/open', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
          body: JSON.stringify({ initialCash: val }),
        });

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toBeDefined();
      }
    });

    it('should reject invalid non-numeric payloads (NaN, string "abc", missing, boolean) with HTTP 400', async () => {
      await resetTestShifts();
      const invalidPayloads = [
        { initialCash: 'abc' },
        { initialCash: null },
        { initialCash: true },
        {},
      ];

      for (const payload of invalidPayloads) {
        const res = await api.request('/shifts/open', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
          body: JSON.stringify(payload),
        });

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toBeDefined();
      }
    });

    it('should accept valid zero cash opening (initialCash: 0)', async () => {
      await resetTestShifts();

      const res = await api.request('/shifts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ initialCash: 0, notes: 'Apertura en cero' }),
      });

      expect([200, 201]).toContain(res.status);
      const data = await res.json();
      expect(data.shift).toBeDefined();
      expect(data.shift.status).toBe('OPEN');
      expect(Number(data.shift.initialCash)).toBe(0);
      expect(data.shift.notes).toBe('Apertura en cero');

      // Close this zero-cash shift
      const closeRes = await api.request('/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ actualCash: 0 }),
      });
      expect([200, 201]).toContain(closeRes.status);
      const closeData = await closeRes.json();
      expect(Number(closeData.report.expectedCash)).toBe(0);
      expect(Number(closeData.report.actualCash)).toBe(0);
      expect(Number(closeData.report.difference)).toBe(0);
    });
  });

  // ===========================================================================
  // 2. Concurrency & Sequential Double-Open Rejection
  // ===========================================================================
  describe('2. Concurrency & Double-Open Rejections', () => {
    it('should reject sequential second open attempt with HTTP 400', async () => {
      await resetTestShifts();

      const firstOpen = await api.request('/shifts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ initialCash: 50000, notes: 'Primer turno' }),
      });
      expect([200, 201]).toContain(firstOpen.status);

      const secondOpen = await api.request('/shifts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
        body: JSON.stringify({ initialCash: 80000, notes: 'Segundo turno intento' }),
      });
      expect(secondOpen.status).toBe(400);
      const secondData = await secondOpen.json();
      expect(secondData.error).toContain('abierto');

      // Clean up
      await api.request('/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ actualCash: 50000 }),
      });
    });

    it('should reject concurrent double-opening: exactly 1 succeeds, others get HTTP 400', async () => {
      await resetTestShifts();

      // Launch 5 simultaneous open requests
      const promises = Array.from({ length: 5 }).map((_, idx) =>
        api.request('/shifts/open', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
          body: JSON.stringify({ initialCash: 50000 + idx * 1000, notes: `Concurrent open ${idx}` }),
        })
      );

      const results = await Promise.all(promises);
      const statuses = results.map((r) => r.status);

      const successCount = statuses.filter((s) => s === 200 || s === 201).length;
      const rejectCount = statuses.filter((s) => s === 400).length;

      expect(successCount).toBe(1);
      expect(rejectCount).toBe(4);

      // Verify only 1 OPEN shift exists in database
      const openShifts = await prisma.shift.findMany({ where: { status: 'OPEN' } });
      expect(openShifts.length).toBe(1);

      // Clean up
      await api.request('/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ actualCash: Number(openShifts[0].initialCash) }),
      });
    });

    it('should reject concurrent double-closing: exactly 1 succeeds, others get HTTP 400', async () => {
      await resetTestShifts();

      const openRes = await api.request('/shifts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ initialCash: 75000 }),
      });
      expect([200, 201]).toContain(openRes.status);

      // Launch 5 simultaneous close requests
      const closePromises = Array.from({ length: 5 }).map((_, idx) =>
        api.request('/shifts/close', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
          body: JSON.stringify({ actualCash: 75000, notes: `Concurrent close ${idx}` }),
        })
      );

      const results = await Promise.all(closePromises);
      const statuses = results.map((r) => r.status);

      const successCount = statuses.filter((s) => s === 200 || s === 201).length;
      const rejectCount = statuses.filter((s) => s === 400).length;

      expect(successCount).toBe(1);
      expect(rejectCount).toBe(4);

      // Confirm no shifts remain OPEN
      const openShifts = await prisma.shift.findMany({ where: { status: 'OPEN' } });
      expect(openShifts.length).toBe(0);
    });
  });

  // ===========================================================================
  // 3. Multiple Sales, Mixed Payments, Cash Expenses & Arqueo Closure
  // ===========================================================================
  describe('3. Multi-Sale Mixed Payments, Petty Cash Expenses & Guided Arqueo', () => {
    let activeShiftId = '';

    beforeAll(async () => {
      await resetTestShifts();
      const openRes = await api.request('/shifts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ initialCash: 100000, notes: 'Turno integral' }),
      });
      const data = await openRes.json();
      activeShiftId = data.shift.id;
    });

    afterAll(async () => {
      try {
        await api.request('/shifts/close', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
          body: JSON.stringify({ actualCash: 0 }),
        });
      } catch {}
    });

    it('should process sales with CASH, CARD, TRANSFER, and INTERNAL methods and aggregate accurately', async () => {
      // 1. CASH Sale: $20,000 (2 items x 10,000)
      const s1 = await api.request('/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          userId: auth.cashierUser.id,
          total: 20000,
          items: [{ productId: testProdStandard.id, quantity: 2, price: 10000 }],
          payments: [{ method: 'CASH', amount: 20000 }],
        }),
      });
      expect([200, 201]).toContain(s1.status);
      const s1Data = await s1.json();
      createdSaleIds.push(s1Data.sale.id);

      // 2. CARD Sale: $30,000 (3 items x 10,000)
      const s2 = await api.request('/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          userId: auth.cashierUser.id,
          total: 30000,
          items: [{ productId: testProdStandard.id, quantity: 3, price: 10000 }],
          payments: [{ method: 'CARD', amount: 30000 }],
        }),
      });
      expect([200, 201]).toContain(s2.status);
      const s2Data = await s2.json();
      createdSaleIds.push(s2Data.sale.id);

      // 3. TRANSFER Sale: $40,000 (4 items x 10,000)
      const s3 = await api.request('/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          userId: auth.cashierUser.id,
          total: 40000,
          items: [{ productId: testProdStandard.id, quantity: 4, price: 10000 }],
          payments: [{ method: 'TRANSFER', amount: 40000 }],
        }),
      });
      expect([200, 201]).toContain(s3.status);
      const s3Data = await s3.json();
      createdSaleIds.push(s3Data.sale.id);

      // 4. INTERNAL Sale: $10,000 (1 item x 10,000)
      const s4 = await api.request('/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          userId: auth.cashierUser.id,
          total: 10000,
          items: [{ productId: testProdStandard.id, quantity: 1, price: 10000 }],
          payments: [{ method: 'INTERNAL', amount: 10000 }],
        }),
      });
      expect([200, 201]).toContain(s4.status);
      const s4Data = await s4.json();
      createdSaleIds.push(s4Data.sale.id);

      // 5. Split payment Sale: $50,000 (Cash 20,000 + Card 15,000 + Transfer 15,000)
      const s5 = await api.request('/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          userId: auth.cashierUser.id,
          total: 50000,
          items: [{ productId: testProdStandard.id, quantity: 5, price: 10000 }],
          payments: [
            { method: 'CASH', amount: 20000 },
            { method: 'CARD', amount: 15000 },
            { method: 'TRANSFER', amount: 15000 },
          ],
        }),
      });
      expect([200, 201]).toContain(s5.status);
      const s5Data = await s5.json();
      createdSaleIds.push(s5Data.sale.id);

      // Verify real-time totals:
      // Initial: 100,000
      // Cash sales: 20k + 20k = 40,000
      // Card sales: 30k + 15k = 45,000
      // Transfer sales: 40k + 15k = 55,000
      // Internal sales: 10,000
      // Expected cash in drawer = Initial (100,000) + Cash (40,000) = 140,000
      const curRes = await api.request('/shifts/current', {
        headers: { Cookie: auth.cashierCookie },
      });
      expect(curRes.status).toBe(200);
      const cur = await curRes.json();

      expect(Number(cur.realTimeTotals.initialCash)).toBe(100000);
      expect(Number(cur.realTimeTotals.cashSales)).toBe(40000);
      expect(Number(cur.realTimeTotals.cardSales)).toBe(45000);
      expect(Number(cur.realTimeTotals.transferSales)).toBe(55000);
      expect(Number(cur.realTimeTotals.internalSales)).toBe(10000);
      expect(Number(cur.realTimeTotals.expectedCash)).toBe(140000);
      expect(cur.realTimeTotals.salesCount).toBe(5);
    });

    it('should register petty cash expenses and exclude INTERNAL_TRANSFER from drawer expected cash', async () => {
      // Register regular supply expense: $15,000
      const exp1 = await api.request('/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          description: 'Compra de bolsas y servilletas',
          amount: 15000,
          category: 'supplies',
          department: 'MARKET',
          userId: auth.cashierUser.id,
        }),
      });
      expect([200, 201]).toContain(exp1.status);
      const exp1Data = await exp1.json();
      createdExpenseIds.push(exp1Data.expense.id);

      // Register second regular expense: $5,000
      const exp2 = await api.request('/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          description: 'Café de muestra para degustación',
          amount: 5000,
          category: 'other',
          department: 'GENERAL',
          userId: auth.cashierUser.id,
        }),
      });
      expect([200, 201]).toContain(exp2.status);
      const exp2Data = await exp2.json();
      createdExpenseIds.push(exp2Data.expense.id);

      // Register INTERNAL_TRANSFER expense: $25,000 (accounting record, not cash outflow)
      const expInternal = await api.request('/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          description: 'Traslado contable entre barras',
          amount: 25000,
          category: 'INTERNAL_TRANSFER',
          department: 'CAFE',
          userId: auth.cashierUser.id,
        }),
      });
      expect([200, 201]).toContain(expInternal.status);
      const expInternalData = await expInternal.json();
      createdExpenseIds.push(expInternalData.expense.id);

      // Drawer math check:
      // Base: 100,000
      // Cash Sales: 40,000
      // Regular Cash Expenses: 15,000 + 5,000 = 20,000
      // Expected Cash = 100,000 + 40,000 - 20,000 = 120,000
      const curRes = await api.request('/shifts/current', {
        headers: { Cookie: auth.cashierCookie },
      });
      const cur = await curRes.json();

      expect(Number(cur.realTimeTotals.expenses)).toBe(20000);
      expect(Number(cur.realTimeTotals.expectedCash)).toBe(120000);
    });

    it('should close shift with exact match (Cuadrado) and report complete financial breakdown', async () => {
      // Expected cash is 120,000. Cashier enters 120,000.
      const closeRes = await api.request('/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          actualCash: 120000,
          notes: 'Cierre perfectamente cuadrado',
        }),
      });

      expect([200, 201]).toContain(closeRes.status);
      const data = await closeRes.json();
      expect(data.report.shift.status).toBe('CLOSED');
      expect(Number(data.report.expectedCash)).toBe(120000);
      expect(Number(data.report.actualCash)).toBe(120000);
      expect(Number(data.report.difference)).toBe(0);
      expect(Number(data.report.totalSales)).toBe(150000);
      expect(Number(data.report.totalExpenses)).toBe(20000);

      // Verify detailed totals object
      expect(Number(data.report.totals.cashSales)).toBe(40000);
      expect(Number(data.report.totals.cardSales)).toBe(45000);
      expect(Number(data.report.totals.transferSales)).toBe(55000);
      expect(Number(data.report.totals.internalSales)).toBe(10000);
      expect(Number(data.report.totals.totalSales)).toBe(150000);
      expect(data.report.totals.salesCount).toBe(5);
      expect(data.report.totals.expensesCount).toBe(2);
    });
  });

  // ===========================================================================
  // 4. Arqueo Discrepancy Calculations: Faltante & Sobrante
  // ===========================================================================
  describe('4. Arqueo Discrepancy: Faltante & Sobrante', () => {
    it('Scenario: Cash Shortage (Faltante) -> difference < 0', async () => {
      await resetTestShifts();

      // Open new shift with $50,000
      await api.request('/shifts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ initialCash: 50000 }),
      });

      // Cash sale: $10,000 -> Expected = 60,000
      const s = await api.request('/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          userId: auth.cashierUser.id,
          total: 10000,
          items: [{ productId: testProdStandard.id, quantity: 1, price: 10000 }],
          payments: [{ method: 'CASH', amount: 10000 }],
        }),
      });
      const sData = await s.json();
      createdSaleIds.push(sData.sale.id);

      // Cashier counts 58,500 ($1,500 missing)
      const closeRes = await api.request('/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          actualCash: 58500,
          notes: 'Faltante de caja por billete roto',
        }),
      });

      expect([200, 201]).toContain(closeRes.status);
      const data = await closeRes.json();
      expect(Number(data.report.expectedCash)).toBe(60000);
      expect(Number(data.report.actualCash)).toBe(58500);
      expect(Number(data.report.difference)).toBe(-1500);
    });

    it('Scenario: Cash Surplus (Sobrante) -> difference > 0', async () => {
      await resetTestShifts();

      // Open new shift with $50,000
      await api.request('/shifts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ initialCash: 50000 }),
      });

      // Cash sale: $10,000 -> Expected = 60,000
      const s = await api.request('/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          userId: auth.cashierUser.id,
          total: 10000,
          items: [{ productId: testProdStandard.id, quantity: 1, price: 10000 }],
          payments: [{ method: 'CASH', amount: 10000 }],
        }),
      });
      const sData = await s.json();
      createdSaleIds.push(sData.sale.id);

      // Cashier counts 62,300 ($2,300 surplus / tip left)
      const closeRes = await api.request('/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          actualCash: 62300,
          notes: 'Sobrante en caja',
        }),
      });

      expect([200, 201]).toContain(closeRes.status);
      const data = await closeRes.json();
      expect(Number(data.report.expectedCash)).toBe(60000);
      expect(Number(data.report.actualCash)).toBe(62300);
      expect(Number(data.report.difference)).toBe(2300);
    });

    it('should reject negative actualCash on close with HTTP 400', async () => {
      await resetTestShifts();

      await api.request('/shifts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ initialCash: 20000 }),
      });

      const closeRes = await api.request('/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ actualCash: -500 }),
      });

      expect(closeRes.status).toBe(400);
      const data = await closeRes.json();
      expect(data.error).toBeDefined();

      // Clean up
      await api.request('/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ actualCash: 20000 }),
      });
    });
  });

  // ===========================================================================
  // 5. High Precision & Fractional Amounts
  // ===========================================================================
  describe('5. High Precision Financial Decimals & IEEE-754 Safety', () => {
    it('should handle fractional decimal values without floating-point inaccuracies', async () => {
      await resetTestShifts();

      // Initial cash with decimals: 1234.56
      const openRes = await api.request('/shifts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ initialCash: 1234.56 }),
      });
      expect([200, 201]).toContain(openRes.status);

      // Decimal Sale 1: 1 item x 49.99 CASH
      const s1 = await api.request('/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          userId: auth.cashierUser.id,
          total: 49.99,
          items: [{ productId: testProdDecimal.id, quantity: 1, price: 49.99 }],
          payments: [{ method: 'CASH', amount: 49.99 }],
        }),
      });
      expect([200, 201]).toContain(s1.status);
      const s1Data = await s1.json();
      createdSaleIds.push(s1Data.sale.id);

      // Decimal Sale 2: 2 items x 49.99 = 99.98 (Cash: 33.33, Card: 66.65)
      const s2 = await api.request('/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          userId: auth.cashierUser.id,
          total: 99.98,
          items: [{ productId: testProdDecimal.id, quantity: 2, price: 49.99 }],
          payments: [
            { method: 'CASH', amount: 33.33 },
            { method: 'CARD', amount: 66.65 },
          ],
        }),
      });
      expect([200, 201]).toContain(s2.status);
      const s2Data = await s2.json();
      createdSaleIds.push(s2Data.sale.id);

      // Decimal Expense: 12.34 in CASH
      const exp = await api.request('/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          description: 'Gasto fraccionario',
          amount: 12.34,
          category: 'supplies',
          department: 'GENERAL',
          userId: auth.cashierUser.id,
        }),
      });
      expect([200, 201]).toContain(exp.status);
      const expData = await exp.json();
      createdExpenseIds.push(expData.expense.id);

      // Arithmetic:
      // Initial: 1234.56
      // Cash Sales: 49.99 + 33.33 = 83.32
      // Card Sales: 66.65
      // Total Sales: 49.99 + 99.98 = 149.97
      // Expenses: 12.34
      // Expected Cash = 1234.56 + 83.32 - 12.34 = 1305.54
      const curRes = await api.request('/shifts/current', {
        headers: { Cookie: auth.cashierCookie },
      });
      const cur = await curRes.json();

      expect(Number(cur.realTimeTotals.initialCash)).toBe(1234.56);
      expect(Number(cur.realTimeTotals.cashSales)).toBe(83.32);
      expect(Number(cur.realTimeTotals.cardSales)).toBe(66.65);
      expect(Number(cur.realTimeTotals.expenses)).toBe(12.34);
      expect(Number(cur.realTimeTotals.expectedCash)).toBe(1305.54);

      // Close with 1 cent shortage: 1305.53 -> difference = -0.01
      const closeRes = await api.request('/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ actualCash: 1305.53 }),
      });
      const closeData = await closeRes.json();
      expect(Number(closeData.report.expectedCash)).toBe(1305.54);
      expect(Number(closeData.report.actualCash)).toBe(1305.53);
      expect(Number(closeData.report.difference)).toBe(-0.01);
      expect(Number(closeData.report.totalSales)).toBe(149.97);
    });
  });

  // ===========================================================================
  // 6. Immediate Consecutive Shift Opening After Closure
  // ===========================================================================
  describe('6. Continuous Shift Changeover & Historical Shift Isolation', () => {
    let shift1Id = '';
    let shift2Id = '';

    it('should immediately open second shift after closing first, isolating transactions', async () => {
      await resetTestShifts();

      // Shift 1: Open with 50,000
      const open1 = await api.request('/shifts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ initialCash: 50000, notes: 'Turno Mañana' }),
      });
      const open1Data = await open1.json();
      shift1Id = open1Data.shift.id;

      // Make 1 sale in Shift 1: $10,000 CASH
      const s1 = await api.request('/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          userId: auth.cashierUser.id,
          total: 10000,
          items: [{ productId: testProdStandard.id, quantity: 1, price: 10000 }],
          payments: [{ method: 'CASH', amount: 10000 }],
        }),
      });
      const s1Data = await s1.json();
      createdSaleIds.push(s1Data.sale.id);

      // Close Shift 1 with 60,000 (cuadrado)
      const close1 = await api.request('/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ actualCash: 60000 }),
      });
      expect([200, 201]).toContain(close1.status);

      // IMMEDIATELY Open Shift 2 with Admin (Turno Tarde, base 70,000)
      const open2 = await api.request('/shifts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
        body: JSON.stringify({ initialCash: 70000, notes: 'Turno Tarde' }),
      });
      expect([200, 201]).toContain(open2.status);
      const open2Data = await open2.json();
      shift2Id = open2Data.shift.id;

      // Shift 2 must start with 0 sales and expectedCash = 70,000
      const cur2 = await api.request('/shifts/current', {
        headers: { Cookie: auth.adminCookie },
      });
      const cur2Data = await cur2.json();
      expect(cur2Data.shift.id).toBe(shift2Id);
      expect(Number(cur2Data.realTimeTotals.initialCash)).toBe(70000);
      expect(Number(cur2Data.realTimeTotals.cashSales)).toBe(0);
      expect(Number(cur2Data.realTimeTotals.expectedCash)).toBe(70000);
      expect(cur2Data.realTimeTotals.salesCount).toBe(0);

      // Historical Shift 1 must retain its exact records
      const hist1 = await api.request(`/shifts/${shift1Id}`, {
        headers: { Cookie: auth.adminCookie },
      });
      expect(hist1.status).toBe(200);
      const hist1Data = await hist1.json();
      const s1Summary = hist1Data.summary || hist1Data.shift;
      expect(Number(s1Summary.initialCash)).toBe(50000);
      expect(Number(s1Summary.totalSales)).toBe(10000);
      expect(Number(s1Summary.expectedCash)).toBe(60000);
      expect(Number(s1Summary.actualCash)).toBe(60000);
      expect(Number(s1Summary.difference)).toBe(0);

      // Close Shift 2 cleanly
      await api.request('/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.adminCookie },
        body: JSON.stringify({ actualCash: 70000 }),
      });
    });
  });

  // ===========================================================================
  // 7. Cancelled Sales Exclusion & Table Checkout Gatekeeper
  // ===========================================================================
  describe('7. Cancelled Sales & Table Checkout Gatekeeper', () => {
    it('should exclude cancelled sales from shift totals and expected cash', async () => {
      await resetTestShifts();

      // Open shift with $50,000
      await api.request('/shifts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ initialCash: 50000 }),
      });

      // Sale 1: Valid $10,000 CASH
      const s1 = await api.request('/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          userId: auth.cashierUser.id,
          total: 10000,
          items: [{ productId: testProdStandard.id, quantity: 1, price: 10000 }],
          payments: [{ method: 'CASH', amount: 10000 }],
        }),
      });
      const s1Data = await s1.json();
      createdSaleIds.push(s1Data.sale.id);

      // Sale 2: To be cancelled $20,000 CASH
      const s2 = await api.request('/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          userId: auth.cashierUser.id,
          total: 20000,
          items: [{ productId: testProdStandard.id, quantity: 2, price: 10000 }],
          payments: [{ method: 'CASH', amount: 20000 }],
        }),
      });
      const s2Data = await s2.json();
      createdSaleIds.push(s2Data.sale.id);

      // Cancel Sale 2
      const cancelRes = await api.request(`/sales/${s2Data.sale.id}/cancel`, {
        method: 'POST',
        headers: { Cookie: auth.adminCookie },
      });
      expect(cancelRes.status).toBe(200);

      // Real time totals should show only Sale 1: cashSales = 10,000, expectedCash = 60,000
      const cur = await api.request('/shifts/current', {
        headers: { Cookie: auth.cashierCookie },
      });
      const curData = await cur.json();
      expect(Number(curData.realTimeTotals.cashSales)).toBe(10000);
      expect(Number(curData.realTimeTotals.expectedCash)).toBe(60000);
      expect(curData.realTimeTotals.salesCount).toBe(1);

      // Close shift
      const closeRes = await api.request('/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ actualCash: 60000 }),
      });
      const closeData = await closeRes.json();
      expect(Number(closeData.report.totalSales)).toBe(10000);
    });

    it('should reject table checkout with 400 when no active shift exists', async () => {
      await resetTestShifts();

      // Open table with user ID
      await api.request(`/tables/${testTable.id}/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ userId: auth.cashierUser.id }),
      });

      await api.request(`/tables/${testTable.id}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          items: [{ productId: testProdStandard.id, quantity: 1, price: 10000 }],
        }),
      });

      // Checkout attempt with NO open shift -> Must be rejected with 400
      const checkoutRes = await api.request(`/tables/${testTable.id}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          payments: [{ method: 'CASH', amount: 10000 }],
        }),
      });

      expect(checkoutRes.status).toBe(400);
      const data = await checkoutRes.json();
      expect(data.error).toContain('turno');

      // Now open shift and complete table checkout
      await api.request('/shifts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ initialCash: 25000 }),
      });

      const validCheckout = await api.request(`/tables/${testTable.id}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({
          payments: [{ method: 'CASH', amount: 10000 }],
        }),
      });
      expect(validCheckout.status).toBe(200);
      const validData = await validCheckout.json();
      createdSaleIds.push(validData.sale.id);

      // Check real-time totals include table sale
      const cur = await api.request('/shifts/current', {
        headers: { Cookie: auth.cashierCookie },
      });
      const curData = await cur.json();
      expect(Number(curData.realTimeTotals.expectedCash)).toBe(35000);

      // Clean up
      await api.request('/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: auth.cashierCookie },
        body: JSON.stringify({ actualCash: 35000 }),
      });
    });
  });

  // ===========================================================================
  // 8. Security & Authentication Checks
  // ===========================================================================
  describe('8. Authentication & Role Enforcement', () => {
    it('should reject unauthenticated POST /shifts/open with HTTP 401', async () => {
      const res = await api.request('/shifts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialCash: 50000 }),
      });
      expect(res.status).toBe(401);
    });

    it('should reject unauthenticated POST /shifts/close with HTTP 401', async () => {
      const res = await api.request('/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actualCash: 50000 }),
      });
      expect(res.status).toBe(401);
    });
  });
});
