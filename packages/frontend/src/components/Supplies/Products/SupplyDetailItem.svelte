<script lang="ts">
	import EditProductOnSupply from "./EditProductOnSupply.svelte";
	import DeleteProductOnSupply from "./DeleteProductOnSupply.svelte";
	import { moneyFormatter } from "@/lib/utils/formatters";
	import type { Supply } from "@/lib/api/supplies";

	interface Props {
		productOnSupply: Supply["supplyProducts"][0];
	}

	let { productOnSupply }: Props = $props();
	let delPopEl = $state<HTMLDialogElement>();
	let editPopEl = $state<HTMLDialogElement>();
</script>

<div class="wrapper">
	<article class="product-info">
		<h3>{productOnSupply.product.name}</h3>
		<p>
			{productOnSupply.quantity} x {moneyFormatter(productOnSupply.price)}
		</p>
		<p>
			{moneyFormatter(productOnSupply.price * productOnSupply.quantity)}
		</p>
	</article>

	<div class="actions">
		<button
			popovertargetaction="show"
			popovertarget={`edit-${productOnSupply.supplyId}-${productOnSupply.productId}`}
			onclick={() => editPopEl!.showPopover()}
		>
			✏️ Editar
		</button>
		<button
			popovertargetaction="show"
			popovertarget={`delete-${productOnSupply.supplyId}-${productOnSupply.productId}`}
			onclick={() => delPopEl!.showPopover()}
		>
			🗑️ Eliminar
		</button>
	</div>
</div>

<DeleteProductOnSupply
	supplyId={productOnSupply.supplyId}
	productId={productOnSupply.productId}
	bind:thisEl={delPopEl}
/>

<EditProductOnSupply {productOnSupply} bind:thisEl={editPopEl} />

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

	.actions {
		display: flex;
		gap: 1rem;
	}
</style>
