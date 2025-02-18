<script lang="ts">
	import {
		dateStore,
		setSupplies,
		derivedSuppliesProvider,
	} from "@/lib/stores/supplies";
	import SupplyRow from "./SupplyRow.svelte";
	import { setProducts } from "@/lib/stores/products";
</script>

<section>
	<table>
		<thead>
			<tr>
				<th>Id</th>
				<th>Hora</th>
				<th>Proveedor</th>
				<th>Total</th>
			</tr>
		</thead>
		<tbody>
			<!-- Load products due to add productsOnSupply Dialogs -->
			{#await setProducts() then _}
				{#await setSupplies($dateStore) then _}
					{#each $derivedSuppliesProvider as supply (supply.id)}
						<SupplyRow {supply} />
					{:else}
						<tr>
							<td colspan="6">No hay suministros</td>
						</tr>
					{/each}
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

	td[colspan="6"] {
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

	tbody > :global(tr:not(:has([colspan="6"]))) {
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
