import { runAutoMigrations } from './migrator';
import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import api from './api';

import { existsSync, mkdirSync } from 'fs';

// 1. Run migrations and ensure database is ready
await runAutoMigrations();

// Ensure uploads folder exists
if (!existsSync('./uploads')) {
  mkdirSync('./uploads', { recursive: true });
}

const app = new Hono();

// Mount all API endpoints under /api
app.route('/api', api);

// Serve uploaded user media
app.use('/uploads/*', serveStatic({ root: './' }));

// Serve frontend static assets
app.use('*', serveStatic({ root: './frontend/dist' }));

// For Single Page Application (SPA) routing, fallback to index.html
app.get('*', serveStatic({ path: './frontend/dist/index.html' }));

const port = Number(process.env.PORT) || 3001;
console.log(`🚀 Naturale POS server is running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch
};
