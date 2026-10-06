import { serve } from 'bun';
import { join } from 'path';
import { existsSync } from 'fs';

const PORT = Number(process.env.PORT) || 3000;
const CATALOG_DIR = join(process.cwd(), 'catalogo-web');

const server = serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/' || pathname === '') {
      pathname = '/index.html';
    }
    const filePath = join(CATALOG_DIR, pathname);
    if (existsSync(filePath)) {
      return new Response(Bun.file(filePath));
    }
    return new Response('404 - Archivo no encontrado en catalogo-web', { status: 404 });
  },
});

console.log(`🌿 Catálogo Web de Naturale corriendo en: http://localhost:${server.port}`);
