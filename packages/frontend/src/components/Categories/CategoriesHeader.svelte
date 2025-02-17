<script lang="ts">
	import { searchQuery } from "@/lib/stores/categories";
	import AddCategoryPopOver from "./AddCategoryPopover.svelte";
</script>

<header>
	<h1>Categorias</h1>

	<div>
		<div class="actions">
			<button
				class="btn"
				popovertarget="create-category"
				popovertargetaction="show"
				>Añadir Categoría
			</button>
		</div>

		<input type="search" placeholder="Buscar..." bind:value={$searchQuery} />
	</div>
</header>

<AddCategoryPopOver />

<style>
	header {
		margin-block: 1rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		background-color: var(--accent-color);
		padding: 1rem;
		border-radius: var(--border-radius);
		view-transition-name: header;
	}

	header h1 {
		flex: 1 0 auto;
		view-transition-name: title;
	}

	header > div {
		flex: 1 0 150px;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1rem;

		.actions {
			display: inline-flex;
			gap: 1rem;
			view-transition-name: actions;
		}

		input {
			flex: 1 0 auto;
			view-transition-name: search;
		}
	}
</style>
