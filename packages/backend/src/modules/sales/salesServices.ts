import { db } from '@/lib/prisma';
import { $Enums, Prisma } from '@prisma/client';



export async function createSale(userId: string) {
	return await db.sale.create({
		data: {
			userId
		},
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

export async function getSales(date: Date) {
	const reqDate = new Date(date)
	const endOfDay = new Date(date).setDate(reqDate.getDate() + 1)

	return await db.sale.findMany({
		where: {
			date: {
				gte: new Date(reqDate),
				lte: new Date(endOfDay)
			}
		},
		include: {
			user: true,
			products: {
				include: {
					product: true,
				}
			}
		},
		orderBy: {
			date: 'desc'
		}
	});

}

export async function deleteSale(id: number) {

	const oldSaleState = await db.sale.findUniqueOrThrow({
		where: {
			id: id
		},
		include: {
			user: true,
			products: {
				include: {
					product: true
				}
			}
		},
	});

	const productData = oldSaleState.products.map((saleProduct) => {
		const { productId, quantity } = saleProduct;

		return {
			productId,
			quantity
		}
	});

	const updatedProductsPromises = productData.map((product) => {
		return db.product.update({
			where: {
				id: product.productId
			},
			data: {
				stock: {
					increment: product.quantity
				}
			}
		})
	})

	const transactionsResult = await db.$transaction([
		// Return stock to products
		...updatedProductsPromises,
		db.sale.delete({
			where: {
				id: id
			}
		})
	])

	return transactionsResult[transactionsResult.length - 1];

}

export async function updateSale(id: number, data: Prisma.SaleUpdateInput) {
	return await db.sale.update({
		where: { id },
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


export async function getSalesReport(from: string, to: string) {
	const toDate = new Date(to).setDate(new Date(to).getDate() + 1)
	return await db.sale.findMany({
		where: {
			date: {
				gte: new Date(from),
				lte: new Date(toDate)
			}
		},
		include: {
			products: {
				include: {
					product: true,
				}
			}
		},
		orderBy: {
			date: 'desc'
		}
	});
}