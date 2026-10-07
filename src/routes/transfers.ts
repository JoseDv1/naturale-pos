import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { prisma } from '../db';

const transfers = new Hono();

transfers.get('/', async (c) => {
  const list = await prisma.productTransfer.findMany({
    include: {
      product: { select: { name: true, sku: true } },
      variant: { select: { id: true, name: true, sku: true } },
      targetProduct: { select: { name: true, sku: true } },
      targetVariant: { select: { id: true, name: true, sku: true } },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return c.json(list);
});

const transferSchema = z.object({
  productId: z.string().min(1, 'El producto de origen es obligatorio'),
  variantId: z.string().nullable().optional(),
  targetProductId: z.string().nullable().optional(),
  targetVariantId: z.string().nullable().optional(),
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
  if (data.targetVariantId && !data.targetProductId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Debe especificar el producto de destino para la variante seleccionada',
      path: ['targetVariantId']
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
    const { productId, variantId, targetProductId, targetVariantId, quantity, fromDepartment, toDepartment, userId } = c.req.valid('json');
    const qty = quantity;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Retrieve the source product and optional variant to check stock and cost
      const sourceProduct = await tx.product.findUnique({ where: { id: productId } });
      if (!sourceProduct) throw new ApiError('Producto origen no encontrado', 404);

      let sourceVariant = null;
      if (variantId) {
        sourceVariant = await tx.productVariant.findUnique({ where: { id: variantId } });
        if (!sourceVariant) throw new ApiError('Variante de origen no encontrada', 404);
        if (sourceVariant.productId !== productId) {
          throw new ApiError('La variante no pertenece al producto de origen', 400);
        }
        if (sourceVariant.stock < qty) {
          throw new ApiError(`Stock insuficiente en la variante para trasladar. Disponible: ${sourceVariant.stock}, Solicitado: ${qty}`, 400);
        }
      }

      if (sourceProduct.stock < qty) {
        throw new ApiError(`Stock insuficiente para trasladar. Disponible: ${sourceProduct.stock}, Solicitado: ${qty}`, 400);
      }

      const effectiveUnitCost = (sourceVariant && Number(sourceVariant.cost) > 0)
        ? sourceVariant.cost
        : sourceProduct.cost;
      const totalCost = qty * Number(effectiveUnitCost);

      // 2. Decrement source product and variant stock
      if (sourceVariant) {
        await tx.productVariant.update({
          where: { id: variantId! },
          data: { stock: { decrement: qty } },
        });
      }
      await tx.product.update({
        where: { id: productId },
        data: { stock: { decrement: qty } },
      });

      // 3. Increment target product and variant stock (if target product ID provided)
      if (targetProductId) {
        const targetProduct = await tx.product.findUnique({ where: { id: targetProductId } });
        if (!targetProduct) throw new ApiError('Producto destino no encontrado', 404);

        if (targetVariantId) {
          const targetVariant = await tx.productVariant.findUnique({ where: { id: targetVariantId } });
          if (!targetVariant) throw new ApiError('Variante de destino no encontrada', 404);
          if (targetVariant.productId !== targetProductId) {
            throw new ApiError('La variante de destino no pertenece al producto de destino', 400);
          }
          await tx.productVariant.update({
            where: { id: targetVariantId },
            data: { stock: { increment: qty } },
          });
        }

        await tx.product.update({
          where: { id: targetProductId },
          data: { stock: { increment: qty } },
        });
      }

      // 4. Create ProductTransfer Audit Log
      const transfer = await tx.productTransfer.create({
        data: {
          productId,
          variantId: variantId || null,
          targetProductId: targetProductId || null,
          targetVariantId: targetVariantId || null,
          quantity: qty,
          unitCost: effectiveUnitCost,
          totalCost,
          fromDepartment,
          toDepartment,
          userId,
        },
      });

      // 5. Financial Balancing:
      // a. Log an Expense for the receiving department
      const variantDesc = sourceVariant ? ` - ${sourceVariant.name}` : '';
      await tx.expense.create({
        data: {
          description: `Traslado Interno Recibido: ${sourceProduct.name}${variantDesc} (x${qty})`,
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
                variantId: sourceVariant ? sourceVariant.id : null,
                quantity: qty,
                price: effectiveUnitCost,
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
