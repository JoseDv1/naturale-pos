import { apiClient } from "../api";
import type { InferResponseType } from "hono/client";

const $supply = apiClient.api.supplies.$get;
export type Supply = InferResponseType<typeof $supply>[0];

export async function fetchSupplies(date: string) {
	const res = await apiClient.api.supplies.$get({
		query: {
			date
		}
	});

	return await res.json();
}

export async function createSupply(providerId: string) {
	const res = await apiClient.api.supplies.$post({
		json: {
			providerId
		}
	});
	return await res.json();
}

export async function deleteSupply(supplyId: string) {
	const res = await apiClient.api.supplies[":id"].$delete({
		param: {
			id: supplyId
		}
	});

	return await res.json();
}


// -------- Product on Supplies API --------
export async function createProductOnSupply(supplyId: string, data: {
	productId: string,
	quantity: number,
	unitPrice: number
}) {
	const res = await apiClient.api.supplies[":supplyId"].products[":productId"].$post({
		param: {
			supplyId,
			productId: data.productId
		},
		json: {
			quantity: data.quantity,
			unitPrice: data.unitPrice
		}
	});

	return await res.json();
}

export async function deleteProductOnSupply(supplyId: string, productId: string) {
	const res = await apiClient.api.supplies[":supplyId"].products[":productId"].$delete({
		param: {
			supplyId,
			productId
		}
	});

	return await res.json();
}

export async function updateProductOnSupply(supplyId: string, productId: string, data: {
	quantity: number,
	unitPrice: number
}) {
	const res = await apiClient.api.supplies[":supplyId"].products[":productId"].$put({
		param: {
			supplyId,
			productId
		},
		json: data
	});

	return await res.json();
}