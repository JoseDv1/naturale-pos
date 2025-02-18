import { derived, writable } from "svelte/store";
import { fetchSupplies, createProductOnSupply, createSupply, deleteProductOnSupply, deleteSupply, updateProductOnSupply, type Supply } from "../api/supplies";
import { syncStoreWithUrl } from "../utils/stores";

const params = new URLSearchParams(window.location.search);
const initialDate = params.get('date') ?? new Date().toISOString().split("T")[0];
const initialProviderId = params.get('providerId') ?? '';
export const supplies = writable<Supply[]>([]);
export const dateStore = writable<string>(initialDate);
export const providerId = writable<string>(initialProviderId);
syncStoreWithUrl(dateStore, 'date');
syncStoreWithUrl(providerId, 'providerId');

export const derivedSuppliesProvider = derived([supplies, providerId], ([$supplies, $providerId]) => {
	if (!$providerId) return $supplies;
	return $supplies.filter(supply => supply.providerId === $providerId);
})

export const derivedSuppliesData = derived(supplies, ($supplies) => {
	const totalSupplies = $supplies.reduce((acc, supply) => acc + supply.total, 0);
	const totalSuppliesCount = $supplies.length;

	return {
		totalSupplies,
		totalSuppliesCount
	};
});

export const derivedSuppliesByProviderData = derived([derivedSuppliesProvider], ([$providerSupplies]) => {
	const totalSupplies = $providerSupplies.reduce((acc, supply) => acc + supply.total, 0);
	const totalSuppliesCount = $providerSupplies.length;

	return {
		totalSupplies,
		totalSuppliesCount
	};
});




export async function setSupplies(date: string) {
	const data = await fetchSupplies(date);
	supplies.set(data);
}

export async function addSupply(providerId: string) {
	const supply = await createSupply(providerId);
	supplies.update(supplies => [supply, ...supplies]);
}

export async function removeSupply(supplyId: number) {
	await deleteSupply(supplyId.toString());
	supplies.update(supplies => supplies.filter(supply => supply.id !== supplyId));
}

// Product on supply
export async function addProductToSupply(supplyId: number, data: {
	productId: string,
	quantity: number,
	unitPrice: number
}) {
	const updatedSupply = await createProductOnSupply(supplyId.toString(), {
		productId: data.productId,
		quantity: data.quantity,
		unitPrice: data.unitPrice
	});
	supplies.update((oldSupplies) => {
		const supply = oldSupplies.findIndex(supply => supply.id === supplyId);
		oldSupplies[supply] = updatedSupply;
		return oldSupplies;
	});
}

export async function removeProductOnSupply(supplyId: number, productId: string) {
	const updatedSupplyWithoutProductOnSupply = await deleteProductOnSupply(supplyId.toString(), productId);
	supplies.update((oldSupplies) => {
		const supply = oldSupplies.findIndex(supply => supply.id === supplyId);
		oldSupplies[supply] = updatedSupplyWithoutProductOnSupply;
		return oldSupplies;
	});
}

export async function editProductOnSupply(supplyId: number, productId: string, data: {
	quantity: number,
	unitPrice: number
}) {
	const updatedSupply = await updateProductOnSupply(supplyId.toString(), productId, data);
	supplies.update((oldSupplies) => {
		const supply = oldSupplies.findIndex(supply => supply.id === supplyId);
		oldSupplies[supply] = updatedSupply;
		return oldSupplies;
	});
}

