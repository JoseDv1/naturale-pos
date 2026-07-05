import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { verify } from 'hono/jwt';

export const JWT_SECRET = process.env.JWT_SECRET || 'naturale_pos_secret_key_change_me_in_prod';
export const JWT_ISSUER = 'naturale-pos-api';
export const JWT_AUDIENCE = 'naturale-pos-app';

export const authMiddleware = createMiddleware(async (c, next) => {
  const path = c.req.path;
  const token = getCookie(c, 'jwt_auth');
  console.log(`[authMiddleware] Path: ${path}, Token exists: ${!!token}`);
  if (!token) {
    console.log(`[authMiddleware] Token not found for path: ${path}`);
    return c.json({ error: 'No autorizado: Sesión no encontrada' }, 401);
  }

  try {
    const payload = await verify(token, JWT_SECRET, 'HS256');

    // Verify standard claims
    if (payload.iss !== JWT_ISSUER || payload.aud !== JWT_AUDIENCE) {
      console.log(`[authMiddleware] Invalid claims for path: ${path}. iss: ${payload.iss}, aud: ${payload.aud}`);
      return c.json({ error: 'No autorizado: Token inválido (Emisor/Audiencia)' }, 401);
    }

    // Set the user in the context variables
    c.set('user', {
      id: payload.sub as string,
      username: payload.username as string,
      name: payload.name as string,
      role: payload.role as string,
    });

    return await next();
  } catch (error) {
    console.error(`[authMiddleware] Verification failed for path: ${path}. Error:`, error);
    return c.json({ error: 'No autorizado: Sesión inválida o expirada' }, 401);
  }
});

export const adminMiddleware = createMiddleware(async (c, next) => {
  const user = c.get('user');
  if (!user || user.role !== 'ADMIN') {
    return c.json({ error: 'Acceso denegado: Se requieren permisos de Administrador' }, 403);
  }
  return await next();
});
