import { apiClient } from "../api";
import type { InferResponseType } from "hono/client"
const type = apiClient.api.categories.$get
export type Category = InferResponseType<typeof type>[0]

export async function fetchCategories() {
	const res = await apiClient.api.categories.$get()
	return res.json()
}

export async function createCategory(data: {
	name: string;
	description?: string
}) {
	const res = await apiClient.api.categories.$post({ json: data })
	return res.json()
}

export async function updateCategory(id: number, data: {
	name: string;
	description?: string
}) {
	const res = await apiClient.api.categories[":id"].$put({ param: { id: id.toString() }, json: data })
	return res.json()
}

export async function deleteCategory(id: number) {
	const res = await apiClient.api.categories[":id"].$delete({ param: { id: id.toString() } })
	return res.json()
}

