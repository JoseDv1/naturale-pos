<script lang="ts">
	import {
		filteredCategories,
		setCategories,
	} from "../../lib/stores/categories";
	import DeleteCategoryPopover from "./DeleteCategoryPopover.svelte";
	import EditCategoryPopOver from "./EditCategoryPopover.svelte";
</script>

<ul>
	{#await setCategories() then _}
		{#each $filteredCategories as category (category.id)}
			<li>
				<div>
					<h3>{category.name}</h3>
					{#if category.description}
						<p>{category.description}</p>
					{/if}
				</div>

				<div class="actions">
					<button
						popovertargetaction="show"
						popovertarget={`edit-category-${category.id}`}
					>
						✏️ Editar</button
					>
					<button
						popovertargetaction="show"
						popovertarget={`delete-category-${category.id}`}
						class="danger"
					>
						🗑️ Eliminar</button
					>
				</div>

				<DeleteCategoryPopover id={category.id} />
				<EditCategoryPopOver {category} />
			</li>
		{:else}
			<p>No hay categorías</p>
		{/each}
	{/await}
</ul>

<style>
	ul {
		background-color: var(--accent-color);
		padding: 1rem;
		border-radius: var(--border-radius);
	}

	li {
		margin-block: 1rem;
		padding: 1rem;
		background-color: var(--background-color);
		border-radius: var(--border-radius);
		display: flex;
		justify-content: space-between;
		align-items: start;
	}

	.actions {
		display: flex;
		gap: 1rem;
	}
</style>
