import { db } from '@/lib/prisma';

interface ProductsOnSupply {
	supplyId: number;
	productId: string;
	quantity: number;
	unitPrice: number;
}

export async function addProductOnSupply(supplyId: number, productId: string, data: Omit<ProductsOnSupply, 'supplyId' | 'productId'>) {
	return await db.supply.update({
		where: { id: supplyId },
		data: {
			supplyProducts: {
				upsert: {
					where: { supplyId_productId: { supplyId, productId } },
					create: {
						quantity: data.quantity,
						price: data.unitPrice,
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
						supplyId_productId: { supplyId, productId }
					},
					data: {
						product: {
							update: {
								stock: {
									increment: data.quantity
								}
							}
						}
					}
				}
			},
			total: {
				increment: data.quantity * data.unitPrice
			},
		},
		include: {
			provider: true,
			supplyProducts: {
				include: {
					product: true
				}
			}
		}
	})
}

export async function removeProductOnSupply(supplyId: number, productId: string) {
	const productOnSupply = await db.productOnSupply.findUniqueOrThrow({
		where: { supplyId_productId: { supplyId, productId } }
	})

	return await db.supply.update({
		where: { id: supplyId },
		data: {
			total: {
				decrement: productOnSupply.quantity * productOnSupply.price
			},
			supplyProducts: {
				update: {
					where: {
						supplyId_productId: { supplyId, productId }
					},
					data: {
						product: {
							update: {
								stock: {
									decrement: productOnSupply.quantity
								}
							}
						}
					}
				},
				delete: {
					supplyId_productId: { supplyId, productId }
				},
			},

		},
		include: {
			provider: true,
			supplyProducts: {
				include: {
					product: true
				}
			}
		}
	})

}

export async function updateProductOnSupply(supplyId: number, productId: string, data: Omit<ProductsOnSupply, 'supplyId' | 'productId'>) {
	const oldStateProductOnSupply = await db.productOnSupply.findUniqueOrThrow({ where: { supplyId_productId: { supplyId, productId } } })
	const newTotalCost = (data.unitPrice * data.quantity) - (oldStateProductOnSupply.price * oldStateProductOnSupply.quantity)
	const newStock = oldStateProductOnSupply.quantity - data.quantity

	return await db.supply.update({
		where: { id: supplyId },
		data: {
			total: {
				increment: newTotalCost
			},
			supplyProducts: {
				update: {
					where: { supplyId_productId: { supplyId, productId } },
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
			provider: true,
			supplyProducts: {
				include: {
					product: true
				}
			}
		}
	})
}
