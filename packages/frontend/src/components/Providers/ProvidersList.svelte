<script lang="ts">
	import { filteredProviders, setProviders } from "@/lib/stores/providers";
	import DeleteProviderPopover from "./DeleteProviderPopover.svelte";
	import EditProviderPopover from "./EditProviderPopover.svelte";
</script>

<ul>
	{#await setProviders() then _}
		{#each $filteredProviders as provider (provider.id)}
			<li>
				<div>
					<h3>{provider.name}</h3>
					{#if provider.address}
						<p>{provider.address}</p>
					{/if}
					{#if provider.phone}
						<p>{provider.phone}</p>
					{/if}
					{#if provider.email}
						<p>{provider.email}</p>
					{/if}
				</div>

				<div class="actions">
					<button
						popovertargetaction="show"
						popovertarget={`edit-provider-${provider.id}`}
					>
						✏️ Editar
					</button>
					<button
						popovertargetaction="show"
						popovertarget={`delete-provider-${provider.id}`}
						class="danger">🗑️ Eliminar</button
					>
				</div>

				<DeleteProviderPopover id={provider.id} />
				<EditProviderPopover {provider} />
			</li>
		{:else}
			<p>No hay proveedores</p>
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
