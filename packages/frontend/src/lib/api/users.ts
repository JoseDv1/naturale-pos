import { apiClient } from "../api"
import type { InferResponseType } from "hono/client"

const type = apiClient.api.users.$get
export type User = InferResponseType<typeof type>[0]

export async function fetchUsers() {
	const res = await apiClient.api.users.$get()
	return await res.json()
}
