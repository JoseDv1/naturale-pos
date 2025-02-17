<script lang="ts">
	import { removeProductOnSale } from "@/lib/stores/sales";

	interface Props {
		saleId: number;
		productId: string;
		thisEl?: HTMLDialogElement | null;
	}

	let { saleId, productId, thisEl = $bindable() }: Props = $props();
</script>

<dialog popover="auto" id={`delete-${saleId}-${productId}`} bind:this={thisEl}>
	<div class="popover">
		<h1>Eliminar Producto</h1>
		<p>¿Estás seguro de que deseas eliminar este producto de la venta?</p>
		<div class="buttons">
			<button
				class="danger"
				onclick={async () => {
					await removeProductOnSale(saleId, productId);
					thisEl!.hidePopover();
				}}
			>
				🗑️ Eliminar
			</button>
			<button
				class="info"
				onclick={() => {
					thisEl!.hidePopover();
				}}
			>
				❌ Cancelar
			</button>
		</div>
	</div>
</dialog>

<style>
	.popover {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.buttons {
		align-self: flex-end;
		display: flex;
		gap: 1rem;
	}
</style>
