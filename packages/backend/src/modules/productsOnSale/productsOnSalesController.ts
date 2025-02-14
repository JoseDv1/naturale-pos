import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@/lib/zValidator';
import { addProductOnSale, removeProductOnSale, updateProductOnSale } from './productsOnSalesServices';

const productOnSaleSchema = z.object({
	quantity: z.number(),
	unitPrice: z.number(),
});

const paramSchema = z.object({
	saleId: z.string().regex(/^\d+$/).transform(Number),
	productId: z.string(),
});

export const productOnSaleRouter = new Hono()
	.post('/:productId',
		zValidator('param', paramSchema),
		zValidator('json', productOnSaleSchema),
		async (c) => {
			const { saleId, productId } = c.req.valid('param');
			const data = c.req.valid('json');
			const productOnSale = await addProductOnSale(saleId, productId, data);
			return c.json(productOnSale);
		}
	)
	.delete('/:productId',
		zValidator('param', paramSchema),
		async (c) => {
			const { saleId, productId } = c.req.valid('param');
			await removeProductOnSale(saleId, productId);
			return c.json({ message: 'Product removed from sale' });
		}
	)
	.put('/:productId',
		zValidator('param', paramSchema),
		zValidator('json', productOnSaleSchema),
		async (c) => {
			const { saleId, productId } = c.req.valid('param');
			const data = c.req.valid('json');
			const productOnSale = await updateProductOnSale(saleId, productId, data);
			return c.json(productOnSale);
		}
	);
