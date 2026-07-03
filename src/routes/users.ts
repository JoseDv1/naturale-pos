import { Hono } from 'hono';
import { prisma } from '../db';

const users = new Hono();

users.get('/', async (c) => {
  const list = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, username: true, name: true, role: true },
  });
  return c.json(list);
});

users.post('/', async (c) => {
  try {
    const { username, name, pin, role } = await c.req.json();
    if (!username || !name || !pin || !role) {
      return c.json({ error: 'Todos los campos son obligatorios' }, 400);
    }

    const exists = await prisma.user.findUnique({ where: { username } });
    if (exists) {
      return c.json({ error: 'El nombre de usuario ya existe' }, 400);
    }

    const hash = await Bun.password.hash(pin);
    const user = await prisma.user.create({
      data: {
        username,
        name,
        passwordHash: hash,
        role,
      },
    });

    return c.json({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    });
  } catch (error) {
    return c.json({ error: 'Error al crear el usuario' }, 500);
  }
});

export default users;
