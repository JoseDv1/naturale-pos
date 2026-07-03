import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { prisma } from '../db';

const auth = new Hono();

auth.post('/login', async (c) => {
  try {
    const { username, pin } = await c.req.json();
    if (!username || !pin) {
      return c.json({ error: 'Usuario y PIN son requeridos' }, 400);
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || !user.active) {
      return c.json({ error: 'Usuario no encontrado o inactivo' }, 401);
    }

    // Verify PIN using Bun's built-in password verify
    const isValid = await Bun.password.verify(pin, user.passwordHash);
    if (!isValid) {
      return c.json({ error: 'PIN incorrecto' }, 401);
    }

    const userData = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    };

    // Set session cookie expiring in 30 days
    setCookie(c, 'user_session', JSON.stringify(userData), {
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    });

    return c.json({ user: userData });
  } catch (error) {
    return c.json({ error: 'Error en el servidor al autenticar' }, 500);
  }
});

auth.get('/me', (c) => {
  const session = getCookie(c, 'user_session');
  if (!session) {
    return c.json({ user: null });
  }
  try {
    return c.json({ user: JSON.parse(session) });
  } catch (error) {
    return c.json({ user: null });
  }
});

auth.post('/logout', (c) => {
  deleteCookie(c, 'user_session', { path: '/' });
  return c.json({ success: true });
});

export default auth;
