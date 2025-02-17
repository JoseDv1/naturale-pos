import { writable, derived } from "svelte/store";
import { fetchProviders, createProvider, updateProvider, deleteProvider, type Provider } from "../api/providers";

export const providers = writable<Provider[]>([]);
export const searchQuery = writable("");

export const filteredProviders = derived(
	[providers, searchQuery],
	([$providers, $searchQuery]) => {
		if (!$searchQuery) return $providers;
		const query = $searchQuery.toLowerCase();
		return $providers.filter(provider => provider.name.toLowerCase().includes(query));
	}
);

export async function setProviders() {
	const data = await fetchProviders();
	providers.set(data);
}

export async function addProvider(data: { name: string; address?: string; phone?: string; email?: string; }) {
	const newProvider = await createProvider(data);
	providers.update(current => [...current, newProvider]);
}

export async function removeProvider(id: string) {
	await deleteProvider(id);
	providers.update(current => current.filter(provider => provider.id !== id));
}

export async function editProvider(id: string, data: { name?: string; address?: string; phone?: string; email?: string; }) {
	const updatedProvider = await updateProvider(id, data);
	providers.update(current => {
		const index = current.findIndex(provider => provider.id === id);
		current[index] = updatedProvider;
		return current;
	});
}