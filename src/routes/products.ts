import { Hono } from 'hono';
import { prisma } from '../db';

const products = new Hono();

products.get('/', async (c) => {
  const dept = c.req.query('department');
  const raw = c.req.query('isRawMaterial');

  const where: any = { active: true };
  if (dept) where.department = dept;
  if (raw) where.isRawMaterial = raw === 'true';

  const list = await prisma.product.findMany({
    where,
    include: { category: true },
    orderBy: { name: 'asc' },
  });
  return c.json(list);
});

// Helper to generate a unique SKU using Bun's native randomUUID
async function generateUniqueSku(): Promise<string> {
  return crypto.randomUUID();
}

products.post('/', async (c) => {
  try {
    const { sku, name, description, price, cost, stock, categoryId, department, isRawMaterial } = await c.req.json();

    if (!name || price === undefined || cost === undefined || !categoryId || !department) {
      return c.json({ error: 'Faltan campos obligatorios' }, 400);
    }

    let finalSku = sku;
    if (!finalSku || finalSku.trim() === '') {
      finalSku = await generateUniqueSku();
    } else {
      const exists = await prisma.product.findUnique({ where: { sku: finalSku } });
      if (exists) return c.json({ error: 'El SKU/código ya existe' }, 400);
    }

    const product = await prisma.product.create({
      data: {
        sku: finalSku,
        name,
        description,
        price: parseFloat(price),
        cost: parseFloat(cost),
        stock: parseInt(stock) || 0,
        categoryId,
        department,
        isRawMaterial: !!isRawMaterial,
      },
    });

    return c.json(product);
  } catch (error) {
    return c.json({ error: 'Error al crear el producto' }, 500);
  }
});

products.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const { name, description, price, cost, stock, categoryId, department, isRawMaterial } = await c.req.json();

    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        description,
        price: price !== undefined ? parseFloat(price) : undefined,
        cost: cost !== undefined ? parseFloat(cost) : undefined,
        stock: stock !== undefined ? parseInt(stock) : undefined,
        categoryId,
        department,
        isRawMaterial: isRawMaterial !== undefined ? !!isRawMaterial : undefined,
      },
    });

    return c.json(product);
  } catch (error) {
    return c.json({ error: 'Error al actualizar el producto' }, 500);
  }
});

products.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const product = await prisma.product.update({
      where: { id },
      data: { active: false },
    });
    return c.json({ success: true, message: 'Producto desactivado', product });
  } catch (error) {
    return c.json({ error: 'Error al desactivar el producto' }, 500);
  }
});

export default products;
