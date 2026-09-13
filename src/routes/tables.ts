import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { prisma } from '../db';

const tables = new Hono();

const tableItemsSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1, 'ID de producto inválido'),
    quantity: z.union([z.number(), z.string()])
      .transform((val) => typeof val === 'string' ? parseInt(val) : val)
      .refine((int) => !isNaN(int) && int > 0, { message: 'La cantidad debe ser mayor a cero' }),
    price: z.union([z.number(), z.string()])
      .transform((val) => typeof val === 'string' ? parseFloat(val) : val)
      .refine((num) => !isNaN(num) && num >= 0, { message: 'El precio no puede ser negativo' }),
  }))
});

const tableCheckoutSchema = z.object({
  payments: z.array(z.object({
    method: z.enum(['CASH', 'CARD', 'TRANSFER', 'INTERNAL']),
    amount: z.union([z.number(), z.string()])
      .transform((val) => typeof val === 'string' ? parseFloat(val) : val)
      .refine((num) => !isNaN(num) && num > 0, { message: 'El monto del pago debe ser mayor a cero' }),
  })).min(1, 'Debe ingresar al menos un método de pago')
});

const tableMergeSchema = z.object({
  targetTableId: z.string().min(1, 'ID de mesa destino requerido')
});

const tableTransferItemsSchema = z.object({
  targetTableId: z.string().min(1, 'ID de mesa destino requerido'),
  items: z.array(z.object({
    productId: z.string().min(1, 'ID de producto inválido'),
    quantity: z.union([z.number(), z.string()])
      .transform((val) => typeof val === 'string' ? parseInt(val) : val)
      .refine((int) => !isNaN(int) && int > 0, { message: 'La cantidad debe ser mayor a cero' })
  })).min(1, 'Debe incluir al menos un producto a transferir')
});

const tablePartialCheckoutSchema = z.object({
  userId: z.string().min(1, 'ID de usuario requerido'),
  items: z.array(z.object({
    productId: z.string().min(1, 'ID de producto inválido'),
    quantity: z.union([z.number(), z.string()])
      .transform((val) => typeof val === 'string' ? parseInt(val) : val)
      .refine((int) => !isNaN(int) && int > 0, { message: 'La cantidad debe ser mayor a cero' }),
    price: z.union([z.number(), z.string()])
      .transform((val) => typeof val === 'string' ? parseFloat(val) : val)
      .refine((num) => !isNaN(num) && num >= 0, { message: 'El precio no puede ser negativo' })
  })).min(1, 'Debe incluir al menos un producto para cobrar'),
  payments: z.array(z.object({
    method: z.enum(['CASH', 'CARD', 'TRANSFER', 'INTERNAL']),
    amount: z.union([z.number(), z.string()])
      .transform((val) => typeof val === 'string' ? parseFloat(val) : val)
      .refine((num) => !isNaN(num) && num > 0, { message: 'El monto del pago debe ser mayor a cero' })
  })).min(1, 'Debe ingresar al menos un método de pago')
});


