import { db } from '@/lib/prisma';

interface CategoryData {
	name: string;
	description?: string;
}

export async function createCategory(data: CategoryData) {
	return await db.category.create({
		data,
	});
}

export async function getCategoryById(id: number) {
	return await db.category.findUniqueOrThrow({
		where: { id },
	});
}

export async function getCategories() {
	return await db.category.findMany();
}

export async function updateCategory(id: number, data: Partial<CategoryData>) {
	return await db.category.update({
		where: { id },
		data,
	});
}

export async function deleteCategory(id: number) {
	return await db.category.delete({
		where: { id },
	});
}
