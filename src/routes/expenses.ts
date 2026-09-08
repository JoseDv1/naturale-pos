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
  amount: z.union([z.number(), z.string()])
    .transform((val) => typeof val === 'string' ? parseFloat(val) : val)
    .refine((num) => !isNaN(num) && num > 0, { message: 'El monto del gasto debe ser mayor a cero' }),
  category: z.enum(['rent', 'utilities', 'supplies', 'INTERNAL_TRANSFER'], {
    message: 'Categoría de gasto inválida'
  }).default('supplies'),
  department: z.enum(['MARKET', 'CAFE', 'GENERAL'], {
    message: 'Departamento inválido'
  }),
  userId: z.string().nullable().optional(),
  items: z.array(z.object({
    productId: z.string().min(1, 'ID de producto inválido'),
    quantity: z.union([z.number(), z.string()])
      .transform((val) => typeof val === 'string' ? parseInt(val) : val)
      .refine((int) => !isNaN(int) && int > 0, { message: 'La cantidad debe ser mayor a cero' }),
    unitCost: z.union([z.number(), z.string()])
      .transform((val) => typeof val === 'string' ? parseFloat(val) : val)
      .refine((num) => !isNaN(num) && num > 0, { message: 'El costo unitario debe ser mayor a cero' }),
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
          amount,
          category: category || 'supplies',
          department,
          userId,
          items: items && items.length ? {
            create: items.map((item: any) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitCost: item.unitCost,
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
              stock: { increment: item.quantity },
              cost: item.unitCost,
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
