import { Hono } from 'hono';
import { prisma } from '../db';

const reports = new Hono();

reports.get('/dashboard', async (c) => {
  try {
    const startParam = c.req.query('start');
    const endParam = c.req.query('end');

    const dateFilter: any = {};
    if (startParam) dateFilter.gte = new Date(startParam);
    if (endParam) dateFilter.lte = new Date(endParam);

    const filter: any = {};
    if (startParam || endParam) filter.createdAt = dateFilter;

    // Fetch non-cancelled sales
    const sales = await prisma.sale.findMany({
      where: {
        status: { in: ['COMPLETED', 'TRANSFER_OUT'] },
        ...(startParam || endParam ? { createdAt: dateFilter } : {}),
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        payments: true,
      },
    });

    // Fetch expenses
    const expenses = await prisma.expense.findMany({
      where: {
        ...(startParam || endParam ? { date: dateFilter } : {}),
      },
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
          data.paymentMethods[method] += pay.amount;
        }
      }

      // Aggregate items to respect departments
      for (const item of sale.items) {
        const itemRevenue = item.price * item.quantity;
        const itemCost = item.product.cost * item.quantity;

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
      if (dept === 'MARKET' || dept === 'CAFE') {
        data[dept].expenses += exp.amount;
      } else {
        data.GENERAL.expenses += exp.amount;
      }
      data.CONSOLIDATED.expenses += exp.amount;
    }

    // Complete math
    data.MARKET.grossProfit = data.MARKET.revenue - data.MARKET.costOfSales;
    data.MARKET.netProfit = data.MARKET.grossProfit - data.MARKET.expenses;

    data.CAFE.grossProfit = data.CAFE.revenue - data.CAFE.costOfSales;
    data.CAFE.netProfit = data.CAFE.grossProfit - data.CAFE.expenses;

    data.CONSOLIDATED.grossProfit = data.CONSOLIDATED.revenue - data.CONSOLIDATED.costOfSales;
    data.CONSOLIDATED.netProfit = data.CONSOLIDATED.grossProfit - data.CONSOLIDATED.expenses;

    return c.json(data);
  } catch (error) {
    return c.json({ error: 'Error al generar reportes' }, 500);
  }
});

reports.get('/inventory-alerts', async (c) => {
  const lowStockProducts = await prisma.product.findMany({
    where: {
      active: true,
      stock: { lte: 3 },
      // Exclude café products with mock infinite stock (999)
      NOT: {
        stock: { gte: 900 },
      },
    },
    include: { category: true },
    orderBy: { stock: 'asc' },
  });
  return c.json(lowStockProducts);
});

export default reports;
