import { db } from '@/lib/prisma';

interface SaleData {
	total: number;
	userId?: string;
}

export async function createSale(data: SaleData) {
	return await db.sale.create({
		data,
	});
}

export async function getSaleById(id: number) {
	return await db.sale.findUniqueOrThrow({
		where: { id },
	});
}

export async function getSales() {
	return await db.sale.findMany();
}

export async function deleteSale(id: number) {
	return await db.sale.delete({
		where: { id },
	});
}
