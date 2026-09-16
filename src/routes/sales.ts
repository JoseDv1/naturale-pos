import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { prisma } from '../db';

const sales = new Hono();

sales.get('/', async (c) => {
  try {
    const q = c.req.query('q')?.trim();
    const status = c.req.query('status')?.trim();
    const paymentMethod = c.req.query('paymentMethod')?.trim();
    const start = c.req.query('start')?.trim();
    const end = c.req.query('end')?.trim();

    const where: any = {};

    // 1. Status filter
    if (status && status !== 'ALL') {
      const validStatuses = ['COMPLETED', 'CANCELLED', 'TRANSFER_OUT', 'OPEN'];
      if (validStatuses.includes(status.toUpperCase())) {
        where.status = status.toUpperCase();
      }
    }

    // 2. Payment method filter
    if (paymentMethod && paymentMethod !== 'ALL') {
      const validMethods = ['CASH', 'CARD', 'TRANSFER', 'INTERNAL'];
      if (validMethods.includes(paymentMethod.toUpperCase())) {
        where.payments = {
          some: {
            method: paymentMethod.toUpperCase(),
          },
        };
      }
    }

    // 3. Date range bounds
    const dateFilter: any = {};
    if (start) {
      const startDate = new Date(start);
      if (!isNaN(startDate.getTime())) {
        dateFilter.gte = startDate;
      }
    }
    if (end) {
      let endDate = new Date(end);
      if (end.length === 10 && !isNaN(endDate.getTime())) {
        endDate = new Date(`${end}T23:59:59.999Z`);
      }
      if (!isNaN(endDate.getTime())) {
        dateFilter.lte = endDate;
      }
    }
    if (Object.keys(dateFilter).length > 0) {
      where.createdAt = dateFilter;
    }

    // 4. Multi-field text search (Ticket ID, Cashier Name, Product Name)
    if (q) {
      where.OR = [
        { id: { contains: q } },
        { user: { name: { contains: q } } },
        {
          items: {
            some: {
              product: {
                name: { contains: q },
              },
            },
          },
        },
      ];
    }

    const list = await prisma.sale.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, username: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, department: true } },
            variant: { select: { id: true, name: true, sku: true } },
          },
        },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return c.json(list);
  } catch (error: any) {
    return c.json({ error: error.message || 'Error al obtener historial de ventas' }, 500);
  }
});

sales.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, username: true, role: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, department: true, price: true, cost: true } },
            variant: { select: { id: true, name: true, sku: true, price: true } },
          },
        },
        payments: true,
        table: { select: { id: true, name: true } },
      },
    });

    if (!sale) {
      return c.json({ error: 'Venta no encontrada' }, 404);
    }

    return c.json(sale);
  } catch (error: any) {
    return c.json({ error: error.message || 'Error al obtener detalle de venta' }, 500);
  }
});

