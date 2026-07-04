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

    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return c.json({ error: 'Usuario inválido o requerido' }, 400);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return c.json({ error: 'La venta debe contener al menos un producto' }, 400);
    }

    if (!payments || !Array.isArray(payments) || payments.length === 0) {
      return c.json({ error: 'La venta debe contener al menos un método de pago' }, 400);
    }

    const parsedTotal = parseFloat(total);
    if (isNaN(parsedTotal) || parsedTotal <= 0) {
      return c.json({ error: 'El total de la venta debe ser mayor a cero' }, 400);
    }

    // 1. Validate Items
    let computedTotal = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.productId || typeof item.productId !== 'string' || item.productId.trim() === '') {
        return c.json({ error: `Producto en índice ${i} tiene un ID inválido` }, 400);
      }
      const qty = parseInt(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        return c.json({ error: `La cantidad del producto en índice ${i} debe ser mayor a cero` }, 400);
      }
      const price = parseFloat(item.price);
      if (isNaN(price) || price < 0) {
        return c.json({ error: `El precio del producto en índice ${i} no puede ser negativo` }, 400);
      }
      computedTotal += price * qty;
    }

    // Verify calculated total matches target total
    if (Math.abs(computedTotal - parsedTotal) > 0.01) {
      return c.json({ error: 'La suma de los subtotales de productos no coincide con el total de la venta' }, 400);
    }

    // 2. Validate Payments
    const validPaymentMethods = ['CASH', 'CARD', 'TRANSFER', 'INTERNAL'];
    let paymentSum = 0;
    for (let i = 0; i < payments.length; i++) {
      const pay = payments[i];
      if (!pay.method || !validPaymentMethods.includes(pay.method)) {
        return c.json({ error: `Método de pago "${pay.method}" no es válido. Opciones: CASH, CARD, TRANSFER, INTERNAL` }, 400);
      }
      const amt = parseFloat(pay.amount);
      if (isNaN(amt) || amt <= 0) {
        return c.json({ error: `El monto del pago en índice ${i} debe ser mayor a cero` }, 400);
      }
      paymentSum += amt;
    }

    // Verify payments match the total
    if (Math.abs(paymentSum - parsedTotal) > 0.01) {
      return c.json({ error: 'La suma de los pagos no coincide con el total de la venta' }, 400);
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
