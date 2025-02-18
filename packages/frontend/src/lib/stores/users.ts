import { writable } from "svelte/store";
import { fetchUsers, type User } from "../api/users";


export const users = writable<User[]>([]);

export async function setUsers() {
	const data = await fetchUsers();
	users.set(data);
}
