import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { prisma } from '../db';
import { adminMiddleware } from '../middleware/auth';

const products = new Hono();

const productCreateSchema = z.object({
  sku: z.string().optional(),
  name: z.string().min(1, 'El nombre es obligatorio'),
  description: z.string().nullable().optional(),
  price: z.union([z.number(), z.string()])
    .transform((val) => typeof val === 'string' ? parseFloat(val) : val)
    .refine((num) => !isNaN(num) && num >= 0, { message: 'El precio debe ser un número válido mayor o igual a cero' }),
  cost: z.union([z.number(), z.string()])
    .transform((val) => typeof val === 'string' ? parseFloat(val) : val)
    .refine((num) => !isNaN(num) && num >= 0, { message: 'El costo debe ser un número válido mayor o igual a cero' }),
  stock: z.union([z.number(), z.string()])
    .transform((val) => typeof val === 'string' ? parseInt(val) : val)
    .refine((int) => !isNaN(int) && int >= 0, { message: 'El stock debe ser un entero no negativo' })
    .optional().default(0),
  categoryId: z.string().min(1, 'La categoría es obligatoria'),
  department: z.enum(['MARKET', 'CAFE', 'GENERAL'], {
    message: 'Departamento inválido (debe ser MARKET, CAFE o GENERAL)'
  }),
  isRawMaterial: z.boolean().optional().default(false),
});

products.get('/', async (c) => {
  const dept = c.req.query('department');
  const raw = c.req.query('isRawMaterial');

  const where: any = { active: true };
  if (dept) where.department = dept;
  if (raw) where.isRawMaterial = raw === 'true';

  const list = await prisma.product.findMany({
    where,
    include: { category: true },
    orderBy: { name: 'asc' },
  });
  return c.json(list);
});

// Helper to generate a unique SKU using Bun's native randomUUID
async function generateUniqueSku(): Promise<string> {
  return crypto.randomUUID();
}

products.post('/', adminMiddleware, zValidator('json', productCreateSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: result.error.issues[0].message }, 400);
  }
}), async (c) => {
  try {
    const { sku, name, description, price, cost, stock, categoryId, department, isRawMaterial } = c.req.valid('json');

    const catExists = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!catExists) {
      return c.json({ error: 'La categoría especificada no existe' }, 400);
    }

    let finalSku = sku;
    if (!finalSku || finalSku.trim() === '') {
      finalSku = await generateUniqueSku();
    } else {
      const exists = await prisma.product.findUnique({ where: { sku: finalSku } });
      if (exists) return c.json({ error: 'El SKU/código ya existe' }, 400);
    }

    const product = await prisma.product.create({
      data: {
        sku: finalSku,
        name,
        description,
        price,
        cost,
        stock,
        categoryId,
        department,
        isRawMaterial: !!isRawMaterial,
      },
    });

    return c.json(product);
  } catch (error) {
    return c.json({ error: 'Error al crear el producto' }, 500);
  }
});

products.put('/:id', adminMiddleware, async (c) => {
  try {
    const id = c.req.param('id');
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return c.json({ error: 'Producto no encontrado' }, 404);
    }

    const { name, description, price, cost, stock, categoryId, department, isRawMaterial } = await c.req.json();

    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        description,
        price: price !== undefined ? parseFloat(price) : undefined,
        cost: cost !== undefined ? parseFloat(cost) : undefined,
        stock: stock !== undefined ? parseInt(stock) : undefined,
        categoryId,
        department,
        isRawMaterial: isRawMaterial !== undefined ? !!isRawMaterial : undefined,
      },
    });

    return c.json(product);
  } catch (error) {
    return c.json({ error: 'Error al actualizar el producto' }, 500);
  }
});

products.delete('/:id', adminMiddleware, async (c) => {
  try {
    const id = c.req.param('id');
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return c.json({ error: 'Producto no encontrado' }, 404);
    }

    const product = await prisma.product.update({
      where: { id },
      data: { active: false },
    });
    return c.json({ success: true, message: 'Producto desactivado', product });
  } catch (error) {
    return c.json({ error: 'Error al desactivar el producto' }, 500);
  }
});

export default products;
