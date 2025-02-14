import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@/lib/zValidator';
import { createProduct, getProductById, getProducts, updateProduct, deleteProduct } from './productsServices';

const productSchema = z.object({
	name: z.string(),
	description: z.string().optional(),
	price: z.number(),
	categoryId: z.number(),
});

const paramSchema = z.object({ id: z.string() });

export const productRouter = new Hono()
	.get('/',
		async (c) => {
			const products = await getProducts();
			return c.json(products);
		})
	.get('/:id',
		zValidator('param', paramSchema),
		async (c) => {
			const { id } = c.req.valid("param")
			const product = await getProductById(id);
			return c.json(product);
		})

	.post('/',
		zValidator('json', productSchema),
		async (c) => {
			const data = await c.req.valid('json');
			const product = await createProduct(data);
			return c.json(product);
		})
	.put('/:id',
		zValidator('param', paramSchema),
		zValidator('json', productSchema.partial()),
		async (c) => {
			const { id } = c.req.valid("param")
			const data = await c.req.valid('json');
			const product = await updateProduct(id, data);
			return c.json(product);
		})
	.delete('/:id',
		zValidator('param', paramSchema),
		async (c) => {
			const { id } = c.req.valid("param")
			await deleteProduct(id);
			return c.json({ message: 'Product deleted' });
		});
