import { apiClient } from "../api";
import type { InferResponseType } from "hono/client";

const type = apiClient.api.products.$get;
export type Product = InferResponseType<typeof type>[0];

export async function fetchProducts() {
	const res = await apiClient.api.products.$get();
	return res.json();
}

export async function createProduct(data: {
	name: string;
	description?: string;
	price: number;
	categoryId: number;
}) {
	const res = await apiClient.api.products.$post({ json: data });
	return res.json();
}

export async function updateProduct(
	id: string,
	data: {
		name?: string;
		description?: string;
		price?: number;
		categoryId?: number;
	}
) {
	const res = await apiClient.api.products[":id"].$put({ param: { id }, json: data });
	return res.json();
}

export async function deleteProduct(id: string) {
	const res = await apiClient.api.products[":id"].$delete({ param: { id } });
	return res.json();
}
