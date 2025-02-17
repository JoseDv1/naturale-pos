<script lang="ts">
	import { removeProvider } from "@/lib/stores/providers";

	interface Props {
		id: string;
	}

	let { id }: Props = $props();
</script>

<dialog popover="auto" id={`delete-provider-${id}`}>
	<button popovertarget={`delete-provider-${id}`} popovertargetaction="hide"
		>&times;</button
	>
	<div class="wrapper">
		<h1>Eliminar Proveedor</h1>
		<p>¿Estas seguro de Eliminar el proveedor?</p>
		<div>
			<button
				class="danger"
				onclick={async () => {
					await removeProvider(id);
				}}>🗑️ Eliminar</button
			>
			<button popovertarget={`delete-provider-${id}`} popovertargetaction="hide"
				>✖️ Cancelar</button
			>
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
