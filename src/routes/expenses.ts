import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
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

const expenseSchema = z.object({
  description: z.string().min(1, 'La descripción del gasto es obligatoria'),
  amount: z.union([z.number(), z.string()]).transform((val) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num) || num <= 0) throw new Error('El monto del gasto debe ser mayor a cero');
    return num;
  }),
  category: z.string().default('supplies'),
  department: z.string().min(1, 'El departamento del gasto es obligatorio'),
  userId: z.string().nullable().optional(),
  items: z.array(z.object({
    productId: z.string().min(1, 'ID de producto inválido'),
    quantity: z.union([z.number(), z.string()]).transform((val) => {
      const int = typeof val === 'string' ? parseInt(val) : val;
      if (isNaN(int) || int <= 0) throw new Error('La cantidad debe ser mayor a cero');
      return int;
    }),
    unitCost: z.union([z.number(), z.string()]).transform((val) => {
      const num = typeof val === 'string' ? parseFloat(val) : val;
      if (isNaN(num) || num <= 0) throw new Error('El costo unitario debe ser mayor a cero');
      return num;
    })
  })).optional()
});

expenses.post('/', zValidator('json', expenseSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: result.error.issues[0].message }, 400);
  }
}), async (c) => {
  try {
    const { description, amount, category, department, userId, items } = c.req.valid('json');

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