class ApiError extends Error {
  constructor(message: string, public status: 400 | 404 = 400) {
    super(message);
  }
}

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
      if (!table) throw new ApiError('Mesa no encontrada', 404);
      if (table.status !== 'AVAILABLE') throw new ApiError('La mesa no está disponible', 400);

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
    if (error instanceof ApiError) {
      return c.json({ error: error.message }, error.status);
    }
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

      if (!table) throw new ApiError('Mesa no encontrada', 404);
      if (!table.currentSaleId || !table.currentSale) {
        throw new ApiError('Mesa no ocupada o sin orden activa', 400);
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
          if (!prod) throw new ApiError(`Producto no encontrado: ID ${prodId}`, 404);

          // Skip stock checks for café products that have mock infinite stock
          if (!(prod.department === 'CAFE' && prod.stock >= 900)) {
            if (diff > 0 && prod.stock < diff) {
              throw new ApiError(`Stock insuficiente para "${prod.name}". Disponible: ${prod.stock}, Requerido adicional: ${diff}`, 400);
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
    if (error instanceof ApiError) {
      return c.json({ error: error.message }, error.status);
    }
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

      if (!table) throw new ApiError('Mesa no encontrada', 404);
      if (!table.currentSaleId || !table.currentSale) {
        throw new ApiError('Mesa no ocupada o sin orden activa', 400);
      }

      const saleId = table.currentSaleId;
      const total = Number(table.currentSale.total);

      // Verify payments match the total
      const paymentSum = payments.reduce((acc: number, p: any) => acc + parseFloat(p.amount), 0);
      if (Math.abs(paymentSum - total) > 0.01) {
        throw new ApiError('La suma de pagos no coincide con el total de la cuenta', 400);
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
    if (error instanceof ApiError) {
      return c.json({ error: error.message }, error.status);
    }
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

      if (!table) throw new ApiError('Mesa no encontrada', 404);
      if (!table.currentSaleId || !table.currentSale) {
        throw new ApiError('Mesa no ocupada o sin orden activa', 400);
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
    if (error instanceof ApiError) {
      return c.json({ error: error.message }, error.status);
    }
    return c.json({ error: error.message || 'Error al anular la cuenta de la mesa' }, 500);
  }
});

// POST / - Crear nueva mesa
tables.post('/', async (c) => {
  try {
    const { name, x, y } = await c.req.json();
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
        status: 'AVAILABLE',
        x: typeof x === 'number' ? x : 50.0,
        y: typeof y === 'number' ? y : 50.0
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
    const table = await prisma.cafeTable.findUnique({
      where: { id },
      include: {
        currentSale: {
          include: { items: true }
        }
      }
    });
    if (!table) {
      return c.json({ error: 'Mesa no encontrada' }, 404);
    }

    // Transacción para desvincular ventas, revertir stock si está ocupada, y borrar mesa
    await prisma.$transaction(async (tx) => {
      if (table.status === 'OCCUPIED' && table.currentSale) {
        // Revertir stock de la comanda activa
        for (const item of table.currentSale.items) {
          const prod = await tx.product.findUnique({ where: { id: item.productId } });
          if (prod && !(prod.department === 'CAFE' && prod.stock >= 900)) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } }
            });
          }
        }

        // Marcar la comanda activa como CANCELLED
        await tx.sale.update({
          where: { id: table.currentSaleId! },
          data: { status: 'CANCELLED' }
        });
      }

      // Desvincular ventas pasadas de esta mesa
      await tx.sale.updateMany({
        where: { tableId: id },
        data: { tableId: null }
      });

      // Borrar la mesa
      await tx.cafeTable.delete({
        where: { id }
      });
    });

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Error al eliminar la mesa' }, 500);
  }
});

// PUT /:id/position - Actualizar posición de la mesa
tables.put('/:id/position', async (c) => {
  const id = c.req.param('id');
  try {
    const existing = await prisma.cafeTable.findUnique({ where: { id } });
    if (!existing) {
      return c.json({ error: 'Mesa no encontrada' }, 404);
    }

    const { x, y } = await c.req.json();
    if (typeof x !== 'number' || typeof y !== 'number') {
      return c.json({ error: 'Coordenadas x e y requeridas y deben ser números' }, 400);
    }

    const table = await prisma.cafeTable.update({
      where: { id },
      data: { x, y }
    });

    return c.json({ success: true, table });
  } catch (error) {
    return c.json({ error: 'Error al actualizar la posición de la mesa' }, 500);
  }
});

