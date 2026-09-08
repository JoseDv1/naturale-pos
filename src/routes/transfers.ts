import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { prisma } from '../db';

const transfers = new Hono();

transfers.get('/', async (c) => {
  const list = await prisma.productTransfer.findMany({
    include: {
      product: { select: { name: true, sku: true } },
      targetProduct: { select: { name: true, sku: true } },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return c.json(list);
});

const transferSchema = z.object({
  productId: z.string().min(1, 'El producto de origen es obligatorio'),
  targetProductId: z.string().nullable().optional(),
  quantity: z.union([z.number(), z.string()])
    .transform((val) => typeof val === 'string' ? parseInt(val) : val)
    .refine((int) => !isNaN(int) && int > 0, { message: 'La cantidad del traslado debe ser un número entero mayor a cero' }),
  fromDepartment: z.enum(['MARKET', 'CAFE'], {
    message: 'Departamento de origen inválido (debe ser MARKET o CAFE)'
  }),
  toDepartment: z.enum(['MARKET', 'CAFE'], {
    message: 'Departamento de destino inválido (debe ser MARKET o CAFE)'
  }),
  userId: z.string().min(1, 'El usuario es obligatorio')
}).superRefine((data, ctx) => {
  if (data.fromDepartment === data.toDepartment) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Los departamentos origen y destino deben ser diferentes',
      path: ['toDepartment']
    });
  }
  if (data.targetProductId && data.productId === data.targetProductId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'El producto de destino debe ser diferente al de origen',
      path: ['targetProductId']
    });
  }
});

class ApiError extends Error {
  constructor(message: string, public status: 400 | 404 = 400) {
    super(message);
  }
}

transfers.post('/', zValidator('json', transferSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: result.error.issues[0].message }, 400);
  }
}), async (c) => {
  try {
    const { productId, targetProductId, quantity, fromDepartment, toDepartment, userId } = c.req.valid('json');
    const qty = quantity;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Retrieve the source product to check stock and cost
      const sourceProduct = await tx.product.findUnique({ where: { id: productId } });
      if (!sourceProduct) throw new ApiError('Producto origen no encontrado', 404);

      if (sourceProduct.stock < qty) {
        throw new ApiError(`Stock insuficiente para trasladar. Disponible: ${sourceProduct.stock}, Solicitado: ${qty}`, 400);
      }

      const totalCost = qty * Number(sourceProduct.cost);

      // 2. Decrement source product stock
      await tx.product.update({
        where: { id: productId },
        data: { stock: { decrement: qty } },
      });

      // 3. Increment target product stock (if target product ID provided)
      if (targetProductId) {
        const targetProduct = await tx.product.findUnique({ where: { id: targetProductId } });
        if (!targetProduct) throw new ApiError('Producto destino no encontrado', 404);

        await tx.product.update({
          where: { id: targetProductId },
          data: { stock: { increment: qty } },
        });
      }

      // 4. Create ProductTransfer Audit Log
      const transfer = await tx.productTransfer.create({
        data: {
          productId,
          targetProductId: targetProductId || null,
          quantity: qty,
          unitCost: sourceProduct.cost,
          totalCost,
          fromDepartment,
          toDepartment,
          userId,
        },
      });

      // 5. Financial Balancing:
      // a. Log an Expense for the receiving department
      await tx.expense.create({
        data: {
          description: `Traslado Interno Recibido: ${sourceProduct.name} (x${qty})`,
          amount: totalCost,
          category: 'INTERNAL_TRANSFER',
          department: toDepartment,
          userId,
        },
      });

      // b. Log a Sale for the sending department (using status TRANSFER_OUT and payment method INTERNAL)
      await tx.sale.create({
        data: {
          userId,
          total: totalCost,
          status: 'TRANSFER_OUT',
          items: {
            create: [
              {
                productId: sourceProduct.id,
                quantity: qty,
                price: sourceProduct.cost,
              },
            ],
          },
          payments: {
            create: [
              {
                method: 'INTERNAL',
                amount: totalCost,
              },
            ],
          },
        },
      });

      return transfer;
    });

    return c.json({ success: true, transfer: result });
  } catch (error: any) {
    if (error instanceof ApiError) {
      return c.json({ error: error.message }, error.status);
    }
    return c.json({ error: error.message || 'Error al procesar el traslado' }, 500);
  }
});

export default transfers;
