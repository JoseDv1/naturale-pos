import { db } from '@/lib/prisma';

interface ProviderData {
	name: string;
	address?: string;
	phone?: string;
	email?: string;
}

export async function createProvider(data: ProviderData) {
	return await db.provider.create({
		data,
	});
}

export async function getProviderById(id: string) {
	return await db.provider.findUniqueOrThrow({
		where: { id },
	});
}

export async function getProviders() {
	return await db.provider.findMany();
}

export async function updateProvider(id: string, data: Partial<ProviderData>) {
	return await db.provider.update({
		where: { id },
		data,
	});
}

export async function deleteProvider(id: string) {
	return await db.provider.delete({
		where: { id },
	});
}
