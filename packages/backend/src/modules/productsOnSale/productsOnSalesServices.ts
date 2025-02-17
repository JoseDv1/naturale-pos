import { db } from '@/lib/prisma';

interface ProductsOnSale {
	saleId: number;
	productId: string;
	quantity: number;
	unitPrice: number;
}

export async function addProductOnSale(saleId: number, productId: string, data: Omit<ProductsOnSale, 'saleId' | 'productId' | 'unitPrice'>) {
	const { price: defaultPrice } = await db.product.findUniqueOrThrow({
		where: { id: productId }
	})
	return await db.sale.update({
		where: { id: saleId },
		data: {
			products: {
				upsert: {
					where: { saleId_productId: { saleId, productId } },
					create: {
						quantity: data.quantity,
						price: defaultPrice,
						productId,
					},
					update: {
						quantity: {
							increment: data.quantity
						},
					}
				},
				update: {
					where: {
						saleId_productId: { saleId, productId }
					},
					data: {
						product: {
							update: {
								stock: {
									decrement: data.quantity
								}
							}
						}
					}
				}
			},
			total: {
				increment: data.quantity * defaultPrice
			},
		},
		include: {
			user: true,
			products: {
				include: {
					product: true
				}
			}
		}
	})
}

export async function removeProductOnSale(saleId: number, productId: string) {
	const productOnSale = await db.productOnSale.findUniqueOrThrow({
		where: { saleId_productId: { saleId, productId } }
	})

	return await db.sale.update({
		where: { id: saleId },
		data: {
			total: {
				decrement: productOnSale.quantity * productOnSale.price
			},
			products: {
				update: {
					where: {
						saleId_productId: { saleId, productId }
					},
					data: {
						product: {
							update: {
								stock: {
									increment: productOnSale.quantity
								}
							}
						}
					}
				},
				delete: {
					saleId_productId: { saleId, productId }
				},
			},

		},
		include: {
			user: true,
			products: {
				include: {
					product: true
				}
			}
		}
	})

}

export async function updateProductOnSale(saleId: number, productId: string, data: Omit<ProductsOnSale, 'saleId' | 'productId'>) {
	const oldStateProductOnSale = await db.productOnSale.findUniqueOrThrow({ where: { saleId_productId: { saleId, productId } } })
	const newTotalCost = (data.unitPrice * data.quantity) - (oldStateProductOnSale.price * oldStateProductOnSale.quantity)
	const newStock = oldStateProductOnSale.quantity - data.quantity

	return await db.sale.update({
		where: { id: saleId },
		data: {
			total: {
				increment: newTotalCost
			},
			products: {
				update: {
					where: { saleId_productId: { saleId, productId } },
					data: {
						quantity: data.quantity,
						price: data.unitPrice,
						product: {
							update: {
								stock: {
									increment: newStock
								}
							}
						}
					}
				}
			}
		},
		include: {
			user: true,
			products: {
				include: {
					product: true
				}
			}
		}
	})
}