<script lang="ts">
	import { removeSupply } from "@/lib/stores/supplies";

	interface Props {
		supplyId: number;
		thisEl: HTMLDialogElement | null;
		supplierName?: string;
	}

	let { supplyId, thisEl = $bindable(), supplierName }: Props = $props();
</script>

<dialog popover="auto" id={`del-${supplyId}`} bind:this={thisEl}>
	<div class="popover">
		<h2>Eliminar suministro</h2>
		<p>
			¿Estás seguro de que deseas eliminar el suministro #{supplyId} de
			{supplierName ? supplierName : "Proveedor"}?
		</p>
		<div class="buttons">
			<button popovertarget={`del-${supplyId}`} popovertargetaction="hide"
				>Cancelar</button
			>
			<!-- svelte-ignore a11y_autofocus -->
			<button
				onclick={async () => await removeSupply(supplyId)}
				class="danger"
				autofocus>Eliminar</button
			>
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
