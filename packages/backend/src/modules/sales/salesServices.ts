import { db } from '@/lib/prisma';

interface SaleData {
	total: number;
	userId?: string;
}

export async function createSale(data: SaleData) {
	return await db.sale.create({
		data,
		include: {
			user: true,
			products: {
				include: {
					product: true,
				}
			}

		}
	});
}

export async function getSaleById(id: number) {
	return await db.sale.findUniqueOrThrow({
		where: { id },
		include: {
			user: true,
			products: {
				include: {
					product: true,
				}
			}

		}
	});
}

export async function getSales() {
	return await db.sale.findMany({
		include: {
			user: true,
			products: {
				include: {
					product: true,
				}
			}

		}
	});

}

export async function deleteSale(id: number) {
	return await db.sale.delete({
		where: { id },
		include: {
			user: true,
			products: {
				include: {
					product: true,
				}
			}

		}
	});
}
