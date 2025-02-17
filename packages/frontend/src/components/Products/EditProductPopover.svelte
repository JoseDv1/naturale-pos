<script lang="ts">
	import { type Product } from "@/lib/api/products";
	import { categories } from "@/lib/stores/categories";
	import { editProduct } from "@/lib/stores/products";

	interface Props {
		product: Product;
	}

	let { product }: Props = $props();

	async function handleEdit(e: SubmitEvent) {
		e.preventDefault();
		const form = e.target as HTMLFormElement;
		const formData = new FormData(form);
		const data = {
			name: formData.get("name") as string,
			description: formData.get("description") as string,
			price: Number(formData.get("price")),
			categoryId: Number(formData.get("category")),
		};
		await editProduct(product.id, data);
		form.reset();
	}
</script>

<dialog popover="auto" id={`edit-product-${product.id}`}>
	<button
		popovertarget={`edit-product-${product.id}`}
		popovertargetaction="hide"
	>
		×
	</button>
	<h1>Editar Producto</h1>
	<form onsubmit={handleEdit}>
		<label>
			<span>Nombre</span>
			<input
				type="text"
				name="name"
				autocomplete="off"
				defaultValue={product.name}
			/>
		</label>

		<label>
			<span>Descripción</span>
			<textarea name="description" autocomplete="off"
				>{product.description}</textarea
			>
		</label>

		<label>
			<span>Precio</span>
			<input
				type="number"
				name="price"
				autocomplete="off"
				step="0.01"
				defaultValue={product.price}
			/>
		</label>

		<label>
			<span>Categoria</span>
			<select name="category">
				{#each $categories as category (category.id)}
					{@const isActualCategory = category.id === product.categoryId}
					<option
						value={category.id}
						disabled={isActualCategory}
						selected={isActualCategory}
						>{category.name}
					</option>
				{/each}
			</select>
		</label>

		<button type="submit">Guardar</button>
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
