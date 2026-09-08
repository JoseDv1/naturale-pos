import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { prisma } from '../db';
import { adminMiddleware } from '../middleware/auth';

const categories = new Hono();

const categorySchema = z.object({
  name: z.string().min(1, 'Nombre es requerido'),
  description: z.string().nullable().optional(),
});

categories.get('/', async (c) => {
  const list = await prisma.category.findMany({
    orderBy: { name: 'asc' },
  });
  return c.json(list);
});

categories.post('/', adminMiddleware, zValidator('json', categorySchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: result.error.issues[0].message }, 400);
  }
}), async (c) => {
  try {
    const { name, description } = c.req.valid('json');

    const exists = await prisma.category.findUnique({ where: { name } });
    if (exists) return c.json({ error: 'La categoría ya existe' }, 400);

    const category = await prisma.category.create({
      data: { name, description },
    });
    return c.json(category);
  } catch (error) {
    return c.json({ error: 'Error al crear la categoría' }, 500);
  }
});

categories.put('/:id', zValidator('json', categorySchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: result.error.issues[0].message }, 400);
  }
}), async (c) => {
  try {
    const id = c.req.param('id');
    const { name, description } = c.req.valid('json');

    const currentCategory = await prisma.category.findUnique({ where: { id } });
    if (!currentCategory) {
      return c.json({ error: 'La categoría no existe' }, 404);
    }

    if (currentCategory.name === 'Sin categoría' && name !== 'Sin categoría') {
      return c.json({ error: 'No se puede cambiar el nombre de la categoría por defecto' }, 400);
    }

    const exists = await prisma.category.findFirst({
      where: {
        name,
        id: { not: id }
      }
    });
    if (exists) return c.json({ error: 'La categoría ya existe' }, 400);

    const category = await prisma.category.update({
      where: { id },
      data: { name, description },
    });
    return c.json(category);
  } catch (error) {
    return c.json({ error: 'Error al actualizar la categoría' }, 500);
  }
});

categories.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const categoryToDelete = await prisma.category.findUnique({
      where: { id }
    });

    if (!categoryToDelete) {
      return c.json({ error: 'La categoría no existe' }, 404);
    }

    if (categoryToDelete.name === 'Sin categoría') {
      return c.json({ error: 'No se puede eliminar la categoría por defecto' }, 400);
    }

    await prisma.$transaction(async (tx) => {
      // Get or create the default category
      let defaultCategory = await tx.category.findUnique({
        where: { name: 'Sin categoría' }
      });

      if (!defaultCategory) {
        defaultCategory = await tx.category.create({
          data: {
            name: 'Sin categoría',
            description: 'Categoría por defecto para productos sin categoría asignada'
          }
        });
      }

      // Reassign products to default category
      await tx.product.updateMany({
        where: { categoryId: id },
        data: { categoryId: defaultCategory.id }
      });

      // Delete the category
      await tx.category.delete({
        where: { id }
      });
    });

    return c.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar la categoría:', error);
    return c.json({ error: 'Error al eliminar la categoría' }, 500);
  }
});

export default categories;
