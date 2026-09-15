import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { prisma } from '../db';
import { adminMiddleware } from '../middleware/auth';

const products = new Hono();

const variantSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'El nombre de la variante es obligatorio'),
  sku: z.string().nullable().optional(),
  price: z.union([z.number(), z.string()])
    .transform((val) => typeof val === 'string' ? parseFloat(val) : val)
    .refine((num) => !isNaN(num) && num >= 0, { message: 'El precio de la variante debe ser mayor o igual a cero' }),
  cost: z.union([z.number(), z.string()])
    .transform((val) => typeof val === 'string' ? parseFloat(val) : val)
    .refine((num) => !isNaN(num) && num >= 0, { message: 'El costo de la variante debe ser mayor o igual a cero' })
    .optional().default(0),
  stock: z.union([z.number(), z.string()])
    .transform((val) => typeof val === 'string' ? parseInt(val) : val)
    .refine((int) => !isNaN(int) && int >= 0, { message: 'El stock de la variante debe ser un entero no negativo' })
    .optional().default(0),
});

const productCreateSchema = z.object({
  sku: z.string().optional(),
  name: z.string().min(1, 'El nombre es obligatorio'),
  description: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
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
  variants: z.array(variantSchema).optional(),
});

const productUpdateSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').optional(),
  description: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  price: z.union([z.number(), z.string()])
    .transform((val) => typeof val === 'string' ? parseFloat(val) : val)
    .refine((num) => !isNaN(num) && num >= 0, { message: 'El precio debe ser un número válido mayor o igual a cero' })
    .optional(),
  cost: z.union([z.number(), z.string()])
    .transform((val) => typeof val === 'string' ? parseFloat(val) : val)
    .refine((num) => !isNaN(num) && num >= 0, { message: 'El costo debe ser un número válido mayor o igual a cero' })
    .optional(),
  stock: z.union([z.number(), z.string()])
    .transform((val) => typeof val === 'string' ? parseInt(val) : val)
    .refine((int) => !isNaN(int) && int >= 0, { message: 'El stock debe ser un entero no negativo' })
    .optional(),
  categoryId: z.string().min(1, 'La categoría es obligatoria').optional(),
  department: z.enum(['MARKET', 'CAFE', 'GENERAL'], {
    message: 'Departamento inválido (debe ser MARKET, CAFE o GENERAL)'
  }).optional(),
  isRawMaterial: z.boolean().optional(),
  variants: z.array(variantSchema).optional(),
});

products.get('/', async (c) => {
  const dept = c.req.query('department');
  const raw = c.req.query('isRawMaterial');

  const where: any = { active: true };
  if (dept) where.department = dept;
  if (raw) where.isRawMaterial = raw === 'true';

  const list = await prisma.product.findMany({
    where,
    include: {
      category: true,
      variants: {
        where: { active: true },
        orderBy: { price: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });
  return c.json(list);
});

products.get('/:id', async (c) => {
  const id = c.req.param('id');
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      variants: {
        where: { active: true },
        orderBy: { price: 'asc' },
      },
    },
  });
  if (!product) return c.json({ error: 'Producto no encontrado' }, 404);
  return c.json(product);
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
    const { sku, name, description, imageUrl, price, cost, stock, categoryId, department, isRawMaterial, variants } = c.req.valid('json');

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

    // Validate variant SKUs if provided
    if (variants && variants.length > 0) {
      const variantSkus = variants.map(v => v.sku?.trim()).filter(Boolean);
      const uniqueSkus = new Set(variantSkus);
      if (uniqueSkus.size !== variantSkus.length) {
        return c.json({ error: 'Existen códigos SKU duplicados entre las variantes' }, 400);
      }
      for (const vSku of variantSkus) {
        if (vSku === finalSku) {
          return c.json({ error: `El SKU "${vSku}" de la variante coincide con el SKU del producto principal` }, 400);
        }
        const existingProd = await prisma.product.findUnique({ where: { sku: vSku } });
        const existingVar = await prisma.productVariant.findUnique({ where: { sku: vSku } });
        if (existingProd || existingVar) {
          return c.json({ error: `El SKU "${vSku}" ya está en uso por otro producto o variante` }, 400);
        }
      }
    }

    const calculatedStock = (variants && variants.length > 0)
      ? variants.reduce((acc, v) => acc + (v.stock ?? 0), 0)
      : stock;

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          sku: finalSku,
          name,
          description,
          imageUrl: imageUrl || null,
          price,
          cost,
          stock: calculatedStock,
          categoryId,
          department,
          isRawMaterial: !!isRawMaterial,
          variants: (variants && variants.length > 0) ? {
            create: variants.map(v => ({
              name: v.name,
              sku: v.sku?.trim() || null,
              price: v.price,
              cost: v.cost ?? 0,
              stock: v.stock ?? 0,
              active: true,
            })),
          } : undefined,
        },
        include: {
          category: true,
          variants: {
            where: { active: true },
            orderBy: { price: 'asc' },
          },
        },
      });
      return created;
    });

    return c.json(product);
  } catch (error: any) {
    return c.json({ error: error.message || 'Error al crear el producto' }, 500);
  }
});

