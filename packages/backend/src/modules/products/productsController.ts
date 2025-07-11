import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@/lib/zValidator';
import { createProduct, getProductById, getProducts, updateProduct, deleteProduct } from './productsServices';
import { jwt, jwtGuard } from '@/lib/jwt';

const productSchema = z.object({
	name: z.string(),
	description: z.string().optional(),
	price: z.number(),
	categoryId: z.number(),
	stock: z.number().default(0), // Assuming stock is a required field with a default value
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
	.use(jwt()) // Manage the JWT token
	.use(jwtGuard('ADMIN')) // Manage the permissions
	.post('/',
		zValidator('json', productSchema),
		async (c) => {
			const data = c.req.valid('json');
			const product = await createProduct(data);
			return c.json(product);
		})
	.put('/:id',
		zValidator('param', paramSchema),
		zValidator('json', productSchema.partial()),
		async (c) => {
			const { id } = c.req.valid("param")
			const data = c.req.valid('json');
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
