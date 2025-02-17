<script lang="ts">
	import { setSales, dateStore, sales } from "@/lib/stores/sales";
	import { setProducts } from "@/lib/stores/products";
	import SaleRow from "./SaleRow.svelte";
</script>

<section>
	<table>
		<thead>
			<tr>
				<th>Id</th>
				<th>Hora</th>
				<th>Usuario</th>
				<th>Metodo de pago</th>
				<th>Total</th>
			</tr>
		</thead>
		<tbody>
			<!-- Load products due to add productsOnSale Dialogs -->
			{#await setProducts() then _}
				{#await setSales($dateStore) then _}
					{#each $sales as sale (sale.id)}
						<SaleRow {sale} />
					{:else}
						<tr>
							<td colspan="5">No hay ventas</td>
						</tr>
					{/each}
				{:catch error}
					<tr>
						<td colspan="5">Error: {error.message}</td>
					</tr>
				{/await}
			{/await}
		</tbody>
	</table>
</section>

<style>
	section {
		padding: 1rem;
		background-color: var(--accent-color);
		border-radius: var(--border-radius);
		overflow: auto;
	}

	td[colspan="5"] {
		text-align: center;
		border-radius: var(--border-radius);
		background-color: var(--background-color);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		border-radius: var(--border-radius);
	}

	th {
		padding: 0.5rem 1rem;
		text-align: left;

		&:first-child {
			border-radius: var(--border-radius) 0 0 var(--border-radius);
		}

		&:last-child {
			border-radius: 0 var(--border-radius) var(--border-radius) 0;
		}
	}

	tbody > :global(tr:not(:has([colspan="5"]))) {
		border-radius: var(--border-radius);
		cursor: pointer;

		&:nth-of-type(odd) {
			background-color: var(--background-color);
		}

		&:hover {
			background-color: hsl(from var(--text-color) h s l / 0.25);
			outline: 1px solid var(--text-color);
		}
	}

	tbody tr td {
		padding: 0.5rem 1rem;
	}

	tbody > :global(tr:has(+ [popover]:popover-open)) {
		background-color: hsl(from var(--text-color) h s l / 0.5);
		outline: 1px solid var(--text-color);
		z-index: 1;
	}
</style>
