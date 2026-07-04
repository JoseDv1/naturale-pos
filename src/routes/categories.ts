import { Hono } from 'hono';
import { prisma } from '../db';
import { adminMiddleware } from '../middleware/auth';

const categories = new Hono();

categories.get('/', async (c) => {
  const list = await prisma.category.findMany({
    orderBy: { name: 'asc' },
  });
  return c.json(list);
});

categories.post('/', adminMiddleware, async (c) => {
  try {
    const { name, description } = await c.req.json();
    if (!name) return c.json({ error: 'Nombre es requerido' }, 400);

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

export default categories;
