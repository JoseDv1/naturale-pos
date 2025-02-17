<script lang="ts">
	import { removeCategory } from "@/lib/stores/categories";

	interface Props {
		id: number;
	}

	let { id }: Props = $props();
</script>

<dialog popover="auto" id={`delete-category-${id}`}>
	<button popovertarget={`delete-category-${id}`} popovertargetaction="hide"
		>&times;</button
	>
	<div class="wrapper">
		<h1>Eliminar Categoria</h1>
		<p>¿Estas seguro de Eliminar la categoria?</p>
		<div>
			<button
				class="danger"
				onclick={async () => {
					await removeCategory(id);
				}}
			>
				🗑️ Eliminar</button
			>
			<button
				popovertarget={`delete-category-${id}`}
				popovertargetaction="hide"
				class=""
			>
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
