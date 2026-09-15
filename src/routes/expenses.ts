import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { prisma } from '../db';
import { adminMiddleware } from '../middleware/auth';

const expenses = new Hono();

export const DEFAULT_EXPENSE_CATEGORIES = [
  { id: 'utilities', name: 'Servicios Públicos', description: 'Agua, energía eléctrica, gas, telefonía e internet', isSystem: true },
  { id: 'rent', name: 'Arriendo / Local', description: 'Canon de arrendamiento de local comercial y administración', isSystem: true },
  { id: 'supplies', name: 'Papelería y Suministros', description: 'Empaques, bolsas, insumos de papelería y productos de limpieza', isSystem: true },
  { id: 'payroll', name: 'Nómina y Sueldos', description: 'Salarios, turnos extras, seguridad social y honorarios de personal', isSystem: true },
  { id: 'maintenance', name: 'Mantenimiento y Reparaciones', description: 'Mantenimiento preventivo, reparaciones locativas y equipos', isSystem: true },
  { id: 'marketing', name: 'Publicidad y Marketing', description: 'Pauta publicitaria, redes sociales, diseño e impresiones', isSystem: true },
  { id: 'services', name: 'Servicios Profesionales', description: 'Contabilidad, asesorías jurídicas, software y soporte', isSystem: true },
  { id: 'taxes', name: 'Impuestos y Tasas', description: 'Impuestos locales, tributos, registro mercantil y licencias', isSystem: true },
  { id: 'transport', name: 'Transporte y Domicilios', description: 'Fletes, envíos de mercancía, mensajería y gasolina', isSystem: true },
  { id: 'equipment', name: 'Equipamiento y Menaje', description: 'Adquisición de maquinaria, cafeteras, refrigeración y mobiliario', isSystem: true },
  { id: 'waste', name: 'Mermas y Pérdidas', description: 'Pérdidas por avería, vencimiento o merma de producto', isSystem: true },
  { id: 'other', name: 'Otros Egresos', description: 'Caja menor, imprevistos y gastos generales varios', isSystem: true },
  { id: 'INTERNAL_TRANSFER', name: 'Traslado Interno', description: 'Traslados internos de insumos entre departamentos', isSystem: true },
] as const;

// -----------------------------------------------------------------------------
// Categorías de Egresos Endpoints
// -----------------------------------------------------------------------------

// GET /expenses/categories - List all default and custom expense categories
expenses.get('/categories', async (c) => {
  try {
    const customCategories = await prisma.expenseCategory.findMany({
      orderBy: { name: 'asc' },
    });

    const allCategories = [
      ...DEFAULT_EXPENSE_CATEGORIES.map(dc => ({
        id: dc.id,
        name: dc.name,
        description: dc.description,
        isSystem: true,
      })),
      ...customCategories.map(cc => ({
        id: cc.id,
        name: cc.name,
        description: cc.description,
        isSystem: false,
      })),
    ];

    return c.json(allCategories);
  } catch (error: any) {
    return c.json({ error: error.message || 'Error al obtener categorías de egresos' }, 500);
  }
});

const categorySchema = z.object({
  name: z.string().min(1, 'El nombre de la categoría es obligatorio'),
  description: z.string().nullable().optional(),
});

// POST /expenses/categories - Create a custom expense category (Admin only)
expenses.post('/categories', adminMiddleware, zValidator('json', categorySchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: result.error.issues[0].message }, 400);
  }
}), async (c) => {
  try {
    const { name, description } = c.req.valid('json');
    const trimmedName = name.trim();

    // Check collision with default system categories (case-insensitive)
    const isSystemCollision = DEFAULT_EXPENSE_CATEGORIES.some(
      dc => dc.name.toLowerCase() === trimmedName.toLowerCase() || dc.id.toLowerCase() === trimmedName.toLowerCase()
    );
    if (isSystemCollision) {
      return c.json({ error: `La categoría "${trimmedName}" ya existe como categoría del sistema` }, 400);
    }

    // Check collision with existing custom categories (case-insensitive)
    const allCustom = await prisma.expenseCategory.findMany();
    const isCustomCollision = allCustom.some(
      cc => cc.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (isCustomCollision) {
      return c.json({ error: `La categoría "${trimmedName}" ya existe` }, 400);
    }

    const created = await prisma.expenseCategory.create({
      data: {
        name: trimmedName,
        description: description?.trim() || null,
      },
    });

    return c.json({ success: true, category: { ...created, isSystem: false } }, 201);
  } catch (error: any) {
    return c.json({ error: error.message || 'Error al crear la categoría de egreso' }, 500);
  }
});

