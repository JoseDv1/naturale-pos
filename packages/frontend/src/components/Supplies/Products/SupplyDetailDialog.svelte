<script lang="ts">
	import { fullDateFormatter, moneyFormatter } from "@/lib/utils/formatters";
	import AddSupplyProductForm from "./AddSupplyProductForm.svelte";
	import SupplyDetailItem from "./SupplyDetailItem.svelte";
	import type { Supply } from "@/lib/api/supplies";

	interface Props {
		supply: Supply;
		delSupplyDialog: HTMLDialogElement | undefined;
	}

	let { supply, delSupplyDialog }: Props = $props();
	let addProductDialog = $state<HTMLDialogElement>();
</script>

<div class="wrapper">
	<!-- Detail -->
	<h2>
		Detalle del suministro #{supply.id} de
		{supply.provider ? supply.provider.name : "Proveedor"}
	</h2>

	<header>
		<!-- Add product -->

		<button
			popovertargetaction="show"
			popovertarget={`add-detail-${supply.id}`}
			onclick={() => addProductDialog!.showPopover()}
		>
			➕ Añadir producto
		</button>

		<button onclick={() => delSupplyDialog!.showPopover()}>
			🗑️ Eliminar
		</button>
	</header>

	<section>
		<article>
			<h3>Producto</h3>
			<p>Cantidad x Precio unitario</p>
			<p>Subtotal</p>
		</article>
		<hr />
		{#each supply.supplyProducts as productOnSupply ((productOnSupply.supplyId, productOnSupply.productId))}
			<SupplyDetailItem {productOnSupply} />
		{/each}
	</section>

	<footer>
		<p><b>Fecha:</b> {fullDateFormatter(new Date(supply.date))}</p>
		<p>
			<b>Total:</b>
			{moneyFormatter(supply.total)}
		</p>
	</footer>

	<AddSupplyProductForm supplyId={supply.id} bind:thisEl={addProductDialog!} />
</div>

<style>
	.wrapper {
		flex: 1;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}

	h2 {
		margin-bottom: 1rem;
	}

	header {
		display: flex;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 1rem;
		margin-bottom: 1rem;
	}
	header > * {
		flex: 1;
	}

	section {
		flex: 1 1 400px;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		overflow: auto;
	}

	footer {
		margin-top: 1rem;
		display: flex;
		flex-direction: column;
		align-items: end;
		font-size: 1.5rem;
	}
</style>
