<script lang="ts">
	import type { Sale } from "@/lib/api/sales";
	import { fullDateFormatter, moneyFormatter } from "@/lib/utils/formatters";
	import AddProductForm from "./AddProductForm.svelte";
	import SaleDetailItem from "./SaleDetailItem.svelte";
	import DeleteSaleDialog from "../DeleteSaleDialog.svelte";
	import ChangePaymentMethodDialog from "./ChangePaymentMethodDialog.svelte";

	interface Props {
		sale: Sale;
	}

	let { sale }: Props = $props();
	let delSaleDialEl = $state<HTMLDialogElement>();
	let changePaymentMethodDialEl = $state<HTMLDialogElement>();
	let addPRoductDialEl = $state<HTMLDialogElement>();
</script>

<div class="wrapper">
	<!-- Detail -->
	<h2>
		Detalle de la venta #{sale.id} de {sale.user ? sale.user.name : "Cliente"}
	</h2>

	<header>
		<button
			popovertargetaction="show"
			popovertarget={`add-detail-${sale.id}`}
			onclick={() => addPRoductDialEl?.showPopover()}
		>
			➕ Añadir producto</button
		>

		<button
			popovertargetaction="show"
			popovertarget={`change-payment-method-${sale.id}`}
			onclick={() => changePaymentMethodDialEl?.showPopover()}
			>💳 Cambiar metodo de pago</button
		>

		<button
			popovertargetaction="show"
			popovertarget={`delete-sale-${sale.id}`}
			onclick={() => delSaleDialEl?.showPopover()}>🗑️ Eliminar venta</button
		>
	</header>

	<section>
		<article>
			<h3>Producto</h3>
			<p>Cantidad x Precio unitario</p>
			<p>Subtotal</p>
		</article>
		<hr />
		{#each sale.products as productOnSale}
			<SaleDetailItem {productOnSale} />
		{/each}
	</section>

	<footer>
		<p><b>Fecha:</b> {fullDateFormatter(new Date(sale.date))}</p>
		<p>
			<b>Metodo de pago:</b>
			{sale.paymentMethod === "CASH"
				? "Efectivo"
				: sale.paymentMethod === "CARD"
					? "Tarjeta"
					: "Transeferencia"}
		</p>

		<p>
			<b>Total: </b>
			{moneyFormatter(sale.total)}
		</p>
	</footer>

	<AddProductForm saleId={sale.id} bind:thisEl={addPRoductDialEl!} />
	<DeleteSaleDialog saleId={sale.id} bind:thisEl={delSaleDialEl!} />
	<ChangePaymentMethodDialog
		saleId={sale.id}
		bind:thisEl={changePaymentMethodDialEl!}
		paymentMethod={sale.paymentMethod}
	/>
</div>

<style>
	.wrapper {
		flex: 1;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}

	header {
		display: flex;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 1rem;
		margin-block: 1rem;
		& > * {
			flex: 1;
		}
	}

	section {
		flex: 1 1 400px;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		overflow: hidden auto;
	}

	footer {
		margin-top: auto; /* Empuja el footer hacia abajo */
		display: flex;
		flex-direction: column;
		align-items: end;
		margin-top: 1rem;
		font-size: 1.5rem;
	}
</style>
