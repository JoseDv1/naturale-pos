import { Hono } from 'hono';
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

transfers.post('/', async (c) => {
  try {
    const { productId, targetProductId, quantity, fromDepartment, toDepartment, userId } = await c.req.json();

    if (!productId || !quantity || !fromDepartment || !toDepartment || !userId) {
      return c.json({ error: 'Información de traslado incompleta' }, 400);
    }

    const qty = parseInt(quantity);
    if (qty <= 0) return c.json({ error: 'La cantidad debe ser mayor a cero' }, 400);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Retrieve the source product to check stock and cost
      const sourceProduct = await tx.product.findUnique({ where: { id: productId } });
      if (!sourceProduct) throw new Error('Producto origen no encontrado');

      if (sourceProduct.stock < qty) {
        throw new Error(`Stock insuficiente para trasladar. Disponible: ${sourceProduct.stock}, Solicitado: ${qty}`);
      }

      const totalCost = qty * sourceProduct.cost;

      // 2. Decrement source product stock
      await tx.product.update({
        where: { id: productId },
        data: { stock: { decrement: qty } },
      });

      // 3. Increment target product stock (if target product ID provided)
      if (targetProductId) {
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
    return c.json({ error: error.message || 'Error al procesar el traslado' }, 500);
  }
});

export default transfers;
