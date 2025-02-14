import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@/lib/zValidator';
import { createCategory, getCategoryById, getCategories, updateCategory, deleteCategory } from './categoriesServices';
import { jwt, jwtGuard } from '@/lib/jwt';

const categorySchema = z.object({
	name: z.string(),
	description: z.string().optional(),
});

const paramSchema = z.object({ id: z.string().regex(/^\d+$/).transform(Number) });

export const categoryRouter = new Hono()
	.get('/',
		async (c) => {
			const categories = await getCategories();
			return c.json(categories);
		})
	.get('/:id',
		zValidator('param', paramSchema),
		async (c) => {
			const { id } = c.req.valid('param');
			const category = await getCategoryById(id);
			return c.json(category);
		})
	.use(jwt()) // Manage the JWT token
	.use(jwtGuard('ADMIN')) // Manage the permissions
	.post('/',
		zValidator('json', categorySchema),
		async (c) => {
			const data = c.req.valid('json');
			const category = await createCategory(data);
			return c.json(category);
		})
	.put('/:id',
		zValidator('param', paramSchema),
		zValidator('json', categorySchema.partial()),
		async (c) => {
			const { id } = c.req.valid('param');
			const data = c.req.valid('json');
			const category = await updateCategory(id, data);
			return c.json(category);
		})
	.delete('/:id',
		zValidator('param', paramSchema),
		async (c) => {
			const { id } = c.req.valid('param');
			await deleteCategory(id);
			return c.json({ message: 'Category deleted' });
		});
