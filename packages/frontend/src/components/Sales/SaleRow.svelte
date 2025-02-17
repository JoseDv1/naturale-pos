<script lang="ts">
	import type { Sale } from "@/lib/api/sales";
	import { dateHoursFormatter, moneyFormatter } from "@/lib/utils/formatters";
	import SaleDetailDialog from "./Products/SaleDetailDialog.svelte";
	import DeleteSaleDialog from "./DeleteSaleDialog.svelte";
	// import ChangeClientDialog from "./ChangeClientDialog.svelte";

	interface Props {
		sale: Sale;
	}

	let { sale }: Props = $props();
	let showDetailEl = $state<HTMLDialogElement>();
	let DelPopEl = $state<HTMLDialogElement>();
</script>

<tr
	onclick={(e: Event) => {
		showDetailEl!.showPopover();
	}}
>
	<td>#{sale.id}</td>
	<td>{dateHoursFormatter(new Date(sale.date))}</td>
	<td>{sale.user ? sale.user.name : "Cliente"}</td>
	<td
		>{sale.paymentMethod === "CASH"
			? "Efectivo"
			: sale.paymentMethod === "CARD"
				? "Tarjeta"
				: "Transeferencia"}</td
	>
	<td>{moneyFormatter(sale.total)}</td>
</tr>

<!-- SaleDetails -->
<dialog
	popover="auto"
	id={`detail-${sale.id}`}
	bind:this={showDetailEl}
	class="detail"
>
	<button
		popovertarget={`detail-${sale.id}`}
		popovertargetaction="hide"
		class="danger"
	>
		&times;
	</button>
	<SaleDetailDialog {sale} />
</dialog>

<DeleteSaleDialog bind:thisEl={DelPopEl!} saleId={sale.id} />

<!-- <ChangeClientDialog
		clientId={sale.clientId}
		saleId={sale.id}
		clientName={sale.client.name}
		bind:thisEl={changeClientPopEl!}
	/> -->

<style>
	td {
		padding: 0.5rem 1rem;
		margin-block: 0.1rem;
		text-align: left;

		&:first-child {
			border-left: none;
			border-radius: var(--border-radius) 0 0 var(--border-radius);
		}

		&:last-child {
			border-right: none;
			border-radius: 0 var(--border-radius) var(--border-radius) 0;
		}
	}

	dialog {
		inset: unset;
		position: fixed;
		right: 0;

		height: 100%;
		max-height: 100dvh;

		padding: 1rem;
		z-index: 1100;
		border-radius: var(--border-radius);
		background-color: var(--background-color);
		box-shadow: 0 0 10px rgba(0, 0, 0, 0.25);
		max-width: clamp(300px, 50%, 1000px);
		border: 1px solid var(--background-color);

		/*Exit state */
		transform: translateX(100%);
		opacity: 0;
		transition: all 0.3s ease-in-out allow-discrete;
		flex-direction: column;
		justify-content: space-between;
		align-items: start;
		display: none;

		&:popover-open {
			display: flex;
			transform: translateX(0);
			opacity: 1;

			@starting-style {
				transform: translateX(100%);
				opacity: 0;
			}
		}
	}

	dialog button[popovertargetaction="hide"] {
		position: absolute;
		background-color: transparent;
		color: red;
		z-index: 10;
		left: 0;
		top: 0;
	}
</style>
