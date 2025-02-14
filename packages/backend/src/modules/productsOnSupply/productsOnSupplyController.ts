import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@/lib/zValidator';
import { addProductOnSupply, removeProductOnSupply, updateProductOnSupply } from './productsOnSupplyServices';

const productOnSupplySchema = z.object({
	quantity: z.number(),
	unitPrice: z.number(),
});

const paramSchema = z.object({
	supplyId: z.string().regex(/^\d+$/).transform(Number),
	productId: z.string(),
});

export const productOnSupplyRouter = new Hono()
	.post('/:productId',
		zValidator('param', paramSchema),
		zValidator('json', productOnSupplySchema),
		async (c) => {
			const { supplyId, productId } = c.req.valid('param');
			const data = c.req.valid('json');
			const productOnSupply = await addProductOnSupply(supplyId, productId, data);
			return c.json(productOnSupply);
		}
	)
	.delete('/:productId',
		zValidator('param', paramSchema),
		async (c) => {
			const { supplyId, productId } = c.req.valid('param');
			await removeProductOnSupply(supplyId, productId);
			return c.json({ message: 'Product removed from supply' });
		}
	)
	.put('/:productId',
		zValidator('param', paramSchema),
		zValidator('json', productOnSupplySchema),
		async (c) => {
			const { supplyId, productId } = c.req.valid('param');
			const data = c.req.valid('json');
			const productOnSupply = await updateProductOnSupply(supplyId, productId, data);
			return c.json(productOnSupply);
		}
	);