const saleSchema = z.object({
  userId: z.string().min(1, 'El usuario es requerido'),
  total: z.union([z.number(), z.string()])
    .transform((val) => typeof val === 'string' ? parseFloat(val) : val)
    .refine((num) => !isNaN(num) && num > 0, { message: 'El total debe ser mayor a cero' }),
  items: z.array(z.object({
    productId: z.string().min(1, 'ID de producto inválido'),
    variantId: z.string().nullable().optional(),
    quantity: z.union([z.number(), z.string()])
      .transform((val) => typeof val === 'string' ? parseInt(val) : val)
      .refine((int) => !isNaN(int) && int > 0, { message: 'La cantidad debe ser mayor a cero' }),
    price: z.union([z.number(), z.string()])
      .transform((val) => typeof val === 'string' ? parseFloat(val) : val)
      .refine((num) => !isNaN(num) && num >= 0, { message: 'El precio no puede ser negativo' }),
  })).min(1, 'La venta debe contener al menos un producto'),
  payments: z.array(z.object({
    method: z.enum(['CASH', 'CARD', 'TRANSFER', 'INTERNAL']),
    amount: z.union([z.number(), z.string()])
      .transform((val) => typeof val === 'string' ? parseFloat(val) : val)
      .refine((num) => !isNaN(num) && num > 0, { message: 'El monto del pago debe ser mayor a cero' }),
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

class ApiError extends Error {
  constructor(message: string, public status: 400 | 404 = 400) {
    super(message);
  }
}

sales.post('/', zValidator('json', saleSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: result.error.issues[0].message }, 400);
  }
}), async (c) => {
  try {
    const { userId, total, items, payments } = c.req.valid('json');

    // 0. Active Shift Gatekeeper
    const activeShift = await prisma.shift.findFirst({
      where: { status: 'OPEN' },
    });
    if (!activeShift) {
      return c.json({ error: 'No hay un turno de caja abierto. Debe abrir caja antes de realizar ventas o registrar gastos.' }, 400);
    }

    // Execute in a transaction to enforce inventory consistency
    const result = await prisma.$transaction(async (tx) => {
      // 1. Stock check and decrement
      for (const item of items) {
        const prod = await tx.product.findUnique({ where: { id: item.productId } });
        if (!prod) throw new ApiError(`Producto no encontrado: ID ${item.productId}`, 404);
        
        let variant = null;
        if (item.variantId) {
          variant = await tx.productVariant.findUnique({ where: { id: item.variantId } });
          if (!variant) throw new ApiError(`Variante no encontrada: ID ${item.variantId}`, 404);
          if (variant.productId !== item.productId) {
            throw new ApiError('La variante no pertenece al producto seleccionado', 400);
          }
          if (!variant.active) {
            throw new ApiError(`La variante "${variant.name}" no está disponible`, 400);
          }
        }

        // Skip stock check for Cafe products with infinite/on-demand code (e.g. prepared drinks, stock coded as 999)
        const isCafeInfinite = prod.department === 'CAFE' && prod.stock >= 900;
        if (!isCafeInfinite) {
          if (variant) {
            if (variant.stock < item.quantity) {
              throw new ApiError(`Stock insuficiente para "${prod.name} (${variant.name})". Disponible: ${variant.stock}, Solicitado: ${item.quantity}`, 400);
            }
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stock: { decrement: item.quantity } },
            });
          } else {
            if (prod.stock < item.quantity) {
              throw new ApiError(`Stock insuficiente para "${prod.name}". Disponible: ${prod.stock}, Solicitado: ${item.quantity}`, 400);
            }
          }

          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          });
        }
      }

      // 2. Create the Sale
      const sale = await tx.sale.create({
        data: {
          userId,
          total,
          status: 'COMPLETED',
          shiftId: activeShift.id,
          items: {
            create: items.map((item: any) => ({
              productId: item.productId,
              variantId: item.variantId || null,
              quantity: item.quantity,
              price: item.price,
            })),
          },
          payments: {
            create: payments.map((pay: any) => ({
              method: pay.method,
              amount: pay.amount,
            })),
          },
        },
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

      return sale;
    });

    return c.json({ success: true, sale: result });
  } catch (error: any) {
    if (error instanceof ApiError) {
      return c.json({ error: error.message }, error.status);
    }
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

      if (!sale) throw new ApiError('Venta no encontrada', 404);
      if (sale.status === 'CANCELLED') throw new ApiError('La venta ya está cancelada', 400);

      // Restore stock for all items
      for (const item of sale.items) {
        const prod = await tx.product.findUnique({ where: { id: item.productId } });
        if (prod && !(prod.department === 'CAFE' && prod.stock >= 900)) {
          if (item.variantId) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stock: { increment: item.quantity } },
            }).catch(() => {});
          }
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
    if (error instanceof ApiError) {
      return c.json({ error: error.message }, error.status);
    }
    return c.json({ error: error.message || 'Error al cancelar la venta' }, 500);
  }
});

export default sales;
