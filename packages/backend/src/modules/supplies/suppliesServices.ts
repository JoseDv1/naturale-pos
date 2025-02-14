import { db } from '@/lib/prisma';

interface SupplyData {
	providerId: string;
	total: number;
}

export async function createSupply(data: SupplyData) {
	return await db.supply.create({
		data,
	});
}

export async function getSupplyById(id: number) {
	return await db.supply.findUniqueOrThrow({
		where: { id },
	});
}

export async function getSupplies() {
	return await db.supply.findMany();
}

export async function deleteSupply(id: number) {
	return await db.supply.delete({
		where: { id },
	});
}
