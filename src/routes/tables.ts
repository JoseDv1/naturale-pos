import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { prisma } from '../db';

const tables = new Hono();

const tableItemsSchema = z.object({
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
  }))
});

const tableCheckoutSchema = z.object({
  payments: z.array(z.object({
    method: z.enum(['CASH', 'CARD', 'TRANSFER', 'INTERNAL']),
    amount: z.union([z.number(), z.string()]).transform((val) => {
      const num = typeof val === 'string' ? parseFloat(val) : val;
      if (isNaN(num) || num <= 0) throw new Error('El monto del pago debe ser mayor a cero');
      return num;
    })
  })).min(1, 'Debe ingresar al menos un método de pago')
});

tables.get('/', async (c) => {
  try {
    const list = await prisma.cafeTable.findMany({
      include: {
        currentSale: {
          include: {
            items: {
              include: {
                product: {
                  include: { category: true }
                }
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });
    return c.json(list);
  } catch (error) {
    return c.json({ error: 'Error al obtener las mesas' }, 500);
  }
});

tables.post('/:id/open', async (c) => {
  const id = c.req.param('id');
  try {
    const { userId } = await c.req.json();
    if (!userId) {
      return c.json({ error: 'Usuario requerido para abrir la mesa' }, 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      const table = await tx.cafeTable.findUnique({ where: { id } });
      if (!table) throw new Error('Mesa no encontrada');
      if (table.status !== 'AVAILABLE') throw new Error('La mesa no está disponible');

      // Create an open, empty sale associated with this table
      const sale = await tx.sale.create({
        data: {
          userId,
          total: 0,
          status: 'OPEN',
          tableId: id
        }
      });

      // Link sale and update table status to OCCUPIED
      const updatedTable = await tx.cafeTable.update({
        where: { id },
        data: {
          status: 'OCCUPIED',
          currentSaleId: sale.id
        },
        include: {
          currentSale: {
            include: {
              items: {
                include: { product: true }
              }
            }
          }
        }
      });

      return { table: updatedTable, sale };
    });

    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message || 'Error al abrir la mesa' }, 500);
  }
});

tables.put('/:id/save', zValidator('json', tableItemsSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: result.error.issues[0].message }, 400);
  }
}), async (c) => {
  const id = c.req.param('id');
  try {
    const { items } = c.req.valid('json');

    const result = await prisma.$transaction(async (tx) => {
      const table = await tx.cafeTable.findUnique({
        where: { id },
        include: {
          currentSale: {
            include: { items: true }
          }
        }
      });

      if (!table || !table.currentSaleId || !table.currentSale) {
        throw new Error('Mesa no ocupada o sin orden activa');
      }

      const saleId = table.currentSaleId;
      const existingItems = table.currentSale.items;

      // Map of existing product stock reservations
      const existingQtyMap = new Map<string, number>();
      for (const item of existingItems) {
        existingQtyMap.set(item.productId, item.quantity);
      }

      // Map of new requested product quantities
      const newQtyMap = new Map<string, number>();
      for (const item of items) {
        newQtyMap.set(item.productId, item.quantity);
      }

      const allProductIds = new Set([...existingQtyMap.keys(), ...newQtyMap.keys()]);

      // Handle stock reservation adjustments
      for (const prodId of allProductIds) {
        const existingQty = existingQtyMap.get(prodId) || 0;
        const newQty = newQtyMap.get(prodId) || 0;
        const diff = newQty - existingQty;

        if (diff !== 0) {
          const prod = await tx.product.findUnique({ where: { id: prodId } });
          if (!prod) throw new Error(`Producto no encontrado: ID ${prodId}`);

          // Skip stock checks for café products that have mock infinite stock
          if (!(prod.department === 'CAFE' && prod.stock >= 900)) {
            if (diff > 0 && prod.stock < diff) {
              throw new Error(`Stock insuficiente para "${prod.name}". Disponible: ${prod.stock}, Requerido adicional: ${diff}`);
            }
            await tx.product.update({
              where: { id: prodId },
              data: { stock: { decrement: diff } }
            });
          }
        }
      }

      // If items is empty, free the table and mark the sale as CANCELLED!
      if (items.length === 0) {
        // Delete existing sale items
        await tx.saleItem.deleteMany({ where: { saleId } });

        // Update sale status to CANCELLED
        const updatedSale = await tx.sale.update({
          where: { id: saleId },
          data: { status: 'CANCELLED', total: 0 }
        });

        // Free table
        await tx.cafeTable.update({
          where: { id },
          data: {
            status: 'AVAILABLE',
            currentSaleId: null
          }
        });

        return updatedSale;
      }

      // Delete existing sale items and recreate
      await tx.saleItem.deleteMany({ where: { saleId } });
      
      if (items && items.length > 0) {
        await tx.saleItem.createMany({
          data: items.map((item: any) => ({
            saleId,
            productId: item.productId,
            quantity: item.quantity,
            price: parseFloat(item.price)
          }))
        });
      }

      // Calculate total
      const total = items.reduce((sum: number, item: any) => sum + (parseFloat(item.price) * item.quantity), 0);

      const updatedSale = await tx.sale.update({
        where: { id: saleId },
        data: { total },
        include: {
          items: {
            include: { product: true }
          }
        }
      });

      return updatedSale;
    });

    return c.json({ success: true, sale: result });
  } catch (error: any) {
    return c.json({ error: error.message || 'Error al guardar la orden de la mesa' }, 500);
  }
});

