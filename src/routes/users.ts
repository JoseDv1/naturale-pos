import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { prisma } from '../db';
import { adminMiddleware } from '../middleware/auth';

const users = new Hono();

const userSchema = z.object({
  username: z.string().min(1, 'El nombre de usuario es obligatorio'),
  name: z.string().min(1, 'El nombre es obligatorio'),
  pin: z.string().min(1, 'El PIN es obligatorio'),
  role: z.enum(['ADMIN', 'CASHIER'], {
    message: 'El rol debe ser ADMIN o CASHIER'
  }),
});

users.get('/', async (c) => {
  const list = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, username: true, name: true, role: true },
  });
  return c.json(list);
});

users.post('/', adminMiddleware, zValidator('json', userSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: result.error.issues[0].message }, 400);
  }
}), async (c) => {
  try {
    const { username, name, pin, role } = c.req.valid('json');

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
