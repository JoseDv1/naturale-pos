<script lang="ts">
	import { removeProduct } from "@/lib/stores/products";

	interface Props {
		id: string;
	}

	let { id }: Props = $props();
</script>

<dialog popover="auto" id={`delete-product-${id}`}>
	<button popovertarget={`delete-product-${id}`} popovertargetaction="hide"
		>&times;</button
	>
	<div class="wrapper">
		<h1>Eliminar Producto</h1>
		<p>¿Estas seguro de Eliminar el producto?</p>
		<div>
			<button
				class="danger"
				onclick={async () => {
					await removeProduct(id);
				}}
			>
				🗑️ Eliminar</button
			>
			<button popovertarget={`delete-product-${id}`} popovertargetaction="hide">
				✖️ Cancelar
			</button>
		</div>
	</div>
</dialog>

<style>
	.wrapper {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	button {
		margin: 0.5rem;
	}

	.wrapper > div {
		align-self: flex-end;
		display: flex;
	}
</style>
