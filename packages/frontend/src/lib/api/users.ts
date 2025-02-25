import { apiClient } from "../api"
import type { InferResponseType } from "hono/client"

const type = apiClient.api.users.$get
export type User = InferResponseType<typeof type>[0]

export async function fetchUsers() {
	const res = await apiClient.api.users.$get()
	return await res.json()
}

export async function changePassword(password: string) {
	await apiClient.api.users["change-password"].$post({
		json: {
			newPassword: password
		}
	})
	await apiClient.api.users.logout.$get()
}
