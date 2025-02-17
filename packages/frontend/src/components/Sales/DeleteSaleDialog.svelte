<script lang="ts">
	import { removeSale } from "@/lib/stores/sales";

	interface Props {
		saleId: number;
		thisEl?: HTMLDialogElement | null;
	}

	let { saleId, thisEl = $bindable() }: Props = $props();
</script>

<dialog popover="auto" id={`delete-sale-${saleId}`} bind:this={thisEl}>
	<div class="popover">
		<h2>Eliminar venta</h2>
		<p>¿Estás seguro de que deseas eliminar esta venta?</p>
		<footer>
			<button
				type="button"
				onclick={() => {
					thisEl?.hidePopover();
				}}
			>
				❌ Cancelar
			</button>
			<button
				type="button"
				class="danger"
				onclick={async () => {
					await removeSale(saleId);
					thisEl?.hidePopover();
				}}
			>
				🗑️ Eliminar
			</button>
		</footer>
	</div>
</dialog>

<style>
	.popover {
		padding: 1rem;
		border-radius: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	footer {
		display: flex;
		gap: 1rem;
		align-self: flex-end;
	}
</style>
