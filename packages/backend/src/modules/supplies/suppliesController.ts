import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@/lib/zValidator';
import { createSupply, getSupplyById, getSupplies, deleteSupply } from './suppliesServices';

const supplySchema = z.object({
	providerId: z.string(),
});

const paramSchema = z.object({ id: z.string().regex(/^\d+$/).transform(Number) });

export const supplyRouter = new Hono()
	.get('/',
		async (c) => {
			const supplies = await getSupplies();
			return c.json(supplies);
		})
	.get('/:id',
		zValidator('param', paramSchema),
		async (c) => {
			const { id } = c.req.valid('param');
			const supply = await getSupplyById(id);
			return c.json(supply);
		})
	.post('/',
		zValidator('json', supplySchema),
		async (c) => {
			const { providerId } = c.req.valid('json');
			const supply = await createSupply(providerId);
			return c.json(supply);
		})
	.delete('/:id',
		zValidator('param', paramSchema),
		async (c) => {
			const { id } = c.req.valid('param');
			await deleteSupply(id);
			return c.json({ message: 'Supply deleted' });
		});
