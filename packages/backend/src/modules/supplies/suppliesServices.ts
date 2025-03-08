import { db } from '@/lib/prisma';

export async function createSupply(providerId: string) {
	return await db.supply.create({
		data: {
			providerId
		},
		include: {
			provider: true,
			supplyProducts: {
				include: {
					product: true
				}
			}
		}
	});
}

export async function getSupplyById(id: number) {
	return await db.supply.findUniqueOrThrow({
		where: { id },
		include: {
			provider: true,
			supplyProducts: {
				include: {
					product: true
				}
			}
		}
	});
}

export async function getSupplies(date: Date) {
	const reqDate = new Date(date)
	const endOfDay = new Date(date).setDate(reqDate.getDate() + 1)

	return await db.supply.findMany({
		where: {
			date: {
				gte: new Date(reqDate),
				lte: new Date(endOfDay)
			}
		},
		include: {
			provider: true,
			supplyProducts: {
				include: {
					product: true
				}
			}
		},
		orderBy: {
			date: 'desc'
		}

	});
}

export async function deleteSupply(id: number) {
	const oldSaleState = await db.supply.findUniqueOrThrow({
		where: {
			id: id
		},
		include: {
			provider: true,
			supplyProducts: {
				include: {
					product: true
				}
			}
		},
	});

	const productData = oldSaleState.supplyProducts.map((saleProduct) => {
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
					decrement: product.quantity
				}
			}
		})
	})

	const transactionsResult = await db.$transaction([
		// Return stock to products
		...updatedProductsPromises,
		db.supply.delete({
			where: {
				id
			}
		})
	])

	return transactionsResult[transactionsResult.length - 1];
}

export async function getSuppliesReport(from: string, to: string) {
	const toDate = new Date(to).setDate(new Date(to).getDate() + 1)

	return await db.supply.findMany({
		where: {
			date: {
				gte: new Date(from),
				lte: new Date(toDate)
			}
		},
		include: {
			provider: true,
			supplyProducts: {
				include: {
					product: true
				}
			}
		},
		orderBy: {
			date: 'desc'
		}
	});


}