// POST /:id/merge - Fusionar mesa o mover mesa completa a otra
tables.post('/:id/merge', zValidator('json', tableMergeSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: result.error.issues[0].message }, 400);
  }
}), async (c) => {
  const sourceId = c.req.param('id');
  const { targetTableId } = c.req.valid('json');

  if (sourceId === targetTableId) {
    return c.json({ error: 'No se puede fusionar una mesa consigo misma' }, 400);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const source = await tx.cafeTable.findUnique({
        where: { id: sourceId },
        include: {
          currentSale: {
            include: { items: true }
          }
        }
      });

      if (!source) throw new ApiError('Mesa origen no encontrada', 404);
      if (source.status !== 'OCCUPIED' || !source.currentSale || source.currentSale.items.length === 0) {
        throw new ApiError('La mesa de origen no tiene una cuenta activa con productos', 400);
      }

      const target = await tx.cafeTable.findUnique({
        where: { id: targetTableId },
        include: {
          currentSale: {
            include: { items: true }
          }
        }
      });

      if (!target) throw new ApiError('Mesa destino no encontrada', 404);

      if (target.status === 'AVAILABLE') {
        // Mover mesa completa a mesa disponible
        const saleId = source.currentSale.id;

        // 1. Liberar mesa origen primero para no violar restricción unique de currentSaleId
        await tx.cafeTable.update({
          where: { id: sourceId },
          data: {
            status: 'AVAILABLE',
            currentSaleId: null
          }
        });

        // 2. Reasignar venta a la mesa destino
        await tx.sale.update({
          where: { id: saleId },
          data: { tableId: targetTableId }
        });

        // 3. Ocupar mesa destino
        await tx.cafeTable.update({
          where: { id: targetTableId },
          data: {
            status: 'OCCUPIED',
            currentSaleId: saleId
          }
        });
      } else {
        // Mesa destino ocupada: fusionar ítems
        if (!target.currentSale) {
          throw new ApiError('Mesa destino en estado inconsistente', 400);
        }

        const targetSaleId = target.currentSale.id;
        const targetItems = target.currentSale.items;
        const sourceItems = source.currentSale.items;

        for (const sItem of sourceItems) {
          const existingTItem = targetItems.find(ti => ti.productId === sItem.productId);
          if (existingTItem) {
            await tx.saleItem.update({
              where: { id: existingTItem.id },
              data: { quantity: existingTItem.quantity + sItem.quantity }
            });
            existingTItem.quantity += sItem.quantity;
          } else {
            const newItem = await tx.saleItem.create({
              data: {
                saleId: targetSaleId,
                productId: sItem.productId,
                quantity: sItem.quantity,
                price: Number(sItem.price)
              }
            });
            targetItems.push(newItem as any);
          }
        }

        // Eliminar ítems de la venta origen
        await tx.saleItem.deleteMany({ where: { saleId: source.currentSale.id } });

        // Marcar venta origen como TRANSFER_OUT
        await tx.sale.update({
          where: { id: source.currentSale.id },
          data: { status: 'TRANSFER_OUT', total: 0 }
        });

        // Liberar mesa origen
        await tx.cafeTable.update({
          where: { id: sourceId },
          data: {
            status: 'AVAILABLE',
            currentSaleId: null
          }
        });

        // Recalcular total de la mesa destino
        const allTargetItems = await tx.saleItem.findMany({ where: { saleId: targetSaleId } });
        const newTotal = allTargetItems.reduce((acc, it) => acc + (it.quantity * Number(it.price)), 0);

        await tx.sale.update({
          where: { id: targetSaleId },
          data: { total: newTotal }
        });
      }

      const [updatedSource, updatedTarget] = await Promise.all([
        tx.cafeTable.findUnique({
          where: { id: sourceId },
          include: { currentSale: { include: { items: { include: { product: true } } } } }
        }),
        tx.cafeTable.findUnique({
          where: { id: targetTableId },
          include: { currentSale: { include: { items: { include: { product: true } } } } }
        })
      ]);

      return { source: updatedSource, target: updatedTarget };
    });

    return c.json({ success: true, ...result });
  } catch (error: any) {
    if (error instanceof ApiError) {
      return c.json({ error: error.message }, error.status);
    }
    return c.json({ error: error.message || 'Error al fusionar mesas' }, 500);
  }
});

