import { Hono } from 'hono';
import { prisma } from './db';
import auth from './routes/auth';
import users from './routes/users';
import categories from './routes/categories';
import products from './routes/products';
import sales from './routes/sales';
import expenses from './routes/expenses';
import transfers from './routes/transfers';
import reports from './routes/reports';
import tables from './routes/tables';
import { authMiddleware } from './middleware/auth';

const api = new Hono();

// Health check endpoint
api.get('/status', async (c) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return c.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      status: 'error',
      database: 'disconnected',
      error: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Gatekeeper Middleware to protect all routes except status and auth
api.use('*', async (c, next) => {
  const path = c.req.path;
  if (
    path === '/api/status' || 
    path === '/status' || 
    path.startsWith('/api/auth/') || 
    path.startsWith('/auth/') || 
    path === '/api/auth' || 
    path === '/auth'
  ) {
    await next();
  } else {
    await authMiddleware(c, next);
  }
});

// Mount modular sub-routers
api.route('/auth', auth);
api.route('/users', users);
api.route('/categories', categories);
api.route('/products', products);
api.route('/sales', sales);
api.route('/expenses', expenses);
api.route('/transfers', transfers);
api.route('/reports', reports);
api.route('/tables', tables);

export default api;
export type ApiType = typeof api;
