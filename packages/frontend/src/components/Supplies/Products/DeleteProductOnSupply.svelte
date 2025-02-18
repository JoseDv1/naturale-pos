<script lang="ts">
	import { removeProductOnSupply } from "@/lib/stores/supplies";

	interface Props {
		supplyId: number;
		productId: string;
		thisEl?: HTMLDialogElement | null;
	}

	let { supplyId, productId, thisEl = $bindable() }: Props = $props();
</script>

<dialog
	popover="auto"
	id={`delete-${supplyId}-${productId}`}
	bind:this={thisEl}
>
	<div class="popover">
		<p>¿Estás seguro de que deseas eliminar este producto del suministro?</p>
		<div class="buttons">
			<button
				class="danger"
				onclick={async () => {
					await removeProductOnSupply(supplyId, productId);
					thisEl!.hidePopover();
				}}
			>
				🗑️ Eliminar
			</button>
			<button
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
		gap: 1rem;
	}

	.buttons {
		display: flex;
		justify-content: flex-end;
		gap: 1rem;
	}
</style>