// POST /:id/transfer-items - Transferir ítems específicos a otra mesa
tables.post('/:id/transfer-items', zValidator('json', tableTransferItemsSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: result.error.issues[0].message }, 400);
  }
}), async (c) => {
  const sourceId = c.req.param('id');
  const { targetTableId, items } = c.req.valid('json');

  if (sourceId === targetTableId) {
    return c.json({ error: 'No se pueden transferir productos a la misma mesa' }, 400);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const source = await tx.cafeTable.findUnique({
        where: { id: sourceId },
        include: {
          currentSale: {
            include: { items: true }
          }
        }
      });

      if (!source) throw new ApiError('Mesa origen no encontrada', 404);
      if (source.status !== 'OCCUPIED' || !source.currentSale) {
        throw new ApiError('La mesa de origen no tiene una cuenta activa', 400);
      }

      const target = await tx.cafeTable.findUnique({
        where: { id: targetTableId },
        include: {
          currentSale: {
            include: { items: true }
          }
        }
      });

      if (!target) throw new ApiError('Mesa destino no encontrada', 404);

      // Validar que los productos y cantidades existan en la mesa origen
      for (const reqItem of items) {
        const srcItem = source.currentSale.items.find(it => it.productId === reqItem.productId);
        if (!srcItem) {
          throw new ApiError(`El producto seleccionado (ID: ${reqItem.productId}) no existe en la mesa origen`, 400);
        }
        if (reqItem.quantity > srcItem.quantity) {
          throw new ApiError(`Cantidad solicitada (${reqItem.quantity}) mayor a la existente (${srcItem.quantity})`, 400);
        }
      }

      // Preparar venta destino
      let targetSaleId: string;
      if (target.status === 'AVAILABLE') {
        const newSale = await tx.sale.create({
          data: {
            userId: source.currentSale.userId,
            total: 0,
            status: 'OPEN',
            tableId: targetTableId
          }
        });
        await tx.cafeTable.update({
          where: { id: targetTableId },
          data: {
            status: 'OCCUPIED',
            currentSaleId: newSale.id
          }
        });
        targetSaleId = newSale.id;
      } else {
        if (!target.currentSale) {
          throw new ApiError('Mesa destino en estado inconsistente', 400);
        }
        targetSaleId = target.currentSale.id;
      }

      const targetItems = await tx.saleItem.findMany({ where: { saleId: targetSaleId } });

      // Transferir cada producto
      for (const reqItem of items) {
        const srcItem = source.currentSale.items.find(it => it.productId === reqItem.productId)!;
        const itemPrice = Number(srcItem.price);

        // 1. Deducir de origen
        if (reqItem.quantity === srcItem.quantity) {
          await tx.saleItem.delete({ where: { id: srcItem.id } });
        } else {
          await tx.saleItem.update({
            where: { id: srcItem.id },
            data: { quantity: srcItem.quantity - reqItem.quantity }
          });
        }

        // 2. Agregar a destino
        const existingTItem = targetItems.find(it => it.productId === reqItem.productId);
        if (existingTItem) {
          await tx.saleItem.update({
            where: { id: existingTItem.id },
            data: { quantity: existingTItem.quantity + reqItem.quantity }
          });
          existingTItem.quantity += reqItem.quantity;
        } else {
          const createdItem = await tx.saleItem.create({
            data: {
              saleId: targetSaleId,
              productId: reqItem.productId,
              quantity: reqItem.quantity,
              price: itemPrice
            }
          });
          targetItems.push(createdItem as any);
        }
      }

      // Actualizar total destino
      const updatedTargetItems = await tx.saleItem.findMany({ where: { saleId: targetSaleId } });
      const targetTotal = updatedTargetItems.reduce((acc, it) => acc + (it.quantity * Number(it.price)), 0);
      await tx.sale.update({
        where: { id: targetSaleId },
        data: { total: targetTotal }
      });

      // Revisar estado de la mesa origen
      const remainingSourceItems = await tx.saleItem.findMany({ where: { saleId: source.currentSale.id } });
      if (remainingSourceItems.length === 0) {
        await tx.sale.update({
          where: { id: source.currentSale.id },
          data: { status: 'TRANSFER_OUT', total: 0 }
        });
        await tx.cafeTable.update({
          where: { id: sourceId },
          data: {
            status: 'AVAILABLE',
            currentSaleId: null
          }
        });
      } else {
        const sourceTotal = remainingSourceItems.reduce((acc, it) => acc + (it.quantity * Number(it.price)), 0);
        await tx.sale.update({
          where: { id: source.currentSale.id },
          data: { total: sourceTotal }
        });
      }

      const [updatedSource, updatedTarget] = await Promise.all([
        tx.cafeTable.findUnique({
          where: { id: sourceId },
          include: { currentSale: { include: { items: { include: { product: true } } } } }
        }),
        tx.cafeTable.findUnique({
          where: { id: targetTableId },
          include: { currentSale: { include: { items: { include: { product: true } } } } }
        })
      ]);

      return { source: updatedSource, target: updatedTarget };
    });

    return c.json({ success: true, ...result });
  } catch (error: any) {
    if (error instanceof ApiError) {
      return c.json({ error: error.message }, error.status);
    }
    return c.json({ error: error.message || 'Error al transferir productos' }, 500);
  }
});

