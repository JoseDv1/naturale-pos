import { writable, derived } from "svelte/store";
import {
	fetchProducts,
	createProduct,
	updateProduct,
	deleteProduct,
	type Product,
} from "../api/products";

export const products = writable<Product[]>([]);
export const searchQuery = writable("");

export const filteredProducts = derived(
	[products, searchQuery],
	([$products, $searchQuery]) => {
		if (!$searchQuery) return $products;
		const query = $searchQuery.toLowerCase();
		return $products.filter(product => product.name.toLowerCase().includes(query));
	}
);

export async function setProducts() {
	const data = await fetchProducts();
	products.set(data);
}

export async function addProduct(data: {
	name: string;
	description?: string;
	price: number;
	categoryId: number;
}) {
	const newProduct = await createProduct(data);
	products.update(current => [...current, newProduct]);
}

export async function removeProduct(id: string) {
	await deleteProduct(id);
	products.update(current => current.filter(product => product.id !== id));
}

export async function editProduct(
	id: string,
	data: {
		name?: string;
		description?: string;
		price?: number;
		categoryId?: number;
		stock?: number;
	}
) {
	const updatedProduct = await updateProduct(id, data);
	products.update(current => {
		const index = current.findIndex(product => product.id === id);
		current[index] = updatedProduct;
		return current;
	});
}