products.put('/:id', adminMiddleware, zValidator('json', productUpdateSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: result.error.issues[0].message }, 400);
  }
}), async (c) => {
  try {
    const id = c.req.param('id');
    const existing = await prisma.product.findUnique({
      where: { id },
      include: { variants: true }
    });
    if (!existing) {
      return c.json({ error: 'Producto no encontrado' }, 404);
    }

    const { name, description, imageUrl, price, cost, stock, categoryId, department, isRawMaterial, variants } = c.req.valid('json');

    if (categoryId) {
      const catExists = await prisma.category.findUnique({ where: { id: categoryId } });
      if (!catExists) {
        return c.json({ error: 'La categoría especificada no existe' }, 400);
      }
    }

    // Validate variant SKUs if provided
    if (variants && variants.length > 0) {
      const variantSkus = variants.map(v => v.sku?.trim()).filter(Boolean) as string[];
      const uniqueSkus = new Set(variantSkus);
      if (uniqueSkus.size !== variantSkus.length) {
        return c.json({ error: 'Existen códigos SKU duplicados entre las variantes' }, 400);
      }
      for (const v of variants) {
        const vSku = v.sku?.trim();
        if (!vSku) continue;
        if (vSku === existing.sku) {
          return c.json({ error: `El SKU "${vSku}" de la variante coincide con el SKU del producto principal` }, 400);
        }
        const existingProd = await prisma.product.findUnique({ where: { sku: vSku } });
        if (existingProd && existingProd.id !== id) {
          return c.json({ error: `El SKU "${vSku}" ya está en uso por otro producto o variante` }, 400);
        }
        const existingVar = await prisma.productVariant.findUnique({ where: { sku: vSku } });
        if (existingVar && existingVar.id !== v.id) {
          return c.json({ error: `El SKU "${vSku}" ya está en uso por otro producto o variante` }, 400);
        }
      }
    }

    const product = await prisma.$transaction(async (tx) => {
      // Handle variants update if passed
      if (Array.isArray(variants)) {
        const incomingIds = new Set(variants.filter((v: any) => v.id).map((v: any) => v.id));

        // Deactivate variants not present in incoming list
        for (const ev of existing.variants) {
          if (ev.active && !incomingIds.has(ev.id)) {
            await tx.productVariant.update({
              where: { id: ev.id },
              data: { active: false },
            });
          }
        }

        // Upsert incoming variants
        for (const v of variants) {
          const vPrice = v.price;
          const vCost = v.cost ?? 0;
          const vStock = v.stock ?? 0;
          const vSku = v.sku?.trim() || null;

          if (v.id) {
            await tx.productVariant.update({
              where: { id: v.id },
              data: {
                name: v.name,
                sku: vSku,
                price: vPrice,
                cost: vCost,
                stock: vStock,
                active: true,
              },
            });
          } else {
            await tx.productVariant.create({
              data: {
                productId: id,
                name: v.name,
                sku: vSku,
                price: vPrice,
                cost: vCost,
                stock: vStock,
                active: true,
              },
            });
          }
        }
      }

      // If variants are present, sync base product stock from variants
      let finalStock = stock;
      if (Array.isArray(variants) && variants.length > 0) {
        finalStock = variants.reduce((sum: number, v: any) => sum + (v.stock ?? 0), 0);
      }

      const updated = await tx.product.update({
        where: { id },
        data: {
          name,
          description,
          imageUrl: imageUrl !== undefined ? (imageUrl || null) : undefined,
          price,
          cost,
          stock: finalStock,
          categoryId,
          department,
          isRawMaterial: isRawMaterial !== undefined ? !!isRawMaterial : undefined,
        },
        include: {
          category: true,
          variants: {
            where: { active: true },
            orderBy: { price: 'asc' },
          },
        },
      });

      return updated;
    });

    return c.json(product);
  } catch (error: any) {
    return c.json({ error: error.message || 'Error al actualizar el producto' }, 500);
  }
});

products.delete('/:id', adminMiddleware, async (c) => {
  try {
    const id = c.req.param('id');
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return c.json({ error: 'Producto no encontrado' }, 404);
    }

    const product = await prisma.$transaction(async (tx) => {
      await tx.productVariant.updateMany({
        where: { productId: id },
        data: { active: false },
      });

      return tx.product.update({
        where: { id },
        data: { active: false },
      });
    });

    return c.json({ success: true, message: 'Producto y variantes desactivados', product });
  } catch (error) {
    return c.json({ error: 'Error al desactivar el producto' }, 500);
  }
});

export default products;
