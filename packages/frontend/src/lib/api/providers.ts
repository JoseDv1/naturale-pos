import { apiClient } from "../api";
import type { InferResponseType } from "hono/client";

const type = apiClient.api.providers.$get;
export type Provider = InferResponseType<typeof type>[0];

export async function fetchProviders() {
	const res = await apiClient.api.providers.$get();
	return res.json();
}

export async function createProvider(data: { name: string; address?: string; phone?: string; email?: string; }) {
	const res = await apiClient.api.providers.$post({ json: data });
	return res.json();
}

export async function updateProvider(id: string, data: { name?: string; address?: string; phone?: string; email?: string; }) {
	const res = await apiClient.api.providers[":id"].$put({ param: { id }, json: data });
	return res.json();
}

export async function deleteProvider(id: string) {
	const res = await apiClient.api.providers[":id"].$delete({ param: { id } });
	return res.json();
}