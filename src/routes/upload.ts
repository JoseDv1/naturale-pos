import { Hono } from 'hono';
import { join, basename } from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { authMiddleware } from '../middleware/auth';

const upload = new Hono();

const UPLOADS_DIR = join(process.cwd(), 'uploads');
if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

upload.post('/', authMiddleware, async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body['image'] || body['file'];

    if (!file || typeof file === 'string') {
      return c.json({ error: 'No se recibió ningún archivo de imagen' }, 400);
    }

    // Validate mime type
    const mimeType = (file as any).type || '';
    const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (!validMimes.includes(mimeType) && !mimeType.startsWith('image/')) {
      return c.json({ error: 'Formato de archivo inválido. Solo se permiten imágenes (JPEG, PNG, WebP, GIF, SVG).' }, 400);
    }

    // Limit size (max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if ((file as any).size > MAX_SIZE) {
      return c.json({ error: 'La imagen excede el tamaño máximo permitido (5MB)' }, 400);
    }

    let ext = 'jpg';
    if (mimeType.includes('png')) ext = 'png';
    else if (mimeType.includes('webp')) ext = 'webp';
    else if (mimeType.includes('gif')) ext = 'gif';
    else if (mimeType.includes('svg')) ext = 'svg';
    else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
    else {
      const parts = (file as any).name ? (file as any).name.split('.') : [];
      if (parts.length > 1) ext = parts.pop()!.toLowerCase();
    }

    const filename = `${crypto.randomUUID()}.${ext}`;
    const filePath = join(UPLOADS_DIR, filename);

    const buffer = await (file as any).arrayBuffer();
    await Bun.write(filePath, buffer);

    const fileUrl = `/uploads/${filename}`;
    return c.json({ success: true, url: fileUrl, filename });
  } catch (error: any) {
    return c.json({ error: error.message || 'Error al subir la imagen' }, 500);
  }
});

upload.delete('/', authMiddleware, async (c) => {
  try {
    const { url } = await c.req.json();
    if (!url || typeof url !== 'string') {
      return c.json({ error: 'URL requerida' }, 400);
    }

    // Only delete files inside /uploads/ to prevent path traversal
    if (url.startsWith('/uploads/')) {
      const safeFilename = basename(url);
      const filePath = join(UPLOADS_DIR, safeFilename);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    }

    return c.json({ success: true, message: 'Imagen eliminada' });
  } catch (error: any) {
    return c.json({ error: error.message || 'Error al eliminar la imagen' }, 500);
  }
});

export default upload;
