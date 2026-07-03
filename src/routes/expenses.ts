import { Hono } from 'hono';
import { prisma } from '../db';

const expenses = new Hono();

expenses.get('/', async (c) => {
  const list = await prisma.expense.findMany({
    include: {
      user: { select: { name: true } },
      items: {
        include: { product: { select: { name: true, sku: true } } },
      },
    },
    orderBy: { date: 'desc' },
  });
  return c.json(list);
});

expenses.post('/', async (c) => {
  try {
    const { description, amount, category, department, userId, items } = await c.req.json();

    if (!description || amount === undefined || !department) {
      return c.json({ error: 'Faltan campos requeridos en el gasto' }, 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Expense
      const expense = await tx.expense.create({
        data: {
          description,
          amount: parseFloat(amount),
          category: category || 'supplies',
          department,
          userId,
          items: items && items.length ? {
            create: items.map((item: any) => ({
              productId: item.productId,
              quantity: parseInt(item.quantity),
              unitCost: parseFloat(item.unitCost),
            })),
          } : undefined,
        },
        include: {
          items: true,
        },
      });

      // 2. If it has items, update product stocks and cost prices
      if (items && items.length) {
        for (const item of items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { increment: parseInt(item.quantity) },
              cost: parseFloat(item.unitCost),
            },
          });
        }
      }

      return expense;
    });

    return c.json({ success: true, expense: result });
  } catch (error: any) {
    return c.json({ error: error.message || 'Error al guardar el gasto' }, 500);
  }
});

export default expenses;