// PUT /expenses/categories/:id - Update custom expense category (Admin only)
expenses.put('/categories/:id', adminMiddleware, zValidator('json', categorySchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: result.error.issues[0].message }, 400);
  }
}), async (c) => {
  try {
    const id = c.req.param('id');
    const { name, description } = c.req.valid('json');
    const trimmedName = name.trim();

    // Check if trying to edit a system category
    const isSystem = DEFAULT_EXPENSE_CATEGORIES.some(dc => dc.id === id);
    if (isSystem) {
      return c.json({ error: 'No se pueden modificar las categorías estándar del sistema' }, 400);
    }

    const existing = await prisma.expenseCategory.findUnique({ where: { id } });
    if (!existing) {
      return c.json({ error: 'Categoría de egreso no encontrada' }, 404);
    }

    // Check duplicate name (case-insensitive across other custom categories)
    const allCustom = await prisma.expenseCategory.findMany();
    const duplicate = allCustom.some(
      cc => cc.id !== id && cc.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      return c.json({ error: `Ya existe otra categoría con el nombre "${trimmedName}"` }, 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Cascade rename to existing expenses if name changed
      if (existing.name !== trimmedName) {
        await tx.expense.updateMany({
          where: {
            OR: [
              { category: existing.name },
              { category: existing.id },
            ],
          },
          data: { category: trimmedName },
        });
      }

      return tx.expenseCategory.update({
        where: { id },
        data: {
          name: trimmedName,
          description: description?.trim() || null,
        },
      });
    });

    return c.json({ success: true, category: { ...updated, isSystem: false } });
  } catch (error: any) {
    return c.json({ error: error.message || 'Error al actualizar la categoría de egreso' }, 500);
  }
});

// DELETE /expenses/categories/:id - Delete custom expense category (Admin only)
expenses.delete('/categories/:id', adminMiddleware, async (c) => {
  try {
    const id = c.req.param('id');

    const isSystem = DEFAULT_EXPENSE_CATEGORIES.some(dc => dc.id === id);
    if (isSystem) {
      return c.json({ error: 'No se pueden eliminar las categorías estándar del sistema' }, 400);
    }

    const existing = await prisma.expenseCategory.findUnique({ where: { id } });
    if (!existing) {
      return c.json({ error: 'Categoría de egreso no encontrada' }, 404);
    }

    // Atomically reassign any existing expenses using this category to 'other' and delete
    await prisma.$transaction(async (tx) => {
      await tx.expense.updateMany({
        where: {
          OR: [
            { category: existing.name },
            { category: existing.id },
          ],
        },
        data: { category: 'other' },
      });

      await tx.expenseCategory.delete({ where: { id } });
    });

    return c.json({ success: true, message: 'Categoría de egreso eliminada correctamente' });
  } catch (error: any) {
    return c.json({ error: error.message || 'Error al eliminar la categoría de egreso' }, 500);
  }
});

// -----------------------------------------------------------------------------
// Registro y Consulta de Egresos
// -----------------------------------------------------------------------------

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

const expenseSchema = z.object({
  description: z.string().min(1, 'La descripción del gasto es obligatoria'),
  amount: z.union([z.number(), z.string()])
    .transform((val) => typeof val === 'string' ? parseFloat(val) : val)
    .refine((num) => !isNaN(num) && num > 0, { message: 'El monto del gasto debe ser mayor a cero' }),
  category: z.string().min(1, 'Categoría de gasto inválida').default('supplies'),
  department: z.enum(['MARKET', 'CAFE', 'GENERAL'], {
    message: 'Departamento inválido'
  }),
  userId: z.string().nullable().optional(),
  items: z.array(z.object({
    productId: z.string().min(1, 'ID de producto inválido'),
    quantity: z.union([z.number(), z.string()])
      .transform((val) => typeof val === 'string' ? parseInt(val) : val)
      .refine((int) => !isNaN(int) && int > 0, { message: 'La cantidad debe ser mayor a cero' }),
    unitCost: z.union([z.number(), z.string()])
      .transform((val) => typeof val === 'string' ? parseFloat(val) : val)
      .refine((num) => !isNaN(num) && num > 0, { message: 'El costo unitario debe ser mayor a cero' }),
  })).optional()
});

expenses.post('/', zValidator('json', expenseSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: result.error.issues[0].message }, 400);
  }
}), async (c) => {
  try {
    const { description, amount, category, department, userId, items } = c.req.valid('json');

    const trimmedCategory = category.trim();

    // Validate category against system and custom categories
    const isDefault = DEFAULT_EXPENSE_CATEGORIES.some(
      (dc) => dc.id.toLowerCase() === trimmedCategory.toLowerCase() || dc.name.toLowerCase() === trimmedCategory.toLowerCase()
    );

    let resolvedCategory = trimmedCategory;
    if (isDefault) {
      const matched = DEFAULT_EXPENSE_CATEGORIES.find(
        (dc) => dc.id.toLowerCase() === trimmedCategory.toLowerCase() || dc.name.toLowerCase() === trimmedCategory.toLowerCase()
      );
      resolvedCategory = matched?.id || trimmedCategory;
    } else {
      const allCustom = await prisma.expenseCategory.findMany();
      const custom = allCustom.find(
        (cc) => cc.id === trimmedCategory || cc.name.toLowerCase() === trimmedCategory.toLowerCase()
      );
      if (!custom) {
        return c.json({ error: 'Categoría de gasto inválida' }, 400);
      }
      resolvedCategory = custom.name;
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Expense
      const expense = await tx.expense.create({
        data: {
          description,
          amount,
          category: resolvedCategory,
          department,
          userId,
          items: items && items.length ? {
            create: items.map((item: any) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitCost: item.unitCost,
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
              stock: { increment: item.quantity },
              cost: item.unitCost,
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
