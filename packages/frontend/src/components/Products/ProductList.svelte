<script lang="ts">
	import { moneyFormatter } from "@/lib/utils/formatters";
	import { filteredProducts, setProducts } from "../../lib/stores/products";
	import DeleteProductPopover from "./DeleteProductPopover.svelte";
	import EditProductPopover from "./EditProductPopover.svelte";
</script>

<ul>
	{#await setProducts() then _}
		{#each $filteredProducts as product (product.id)}
			<li>
				<div>
					<h2>{product.name}</h2>
					<h3>{product.category.name}</h3>
					<p>
						<b>Precio: </b>
						{moneyFormatter(product.price)}
					</p>
					<p>
						<b>Stock: </b>
						{product.stock}
					</p>
					<p>
						<b>Actualizado: </b>
						{new Date(product.updatedAt).toLocaleDateString()}
					</p>
					{#if product.description}
						<p>{product.description}</p>
					{/if}
				</div>

				<div class="actions">
					<button
						popovertargetaction="show"
						popovertarget={`edit-product-${product.id}`}
						class="warning"
					>
						✏️ Editar</button
					>
					<button
						popovertargetaction="show"
						popovertarget={`delete-product-${product.id}`}
						class="danger"
					>
						🗑️ Eliminar</button
					>
				</div>

				<DeleteProductPopover id={product.id} />
				<EditProductPopover {product} />
			</li>
		{:else}
			<p>No hay productos</p>
		{/each}
	{/await}
</ul>

<style>
	ul {
		background-color: var(--accent-color);
		padding: 1rem;
		border-radius: var(--border-radius);
	}

	li {
		margin-block: 1rem;
		padding: 1rem;
		background-color: var(--background-color);
		border-radius: var(--border-radius);
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}

	.actions {
		display: flex;
		gap: 1rem;
	}
</style>