// POST /:id/partial-checkout - Cobro parcial inmediato de ítems seleccionados
tables.post('/:id/partial-checkout', zValidator('json', tablePartialCheckoutSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: result.error.issues[0].message }, 400);
  }
}), async (c) => {
  const tableId = c.req.param('id');
  const { userId, items, payments } = c.req.valid('json');

  const itemsTotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const paymentSum = payments.reduce((acc, p) => acc + p.amount, 0);

  if (Math.abs(paymentSum - itemsTotal) > 0.01) {
    return c.json({ error: 'La suma de pagos no coincide con el total de los productos a facturar' }, 400);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const table = await tx.cafeTable.findUnique({
        where: { id: tableId },
        include: {
          currentSale: {
            include: { items: true }
          }
        }
      });

      if (!table) throw new ApiError('Mesa no encontrada', 404);
      if (table.status !== 'OCCUPIED' || !table.currentSale) {
        throw new ApiError('Mesa no ocupada o sin orden activa', 400);
      }

      // Validar que cada ítem solicitado exista en la comanda de la mesa con suficiente cantidad
      for (const reqItem of items) {
        const currentItem = table.currentSale.items.find(it => it.productId === reqItem.productId);
        if (!currentItem) {
          throw new ApiError(`El producto seleccionado (ID: ${reqItem.productId}) no existe en la comanda`, 400);
        }
        if (reqItem.quantity > currentItem.quantity) {
          throw new ApiError(`Cantidad solicitada (${reqItem.quantity}) mayor a la existente (${currentItem.quantity})`, 400);
        }
      }

      // 1. Crear nueva venta independiente COMPLETED para los ítems cobrados
      const completedSale = await tx.sale.create({
        data: {
          userId,
          total: itemsTotal,
          status: 'COMPLETED',
          tableId
        }
      });

      // Crear ítems de la venta completada
      await tx.saleItem.createMany({
        data: items.map(it => ({
          saleId: completedSale.id,
          productId: it.productId,
          quantity: it.quantity,
          price: it.price
        }))
      });

      // Registrar los pagos
      await tx.salePayment.createMany({
        data: payments.map(p => ({
          saleId: completedSale.id,
          method: p.method,
          amount: p.amount
        }))
      });

      // 2. Deducir de la comanda activa de la mesa
      for (const reqItem of items) {
        const currentItem = table.currentSale.items.find(it => it.productId === reqItem.productId)!;
        if (reqItem.quantity === currentItem.quantity) {
          await tx.saleItem.delete({ where: { id: currentItem.id } });
        } else {
          await tx.saleItem.update({
            where: { id: currentItem.id },
            data: { quantity: currentItem.quantity - reqItem.quantity }
          });
        }
      }

      // 3. Revisar si quedan ítems en la comanda activa
      const remainingItems = await tx.saleItem.findMany({ where: { saleId: table.currentSale.id } });
      let updatedTable: any;

      if (remainingItems.length === 0) {
        // Se cobró la comanda completa
        await tx.sale.update({
          where: { id: table.currentSale.id },
          data: { status: 'CANCELLED', total: 0 }
        });
        updatedTable = await tx.cafeTable.update({
          where: { id: tableId },
          data: {
            status: 'AVAILABLE',
            currentSaleId: null
          },
          include: { currentSale: true }
        });
      } else {
        const newTotal = remainingItems.reduce((acc, it) => acc + (it.quantity * Number(it.price)), 0);
        await tx.sale.update({
          where: { id: table.currentSale.id },
          data: { total: newTotal }
        });
        updatedTable = await tx.cafeTable.findUnique({
          where: { id: tableId },
          include: {
            currentSale: {
              include: { items: { include: { product: true } } }
            }
          }
        });
      }

      const finalCompletedSale = await tx.sale.findUnique({
        where: { id: completedSale.id },
        include: {
          items: { include: { product: true } },
          payments: true
        }
      });

      return {
        sale: finalCompletedSale,
        table: updatedTable
      };
    });

    return c.json({ success: true, ...result });
  } catch (error: any) {
    if (error instanceof ApiError) {
      return c.json({ error: error.message }, error.status);
    }
    return c.json({ error: error.message || 'Error al procesar cobro parcial' }, 500);
  }
});

export default tables;
