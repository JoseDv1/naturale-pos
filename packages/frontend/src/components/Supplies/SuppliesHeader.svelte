<script lang="ts">
	import { setProviders, providers } from "@/lib/stores/providers";
	import {
		addSupply,
		providerId,
		dateStore,
		derivedSuppliesByProviderData,
		derivedSuppliesData,
	} from "@/lib/stores/supplies";
	import { slide } from "svelte/transition";
	import { moneyFormatter } from "@/lib/utils/formatters";
</script>

<header>
	<search>
		<input
			type="date"
			name="supplies-date"
			id="supplies-date"
			bind:value={$dateStore}
		/>
		{#if $dateStore !== new Date().toISOString().split("T")[0]}
			<button
				transition:slide={{
					axis: "x",
					duration: 300,
				}}
				class="btn info"
				onclick={() => ($dateStore = new Date().toISOString().split("T")[0])}
			>
				Volver a Hoy
			</button>
		{/if}
	</search>

	<nav>
		{#await setProviders()}
			<p>Cargando...</p>
		{:then _}
			<select bind:value={$providerId}>
				<option value="" selected>Todos</option>
				{#each $providers as provider}
					<option value={provider.id}>{provider.name}</option>
				{/each}
			</select>
		{/await}
		{#if $dateStore === new Date()
				.toISOString()
				.split("T")[0] && $providerId !== ""}
			<button
				transition:slide={{
					axis: "x",
					duration: 300,
				}}
				class="btn"
				onclick={async () => await addSupply($providerId)}
			>
				Nuevo Suministro
			</button>
		{/if}
	</nav>

	<footer>
		<section>
			<p>
				<b>Total Dia:</b>
				{moneyFormatter($derivedSuppliesData.totalSupplies)}
			</p>
			<p><b># Suministros:</b> {$derivedSuppliesData.totalSuppliesCount}</p>
		</section>

		<section>
			<p>
				<b>Total Proveedor:</b>
				{moneyFormatter($derivedSuppliesByProviderData.totalSupplies)}
			</p>
			<p>
				<b># Sumninstros Proveedor:</b>
				{$derivedSuppliesByProviderData.totalSuppliesCount}
			</p>
		</section>
	</footer>
</header>

<style>
	header {
		background-color: var(--accent-bg);
		padding: 1rem;
		border-radius: var(--border-radius);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	search,
	nav {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex: 1 1 400px;
		flex-wrap: wrap;

		& > * {
			flex: 1 1 100px;
		}

		button {
			flex: 1 1 auto;
		}
	}

	footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex: 2 1 100%;

		section {
			display: inline-flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 1rem;
		}
	}
</style>
