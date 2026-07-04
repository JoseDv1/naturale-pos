import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { prisma } from '../db';

const sales = new Hono();

sales.get('/', async (c) => {
  const list = await prisma.sale.findMany({
    include: {
      user: { select: { name: true } },
      items: {
        include: { product: { select: { name: true, sku: true, department: true } } },
      },
      payments: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  return c.json(list);
});

const saleSchema = z.object({
  userId: z.string().min(1, 'El usuario es requerido'),
  total: z.union([z.number(), z.string()]).transform((val) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num) || num <= 0) throw new Error('El total debe ser mayor a cero');
    return num;
  }),
  items: z.array(z.object({
    productId: z.string().min(1, 'ID de producto inválido'),
    quantity: z.union([z.number(), z.string()]).transform((val) => {
      const int = typeof val === 'string' ? parseInt(val) : val;
      if (isNaN(int) || int <= 0) throw new Error('La cantidad debe ser mayor a cero');
      return int;
    }),
    price: z.union([z.number(), z.string()]).transform((val) => {
      const num = typeof val === 'string' ? parseFloat(val) : val;
      if (isNaN(num) || num < 0) throw new Error('El precio no puede ser negativo');
      return num;
    })
  })).min(1, 'La venta debe contener al menos un producto'),
  payments: z.array(z.object({
    method: z.enum(['CASH', 'CARD', 'TRANSFER', 'INTERNAL']),
    amount: z.union([z.number(), z.string()]).transform((val) => {
      const num = typeof val === 'string' ? parseFloat(val) : val;
      if (isNaN(num) || num <= 0) throw new Error('El monto del pago debe ser mayor a cero');
      return num;
    })
  })).min(1, 'La venta debe contener al menos un método de pago')
}).superRefine((data, ctx) => {
  // Validate item sum matches total
  const computedTotal = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  if (Math.abs(computedTotal - data.total) > 0.01) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'La suma de los subtotales de productos no coincide con el total de la venta',
      path: ['items']
    });
  }

  // Validate payment sum matches total
  const paymentSum = data.payments.reduce((sum, pay) => sum + pay.amount, 0);
  if (Math.abs(paymentSum - data.total) > 0.01) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'La suma de los pagos no coincide con el total de la venta',
      path: ['payments']
    });
  }
});

sales.post('/', zValidator('json', saleSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: result.error.issues[0].message }, 400);
  }
}), async (c) => {
  try {
    const { userId, total, items, payments } = c.req.valid('json');

    // Execute in a transaction to enforce inventory consistency
    const result = await prisma.$transaction(async (tx) => {
      // 1. Stock check and decrement
      for (const item of items) {
        const prod = await tx.product.findUnique({ where: { id: item.productId } });
        if (!prod) throw new Error(`Producto no encontrado: ID ${item.productId}`);
        
        // Skip stock check for Cafe products with infinite/on-demand code (e.g. prepared drinks, stock coded as 999)
        if (prod.department === 'CAFE' && prod.stock >= 900) {
          continue;
        }

        if (prod.stock < item.quantity) {
          throw new Error(`Stock insuficiente para "${prod.name}". Disponible: ${prod.stock}, Solicitado: ${item.quantity}`);
        }

        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      // 2. Create the Sale
      const sale = await tx.sale.create({
        data: {
          userId,
          total: parseFloat(total),
          status: 'COMPLETED',
          items: {
            create: items.map((item: any) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: parseFloat(item.price),
            })),
          },
          payments: {
            create: payments.map((pay: any) => ({
              method: pay.method,
              amount: parseFloat(pay.amount),
            })),
          },
        },
        include: {
          items: true,
          payments: true,
        },
      });

      return sale;
    });

    return c.json({ success: true, sale: result });
  } catch (error: any) {
    return c.json({ error: error.message || 'Error al procesar la venta' }, 500);
  }
});

sales.post('/:id/cancel', async (c) => {
  try {
    const id = c.req.param('id');

    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!sale) throw new Error('Venta no encontrada');
      if (sale.status === 'CANCELLED') throw new Error('La venta ya está cancelada');

      // Restore stock for all items
      for (const item of sale.items) {
        const prod = await tx.product.findUnique({ where: { id: item.productId } });
        if (prod && !(prod.department === 'CAFE' && prod.stock >= 900)) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }

      // Update sale status
      const updated = await tx.sale.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      return updated;
    });

    return c.json({ success: true, sale: result });
  } catch (error: any) {
    return c.json({ error: error.message || 'Error al cancelar la venta' }, 500);
  }
});

export default sales;
