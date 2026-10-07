import { Hono } from 'hono';
import { prisma } from '../db';
import { calculateShiftTotals } from './shifts';

const reports = new Hono();

const round2 = (num: number): number => Math.round((num + Number.EPSILON) * 100) / 100;

reports.get('/dashboard', async (c) => {
  try {
    const startParam = c.req.query('start')?.trim();
    const endParam = c.req.query('end')?.trim();
    const shiftIdParam = c.req.query('shiftId')?.trim();

    let targetShift: any = null;
    if (shiftIdParam) {
      if (shiftIdParam === 'current') {
        targetShift = await prisma.shift.findFirst({
          where: { status: 'OPEN' },
          include: {
            user: { select: { id: true, name: true, username: true } },
            closedByUser: { select: { id: true, name: true, username: true } },
          },
          orderBy: { openedAt: 'desc' },
        });
        if (!targetShift) {
          targetShift = await prisma.shift.findFirst({
            include: {
              user: { select: { id: true, name: true, username: true } },
              closedByUser: { select: { id: true, name: true, username: true } },
            },
            orderBy: { openedAt: 'desc' },
          });
        }
      } else {
        targetShift = await prisma.shift.findUnique({
          where: { id: shiftIdParam },
          include: {
            user: { select: { id: true, name: true, username: true } },
            closedByUser: { select: { id: true, name: true, username: true } },
          },
        });
      }
    }

    const dateFilter: any = {};
    if (startParam) {
      const d = new Date(startParam);
      if (!isNaN(d.getTime())) {
        if (startParam.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(startParam)) {
          dateFilter.gte = new Date(`${startParam}T00:00:00.000Z`);
        } else {
          dateFilter.gte = d;
        }
      }
    }
    if (endParam) {
      const d = new Date(endParam);
      if (!isNaN(d.getTime())) {
        if (endParam.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(endParam)) {
          dateFilter.lte = new Date(`${endParam}T23:59:59.999Z`);
        } else {
          dateFilter.lte = d;
        }
      }
    }

    // Build query filters for sales & expenses
    const salesWhere: any = {
      status: { in: ['COMPLETED', 'TRANSFER_OUT'] },
    };
    const expensesWhere: any = {
      category: { not: 'INTERNAL_TRANSFER' },
    };

    if (targetShift) {
      salesWhere.shiftId = targetShift.id;
      expensesWhere.shiftId = targetShift.id;
    } else if (shiftIdParam) {
      salesWhere.shiftId = '__not_found__';
      expensesWhere.shiftId = '__not_found__';
    } else {
      if (dateFilter.gte || dateFilter.lte) {
        salesWhere.createdAt = dateFilter;
        expensesWhere.date = dateFilter;
      }
    }

    // Fetch non-cancelled sales
    const sales = await prisma.sale.findMany({
      where: salesWhere,
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
        payments: true,
      },
    });

    // Fetch operational expenses (excluding internal transfer virtual records)
    const expenses = await prisma.expense.findMany({
      where: expensesWhere,
    });

    // Initialize report structure
    const data = {
      MARKET: { revenue: 0, costOfSales: 0, grossProfit: 0, expenses: 0, netProfit: 0 },
      CAFE: { revenue: 0, costOfSales: 0, grossProfit: 0, expenses: 0, netProfit: 0 },
      GENERAL: { expenses: 0 },
      CONSOLIDATED: { revenue: 0, costOfSales: 0, grossProfit: 0, expenses: 0, netProfit: 0 },
      paymentMethods: { CASH: 0, CARD: 0, TRANSFER: 0, INTERNAL: 0 },
    };

    // Calculate revenue & cost of sales from items
    for (const sale of sales) {
      // Aggregate payments
      for (const pay of sale.payments) {
        const method = pay.method as keyof typeof data.paymentMethods;
        if (data.paymentMethods[method] !== undefined) {
          data.paymentMethods[method] += Number(pay.amount);
        }
      }

      // Aggregate items to respect departments
      for (const item of sale.items) {
        const itemRevenue = Number(item.price) * item.quantity;
        const unitCost = item.variant?.cost !== undefined && item.variant?.cost !== null
          ? Number(item.variant.cost)
          : Number(item.product.cost);
        const itemCost = unitCost * item.quantity;

        const dept = item.product.department; // 'MARKET' | 'CAFE'
        if (dept === 'MARKET' || dept === 'CAFE') {
          data[dept].revenue += itemRevenue;
          data[dept].costOfSales += itemCost;
        }

        // Consolidated sum
        data.CONSOLIDATED.revenue += itemRevenue;
        data.CONSOLIDATED.costOfSales += itemCost;
      }
    }

    // Calculate expenses
    for (const exp of expenses) {
      const dept = exp.department; // 'MARKET' | 'CAFE' | 'GENERAL'
      const expAmount = Number(exp.amount);
      if (dept === 'MARKET' || dept === 'CAFE') {
        data[dept].expenses += expAmount;
      } else {
        data.GENERAL.expenses += expAmount;
      }
      data.CONSOLIDATED.expenses += expAmount;
    }

    // Complete math with 2-decimal financial rounding
    data.MARKET.revenue = round2(data.MARKET.revenue);
    data.MARKET.costOfSales = round2(data.MARKET.costOfSales);
    data.MARKET.grossProfit = round2(data.MARKET.revenue - data.MARKET.costOfSales);
    data.MARKET.expenses = round2(data.MARKET.expenses);
    data.MARKET.netProfit = round2(data.MARKET.grossProfit - data.MARKET.expenses);

    data.CAFE.revenue = round2(data.CAFE.revenue);
    data.CAFE.costOfSales = round2(data.CAFE.costOfSales);
    data.CAFE.grossProfit = round2(data.CAFE.revenue - data.CAFE.costOfSales);
    data.CAFE.expenses = round2(data.CAFE.expenses);
    data.CAFE.netProfit = round2(data.CAFE.grossProfit - data.CAFE.expenses);

    data.GENERAL.expenses = round2(data.GENERAL.expenses);

    data.CONSOLIDATED.revenue = round2(data.CONSOLIDATED.revenue);
    data.CONSOLIDATED.costOfSales = round2(data.CONSOLIDATED.costOfSales);
    data.CONSOLIDATED.grossProfit = round2(data.CONSOLIDATED.revenue - data.CONSOLIDATED.costOfSales);
    data.CONSOLIDATED.expenses = round2(data.CONSOLIDATED.expenses);
    data.CONSOLIDATED.netProfit = round2(data.CONSOLIDATED.grossProfit - data.CONSOLIDATED.expenses);

    data.paymentMethods.CASH = round2(data.paymentMethods.CASH);
    data.paymentMethods.CARD = round2(data.paymentMethods.CARD);
    data.paymentMethods.TRANSFER = round2(data.paymentMethods.TRANSFER);
    data.paymentMethods.INTERNAL = round2(data.paymentMethods.INTERNAL);

    // Query shifts intersecting with this date range or matching target shift
    let shiftsList: any[] = [];
    if (targetShift) {
      shiftsList = [targetShift];
    } else if (shiftIdParam) {
      shiftsList = [];
    } else {
      const shiftWhere: any = {};
      if (dateFilter.gte || dateFilter.lte) {
        shiftWhere.OR = [
          { openedAt: dateFilter },
          { closedAt: dateFilter },
          ...(dateFilter.gte && dateFilter.lte ? [
            { openedAt: { lte: dateFilter.gte }, closedAt: null },
          ] : []),
        ];
      }

      shiftsList = await prisma.shift.findMany({
        where: shiftWhere,
        include: {
          user: { select: { id: true, name: true, username: true } },
          closedByUser: { select: { id: true, name: true, username: true } },
        },
        orderBy: { openedAt: 'asc' },
      });
    }

    let shiftsInitialCash = 0;
    let shiftsExpectedCash = 0;
    let shiftsActualCash = 0;
    let shiftsDifference = 0;
    let closedShiftsCount = 0;
    let openShiftsCount = 0;
    const shiftSummaries: any[] = [];

    for (const s of shiftsList) {
      if (s.status === 'OPEN') {
        openShiftsCount++;
        const totals = await calculateShiftTotals(s.id, Number(s.initialCash));
        shiftsInitialCash += totals.initialCash;
        shiftsExpectedCash += totals.expectedCash;
        shiftSummaries.push({
          id: s.id,
          status: 'OPEN',
          openedAt: s.openedAt,
          closedAt: null,
          user: s.user,
          initialCash: totals.initialCash,
          totalSales: totals.totalSales,
          cashSales: totals.cashSales,
          cardSales: totals.cardSales,
          transferSales: totals.transferSales,
          internalSales: totals.internalSales,
          expenses: totals.totalExpenses,
          expectedCash: totals.expectedCash,
          actualCash: null,
          difference: null,
        });
      } else {
        closedShiftsCount++;
        const initial = Number(s.initialCash || 0);
        const expected = Number(s.expectedCash || 0);
        const actual = s.actualCash !== null ? Number(s.actualCash) : expected;
        const diff = s.difference !== null ? Number(s.difference) : 0;
        const exp = Number(s.totalExpenses || 0);
        const cashSales = round2(Math.max(0, expected - initial + exp));

        shiftsInitialCash += initial;
        shiftsExpectedCash += expected;
        shiftsActualCash += actual;
        shiftsDifference += diff;

        shiftSummaries.push({
          id: s.id,
          status: 'CLOSED',
          openedAt: s.openedAt,
          closedAt: s.closedAt,
          user: s.user,
          closedByUser: s.closedByUser,
          initialCash: initial,
          totalSales: Number(s.totalSales || 0),
          cashSales,
          cardSales: Number(s.totalCard || 0),
          transferSales: Number(s.totalTransfer || 0),
          internalSales: Number(s.totalInternal || 0),
          expenses: exp,
          expectedCash: expected,
          actualCash: actual,
          difference: diff,
        });
      }
    }

    const cashReconciliation = {
      shiftsCount: shiftsList.length,
      openShiftsCount,
      closedShiftsCount,
      initialCash: round2(shiftsInitialCash),
      cashSales: round2(data.paymentMethods.CASH),
      expenses: round2(data.CONSOLIDATED.expenses),
      expectedCash: round2(shiftsInitialCash + data.paymentMethods.CASH - data.CONSOLIDATED.expenses),
      actualCash: round2(shiftsActualCash),
      difference: round2(shiftsDifference),
      shifts: shiftSummaries,
    };

    return c.json({
      ...data,
      shiftInfo: targetShift ? {
        id: targetShift.id,
        status: targetShift.status,
        openedAt: targetShift.openedAt,
        closedAt: targetShift.closedAt,
        initialCash: Number(targetShift.initialCash),
        cashier: targetShift.user?.name || targetShift.user?.username || 'Cajero',
      } : null,
      cashReconciliation,
    });
  } catch (error) {
    return c.json({ error: 'Error al generar reportes' }, 500);
  }
});

reports.get('/inventory-alerts', async (c) => {
  const lowStockProducts = await prisma.product.findMany({
    where: {
      active: true,
      OR: [
        {
          stock: { lte: 3 },
          NOT: {
            stock: { gte: 900 },
          },
        },
        {
          variants: {
            some: {
              active: true,
              stock: { lte: 3 },
              NOT: {
                stock: { gte: 900 },
              },
            },
          },
        },
      ],
    },
    include: {
      category: true,
      variants: {
        where: { active: true },
        orderBy: { price: 'asc' },
      },
    },
    orderBy: { stock: 'asc' },
  });
  return c.json(lowStockProducts);
});

export default reports;
