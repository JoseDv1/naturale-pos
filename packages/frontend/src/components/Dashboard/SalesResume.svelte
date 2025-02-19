<script lang="ts">
	import type { Sale } from "@/lib/api/sales";
	import { setSales, dateStore, sales } from "@/lib/stores/sales";
	import { moneyFormatter } from "@/lib/utils/formatters";
</script>

<main>
	<h2>Ventas</h2>
	<section>
		<input type="date" bind:value={$dateStore} />
		{#await setSales($dateStore)}
			<p>Cargandooo...</p>
		{:then _}
			<article>
				<p>
					<b>Total: </b>
					{moneyFormatter($sales.reduce((acc, sale) => acc + sale.total, 0))}
				</p>

				<p>
					<b>Ventas Efectivo: </b>
					{moneyFormatter(
						$sales
							.filter((sale) => sale.paymentMethod === "CASH")
							.reduce((acc, sale) => acc + sale.total, 0)
					)}
				</p>
				<p>
					<b>Ventas Tarjeta: </b>
					{moneyFormatter(
						$sales
							.filter((sale) => sale.paymentMethod === "CARD")
							.reduce((acc, sale) => acc + sale.total, 0)
					)}
				</p>

				<p>
					<b>Ventas Trasferencia: </b>
					{moneyFormatter(
						$sales
							.filter((sale) => sale.paymentMethod === "TRANSFER")
							.reduce((acc, sale) => acc + sale.total, 0)
					)}
				</p>
				<p>
					<b>Productos vendidos: </b>
					{$sales.reduce((acc, sale) => acc + sale.products.length, 0)}
				</p>

				<p>
					<b>Ventas: </b>
					{$sales.length}
				</p>
			</article>
		{/await}
	</section>
</main>

<style>
	main {
		flex: 0 1 calc(50% - 1rem);
		border-radius: var(--border-radius);
		background-color: var(--accent-color);
		padding: 1rem;
	}

	h2 {
		margin-bottom: 1rem;
	}

	section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	section article {
		padding: 1rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
	}
</style>
