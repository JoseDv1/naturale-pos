import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@/lib/zValidator';
import { createProvider, getProviderById, getProviders, updateProvider, deleteProvider } from './providersServices';

const providerSchema = z.object({
	name: z.string(),
	address: z.string().optional(),
	phone: z.string().optional(),
	email: z.string().optional(),
});

const paramSchema = z.object({ id: z.string() });

export const providerRouter = new Hono()
	.get('/',
		async (c) => {
			const providers = await getProviders();
			return c.json(providers);
		})
	.get('/:id',
		zValidator('param', paramSchema),
		async (c) => {
			const { id } = c.req.valid('param');
			const provider = await getProviderById(id);
			return c.json(provider);
		})
	.post('/',
		zValidator('json', providerSchema),
		async (c) => {
			const data = c.req.valid('json');
			const provider = await createProvider(data);
			return c.json(provider);
		})
	.put('/:id',
		zValidator('param', paramSchema),
		zValidator('json', providerSchema.partial()),
		async (c) => {
			const { id } = c.req.valid('param');
			const data = c.req.valid('json');
			const provider = await updateProvider(id, data);
			return c.json(provider);
		})
	.delete('/:id',
		zValidator('param', paramSchema),
		async (c) => {
			const { id } = c.req.valid('param');
			await deleteProvider(id);
			return c.json({ message: 'Provider deleted' });
		});
