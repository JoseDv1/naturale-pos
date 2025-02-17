<script lang="ts">
	import EditProductOnSale from "./EditProductOnSale.svelte";
	import DeleteProductOnSale from "./DeleteProductOnSale.svelte";

	import { moneyFormatter } from "@/lib/utils/formatters";
	import type { Sale } from "@/lib/api/sales";

	interface Props {
		productOnSale: Sale["products"][0];
	}
	let { productOnSale }: Props = $props();

	let delPopEl = $state<HTMLDialogElement>();
	let editPopEL = $state<HTMLDialogElement>();
</script>

<div class="wrapper">
	<article class="product-info">
		<h3>{productOnSale.product.name}</h3>
		<p>
			{productOnSale.quantity} x {moneyFormatter(productOnSale.price)}
		</p>
		<p>
			{moneyFormatter(productOnSale.price * productOnSale.quantity)}
		</p>
	</article>

	<article class="actions">
		<button
			type="button"
			onclick={() => {
				editPopEL?.showPopover();
			}}>✏️ Editar</button
		>
		<button
			type="button"
			class="danger"
			onclick={() => {
				delPopEl?.showPopover();
			}}>🗑️ Eliminar</button
		>
	</article>
</div>

<DeleteProductOnSale
	saleId={productOnSale.saleId}
	productId={productOnSale.productId}
	bind:thisEl={delPopEl}
/>

<EditProductOnSale {productOnSale} bind:thisEl={editPopEL} />

<style>
	.wrapper {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.product-info {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}

	article.actions {
		padding-inline: 0.5rem;
	}
</style>