tables.post('/:id/checkout', zValidator('json', tableCheckoutSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: result.error.issues[0].message }, 400);
  }
}), async (c) => {
  const id = c.req.param('id');
  try {
    const { payments } = c.req.valid('json');

    const result = await prisma.$transaction(async (tx) => {
      const table = await tx.cafeTable.findUnique({
        where: { id },
        include: {
          currentSale: {
            include: { items: true }
          }
        }
      });

      if (!table || !table.currentSaleId || !table.currentSale) {
        throw new Error('Mesa no ocupada o sin orden activa');
      }

      const saleId = table.currentSaleId;
      const total = table.currentSale.total;

      // Verify payments match the total
      const paymentSum = payments.reduce((acc: number, p: any) => acc + parseFloat(p.amount), 0);
      if (Math.abs(paymentSum - total) > 0.01) {
        throw new Error('La suma de pagos no coincide con el total de la cuenta');
      }

      // Record payments
      await tx.salePayment.createMany({
        data: payments.map((pay: any) => ({
          saleId,
          method: pay.method,
          amount: parseFloat(pay.amount)
        }))
      });

      // Update sale status to COMPLETED
      const sale = await tx.sale.update({
        where: { id: saleId },
        data: { status: 'COMPLETED' },
        include: {
          items: {
            include: { product: true }
          },
          payments: true
        }
      });

      // Reset/free table status
      await tx.cafeTable.update({
        where: { id },
        data: {
          status: 'AVAILABLE',
          currentSaleId: null
        }
      });

      return sale;
    });

    return c.json({ success: true, sale: result });
  } catch (error: any) {
    return c.json({ error: error.message || 'Error al facturar la mesa' }, 500);
  }
});

tables.post('/:id/cancel', async (c) => {
  const id = c.req.param('id');
  try {
    const result = await prisma.$transaction(async (tx) => {
      const table = await tx.cafeTable.findUnique({
        where: { id },
        include: {
          currentSale: {
            include: { items: true }
          }
        }
      });

      if (!table || !table.currentSaleId || !table.currentSale) {
        throw new Error('Mesa no ocupada o sin orden activa');
      }

      const saleId = table.currentSaleId;

      // Restore stock for all items
      for (const item of table.currentSale.items) {
        const prod = await tx.product.findUnique({ where: { id: item.productId } });
        if (prod && !(prod.department === 'CAFE' && prod.stock >= 900)) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } }
          });
        }
      }

      // Mark sale status as CANCELLED
      await tx.sale.update({
        where: { id: saleId },
        data: { status: 'CANCELLED' }
      });

      // Free table
      const updatedTable = await tx.cafeTable.update({
        where: { id },
        data: {
          status: 'AVAILABLE',
          currentSaleId: null
        }
      });

      return updatedTable;
    });

    return c.json({ success: true, table: result });
  } catch (error: any) {
    return c.json({ error: error.message || 'Error al anular la cuenta de la mesa' }, 500);
  }
});

// POST / - Crear nueva mesa
tables.post('/', async (c) => {
  try {
    const { name } = await c.req.json();
    if (!name || name.trim() === '') {
      return c.json({ error: 'El nombre de la mesa es obligatorio' }, 400);
    }

    // Verificar unicidad
    const existing = await prisma.cafeTable.findUnique({ where: { name: name.trim() } });
    if (existing) {
      return c.json({ error: 'Ya existe una mesa con este nombre' }, 400);
    }

    const table = await prisma.cafeTable.create({
      data: {
        name: name.trim(),
        status: 'AVAILABLE'
      }
    });

    return c.json({ table });
  } catch (error) {
    return c.json({ error: 'Error al crear la mesa' }, 500);
  }
});

// DELETE /:id - Eliminar una mesa
tables.delete('/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const table = await prisma.cafeTable.findUnique({ where: { id } });
    if (!table) {
      return c.json({ error: 'Mesa no encontrada' }, 404);
    }

    if (table.status === 'OCCUPIED') {
      return c.json({ error: 'No se puede eliminar una mesa ocupada con pedidos activos' }, 400);
    }

    // Transacción para desvincular ventas y borrar mesa
    await prisma.$transaction([
      prisma.sale.updateMany({
        where: { tableId: id },
        data: { tableId: null }
      }),
      prisma.cafeTable.delete({
        where: { id }
      })
    ]);

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Error al eliminar la mesa' }, 500);
  }
});

export default tables;
