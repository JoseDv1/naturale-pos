<script lang="ts">
	import {
		dateHoursFormatter,
		idFormatter,
		moneyFormatter,
	} from "@/lib/utils/formatters";
	import DeleteSupplyDialog from "./DeleteSupplyDialog.svelte";
	import SupplyDetailDialog from "./Products/SupplyDetailDialog.svelte";
	import type { Supply } from "@/lib/api/supplies";

	interface Props {
		supply: Supply;
	}

	let { supply }: Props = $props();
	let showDetailEl = $state<HTMLDialogElement>();
	let DelPopEl = $state<HTMLDialogElement>();
</script>

<tr
	onclick={(e: Event) => {
		showDetailEl!.showPopover();
	}}
>
	<td>#{supply.id}</td>
	<td>{dateHoursFormatter(new Date(supply.date))}</td>
	<td>{supply.provider ? supply.provider.name : "Proveedor"}</td>
	<td>{moneyFormatter(supply.total)}</td>
</tr>

<!-- SupplyDetails -->
<dialog
	popover="auto"
	id={`detail-${supply.id}`}
	bind:this={showDetailEl}
	class="detail"
>
	<button
		popovertarget={`detail-${supply.id}`}
		popovertargetaction="hide"
		class="danger"
		aria-label="Cerrar"
	>
		&times;
	</button>
	<SupplyDetailDialog {supply} delSupplyDialog={DelPopEl} />
</dialog>

<DeleteSupplyDialog
	bind:thisEl={DelPopEl!}
	supplyId={supply.id}
	supplierName={supply.provider.name}
/>

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
		background-color: var(--accent-color);
		box-shadow: var(--box-shadow);
		max-width: clamp(300px, 50%, 1000px);
		border: 1px solid var(--accent-color);

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
		z-index: 10;
		left: 0;
		top: 0;
		background-color: transparent;
	}
</style>
