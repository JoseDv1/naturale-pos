import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { sign, verify } from 'hono/jwt';
import { prisma } from '../db';
import { JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE } from '../middleware/auth';

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

    // Calculate claims
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 8 * 60 * 60; // 8 hours in seconds

    const payload = {
      sub: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE,
      iat: now,
      nbf: now,
      exp: exp,
    };

    const token = await sign(payload, JWT_SECRET);

    // Set secure HttpOnly cookie expiring in 8 hours
    setCookie(c, 'jwt_auth', token, {
      path: '/',
      maxAge: 8 * 60 * 60, // 8 hours
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
    });

    return c.json({ user: userData });
  } catch (error) {
    return c.json({ error: 'Error en el servidor al autenticar' }, 500);
  }
});

auth.get('/me', async (c) => {
  const token = getCookie(c, 'jwt_auth');
  if (!token) {
    return c.json({ user: null });
  }
  try {
    const payload = await verify(token, JWT_SECRET, 'HS256');
    if (payload.iss !== JWT_ISSUER || payload.aud !== JWT_AUDIENCE) {
      return c.json({ user: null });
    }
    return c.json({
      user: {
        id: payload.sub,
        username: payload.username,
        name: payload.name,
        role: payload.role,
      }
    });
  } catch (error) {
    return c.json({ user: null });
  }
});

auth.post('/logout', (c) => {
  deleteCookie(c, 'jwt_auth', { path: '/' });
  return c.json({ success: true });
});

export default auth;
