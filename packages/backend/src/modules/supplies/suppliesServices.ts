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

export async function getSupplies() {
	return await db.supply.findMany({
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
