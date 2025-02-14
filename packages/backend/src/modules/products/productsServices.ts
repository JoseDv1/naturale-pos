import { db } from "@/lib/prisma";

interface ProductData {
	name: string;
	description?: string;
	price: number;
	categoryId: number;
}

export async function createProduct(data: ProductData) {
	return await db.product.create({
		data,
	});
}

export async function getProductById(id: string) {
	return await db.product.findUniqueOrThrow({
		where: { id },
	});
}

export async function getProducts() {
	return await db.product.findMany();
}

export async function updateProduct(id: string, data: Partial<ProductData>) {
	return await db.product.update({
		where: { id },
		data,
	});
}

export async function deleteProduct(id: string) {
	return await db.product.delete({
		where: { id },
	});
}
