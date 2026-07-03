import { Hono } from 'hono';
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

sales.post('/', async (c) => {
  try {
    const { userId, total, items, payments } = await c.req.json();

    if (!userId || !items || !items.length || !payments || !payments.length) {
      return c.json({ error: 'Información de venta incompleta' }, 400);
    }

    // Verify payments match the total
    const paymentSum = payments.reduce((acc: number, p: any) => acc + parseFloat(p.amount), 0);
    if (Math.abs(paymentSum - parseFloat(total)) > 0.01) {
      return c.json({ error: 'La suma de pagos no coincide con el total' }, 400);
    }

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
