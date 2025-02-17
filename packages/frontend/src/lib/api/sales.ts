import { apiClient } from "../api";
import type { InferResponseType } from "hono/client";


const $sale = apiClient.api.sales.$get
export type Sale = InferResponseType<typeof $sale>[0];

export async function fetchSales(date: string) {
	const res = await apiClient.api.sales.$get({
		query: {
			date
		}
	})

	return await res.json();
}

export async function createSale() {
	const res = await apiClient.api.sales.$post()
	return await res.json();
}

export async function deleteSale(saleId: string) {
	const res = await apiClient.api.sales[":id"].$delete({
		param: {
			id: saleId
		}
	})

	return await res.json();
}

// -------- Product on Sales API --------
export async function createProductOnSale(saleId: string, data: {
	productId: string,
	quantity: number
}) {
	const res = await apiClient.api.sales[":saleId"].products[":productId"].$post({
		param: {
			saleId,
			productId: data.productId
		},
		json: {
			quantity: data.quantity,
		}
	})

	return await res.json();
}

export async function deleteProductOnSale(saleId: string, productId: string) {
	const res = await apiClient.api.sales[":saleId"].products[":productId"].$delete({
		param: {
			saleId,
			productId
		}
	})

	return await res.json();
}

export async function updateProductOnSale(saleId: string, productId: string, data: {
	quantity: number,
	unitPrice: number
}) {
	const res = await apiClient.api.sales[":saleId"].products[":productId"].$put({
		param: {
			saleId,
			productId
		},
		json: data
	})

	return await res.json();
}

