import { db } from "@/lib/prisma";

interface ProductData {
	name: string;
	description?: string;
	price: number;
	categoryId: number;
	stock: number;
}

export async function createProduct(data: ProductData) {
	return await db.product.create({
		data,
		include: {
			category: true,
		}
	});
}

export async function getProductById(id: string) {
	return await db.product.findUniqueOrThrow({
		where: { id },
		include: {
			category: true,
		}
	});
}

export async function getProducts() {
	return await db.product.findMany({
		include: {
			category: true,
		}
	});
}

export async function updateProduct(id: string, data: Partial<ProductData>) {
	return await db.product.update({
		where: { id },
		data,
		include: {
			category: true,
		}
	});
}

export async function deleteProduct(id: string) {
	return await db.product.delete({
		where: { id },
	});
}
