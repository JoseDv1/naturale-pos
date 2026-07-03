import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import api from './api';

const app = new Hono();

// Mount all API endpoints under /api
app.route('/api', api);

// Serve frontend static assets
app.use('*', serveStatic({ root: './frontend/dist' }));

// For Single Page Application (SPA) routing, fallback to index.html
app.get('*', serveStatic({ path: './frontend/dist/index.html' }));

const port = process.env.PORT || 3000;
console.log(`Server is running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch
};
