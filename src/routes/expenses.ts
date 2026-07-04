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

    if (!description || typeof description !== 'string' || description.trim() === '') {
      return c.json({ error: 'La descripción del gasto es obligatoria' }, 400);
    }

    if (amount === undefined || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return c.json({ error: 'El monto del gasto debe ser mayor a cero' }, 400);
    }

    if (!department || typeof department !== 'string' || department.trim() === '') {
      return c.json({ error: 'El departamento del gasto es obligatorio' }, 400);
    }

    // If it's a purchase (has items), validate the items in details
    if (items && Array.isArray(items) && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.productId || typeof item.productId !== 'string' || item.productId.trim() === '') {
          return c.json({ error: `Producto en índice ${i} tiene un ID inválido` }, 400);
        }
        const qty = parseInt(item.quantity);
        if (isNaN(qty) || qty <= 0) {
          return c.json({ error: `La cantidad del producto en índice ${i} debe ser mayor a cero` }, 400);
        }
        const unitCost = parseFloat(item.unitCost);
        if (isNaN(unitCost) || unitCost <= 0) {
          return c.json({ error: `El costo unitario del producto en índice ${i} debe ser mayor a cero` }, 400);
        }
      }
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
