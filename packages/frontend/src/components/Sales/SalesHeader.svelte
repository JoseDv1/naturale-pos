<script lang="ts">
	import { slide } from "svelte/transition";
	import { addSale, dateStore, sales } from "@/lib/stores/sales";
	import { moneyFormatter } from "@/lib/utils/formatters";
</script>

<header>
	<h1>
		Total Dia: {moneyFormatter(
			$sales.reduce((acc, sale) => acc + sale.total, 0)
		)}
	</h1>
	<input
		type="date"
		name="sales-date"
		id="sales-date"
		bind:value={$dateStore}
	/>
	{#if $dateStore !== new Date().toISOString().split("T")[0]}
		<button
			transition:slide={{
				axis: "x",
				duration: 300,
			}}
			class="btn"
			onclick={() => ($dateStore = new Date().toISOString().split("T")[0])}
		>
			Volver a Hoy
		</button>
	{/if}
	{#if $dateStore === new Date().toISOString().split("T")[0]}
		<button
			transition:slide={{
				axis: "x",
				duration: 300,
			}}
			class="btn"
			onclick={async () => await addSale()}>Nueva Venta</button
		>
	{/if}

	<footer></footer>
</header>

<style>
	header {
		background-color: var(--accent-color);
		padding: 1rem;
		border-radius: var(--border-radius);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 1rem;
	}

	h1 {
		flex: 1;
		view-transition-name: title;
	}
</style>
