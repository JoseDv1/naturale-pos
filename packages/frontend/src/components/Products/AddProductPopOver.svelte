<script lang="ts">
	import { categories, setCategories } from "@/lib/stores/categories";
	import { addProduct } from "@/lib/stores/products";

	async function handleCreate(e: SubmitEvent) {
		e.preventDefault();
		const form = e.target as HTMLFormElement;
		const formData = new FormData(form);
		const data = {
			name: formData.get("name") as string,
			description: formData.get("description") as string,
			price: parseInt(formData.get("price") as string),
			categoryId: parseInt(formData.get("category") as string),
		};

		await addProduct(data);
		form.reset();
	}
</script>

<dialog popover="auto" id="create-product">
	<button popovertarget="create-product" popovertargetaction="hide"
		>&times;</button
	>
	<h1>Añadir Producto</h1>
	<form onsubmit={handleCreate}>
		<label>
			<span>Nombre</span>
			<input type="text" name="name" autocomplete="off" />
		</label>

		<label>
			<span>Descripción</span>
			<textarea name="description" autocomplete="off"></textarea>
		</label>

		<label>
			<span>Precio</span>
			<input type="number" name="price" autocomplete="off" />
		</label>

		<label>
			<span>Categoria</span>
			<select name="category">
				<option value="" disabled selected>Selecciona una categoría</option>
				{#await setCategories() then _}
					{#each $categories as category (category.id)}
						<option value={category.id}>{category.name}</option>
					{/each}
				{/await}
			</select>
		</label>

		<button type="submit">Añadir</button>
	</form>
</dialog>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
</style>
