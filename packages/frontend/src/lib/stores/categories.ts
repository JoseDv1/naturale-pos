import { writable, derived } from "svelte/store";
import { createCategory, deleteCategory, fetchCategories, updateCategory, type Category } from "../api/categories";

export const categories = writable<Category[]>([]);
export const searchQuery = writable("");

export const filteredCategories = derived(
	[categories, searchQuery],
	([$categories, $searchQuery]) => {
		if (!$searchQuery) return $categories;
		const query = $searchQuery.toLowerCase();
		return $categories.filter(category =>
			category.name.toLowerCase().includes(query)
		);
	}
);

export async function setCategories() {
	const data = await fetchCategories();
	categories.set(data);
}

// Utility function to add a new category to the store
export async function addCategory(data: {
	name: string;
	description?: string;
}) {
	const addedCategory = await createCategory(data);
	categories.update(current => [...current, addedCategory]);
}

// Utility function to remove a category from the store by its id
export async function removeCategory(id: number) {
	await deleteCategory(id);
	categories.update(current => current.filter(category => category.id !== id));
}

// Utility function to update an existing category in the store
export async function editCategory(id: number, data: {
	name: string;
	description?: string;
}) {
	const updatedCategory = await updateCategory(id, data);
	categories.update(current => {
		const index = current.findIndex(category => category.id === id);
		current[index] = updatedCategory;
		return current;
	});
}