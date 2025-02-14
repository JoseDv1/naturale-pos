import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@/lib/zValidator';
import { createSale, getSaleById, getSales, deleteSale } from './salesServices';

const saleSchema = z.object({
	total: z.number(),
	userId: z.string().optional(),
});

const paramSchema = z.object({ id: z.string().regex(/^\d+$/).transform(Number) });

export const saleRouter = new Hono()
	.get('/',
		async (c) => {
			const sales = await getSales();
			return c.json(sales);
		})
	.get('/:id',
		zValidator('param', paramSchema),
		async (c) => {
			const { id } = c.req.valid('param');
			const sale = await getSaleById(id);
			return c.json(sale);
		})
	.post('/',
		zValidator('json', saleSchema),
		async (c) => {
			const data = c.req.valid('json');
			const sale = await createSale(data);
			return c.json(sale);
		})
	.delete('/:id',
		zValidator('param', paramSchema),
		async (c) => {
			const { id } = c.req.valid('param');
			await deleteSale(id);
			return c.json({ message: 'Sale deleted' });
		});
