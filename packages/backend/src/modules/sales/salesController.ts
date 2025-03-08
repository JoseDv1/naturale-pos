import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@/lib/zValidator';
import { createSale, getSaleById, getSales, deleteSale, updateSale, getSalesReport } from './salesServices';
import { $Enums } from '@prisma/client';
import { jwt, JwtPayload } from '@/lib/jwt';


const updateSaleSchema = z.object({
	paymentMethod: z.nativeEnum($Enums.PAYMENT_METHOD),
})

const paramSchema = z.object({ id: z.string().regex(/^\d+$/).transform(Number) });
const querySchema = z.object({
	date:
		z.string().transform(
			(value) => {
				const date = new Date(value);
				if (isNaN(date.getTime())) throw new Error('Invalid date');
				return date
			})
})

export const saleRouter = new Hono()
	.use(jwt())
	.get('/',
		zValidator('query', querySchema),
		async (c) => {
			const { date } = c.req.valid('query');
			const sales = await getSales(date);
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
		async (c) => {
			const { sub: userId }: JwtPayload = c.get("jwtPayload")
			const sale = await createSale(userId);
			return c.json(sale);
		})
	.delete('/:id',
		zValidator('param', paramSchema),
		async (c) => {
			const { id } = c.req.valid('param');
			const removeSale = await deleteSale(id);
			return c.json(removeSale);
		})
	.put('/:id',
		zValidator('param', paramSchema),
		zValidator('json', updateSaleSchema),
		async (c) => {
			const { id } = c.req.valid('param');
			const data = c.req.valid('json');
			const sale = await updateSale(id, data);
			return c.json(sale);
		})

