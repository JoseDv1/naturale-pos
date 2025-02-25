<script lang="ts">
	import { moneyFormatter } from "@/lib/utils/formatters";
	import { derived, writable } from "svelte/store";
	import { products } from "@/lib/stores/products";
	import { addProductToSale } from "@/lib/stores/sales";

	interface Props {
		saleId: number;
		thisEl: HTMLDialogElement | null;
	}

	let { saleId, thisEl = $bindable() }: Props = $props();

	const search = writable("");
	const searchedProducts = derived(
		[search, products],
		([$search, $productsStore]) => {
			if (!$search) return $productsStore;

			const matchName =
				$productsStore.filter((product) =>
					product.name.toLowerCase().includes($search.toLowerCase())
				) || [];

			const matchCategory =
				($search.startsWith("#") &&
					$productsStore.filter((product) =>
						product.category.name
							.toLowerCase()
							.includes($search.slice(1).toLowerCase())
					)) ||
				[];

			const matchId =
				($search.startsWith("$") &&
					$productsStore.filter((product) =>
						product.id.toLowerCase().includes($search.slice(1).toLowerCase())
					)) ||
				[];

			return matchName.concat(matchCategory, matchId);
		}
	);
	async function handleSubmitCreateProductOnSale(e: SubmitEvent) {
		e.preventDefault();
		const form = e.target as HTMLFormElement;
		const formData = new FormData(form);
		const data = {
			productId: formData.get("product") as string,
			quantity: parseInt(formData.get("quantity") as string),
		};

		await addProductToSale(saleId, data);
		(form.querySelector("input[type='search']") as HTMLInputElement)?.focus();
	}
</script>

<dialog popover="auto" id={`add-detail-${saleId}`} bind:this={thisEl}>
	<button
		popovertarget={`add-detail-${saleId}`}
		popovertargetaction="hide"
		class="danger"
	>
		&times;
	</button>
	<div class="popover">
		<h2>Añadir producto a la venta #{saleId}</h2>

		<form
			id={`add-detail-form-${saleId}`}
			class="add-detail-form"
			onsubmit={handleSubmitCreateProductOnSale}
		>
			<input
				type="search"
				placeholder="Buscar producto..."
				bind:value={$search}
			/>
			{#each $searchedProducts as product, i (product.id)}
				<label>
					<span>
						<p>{product.name}</p>
						<p>{moneyFormatter(product.price)}</p>
					</span>

					<input
						type="radio"
						name="product"
						value={product.id}
						checked={i === 0}
					/>
				</label>
			{/each}
			<label>
				Cantidad
				<input type="number" min="1" value="1" name="quantity" />
			</label>
			<button type="submit">Añadir</button>
		</form>
	</div>
</dialog>

<style>
	h2 {
		margin-bottom: 1rem;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;

		input[type="search"] {
			margin-bottom: 1rem;
		}

		label {
			display: inline-flex;
			justify-content: space-between;
			align-items: center;
			gap: 1rem;
			padding: 1rem;
			border-radius: var(--border-radius);
			flex-wrap: wrap;
			line-height: 1;

			span {
				flex: 1;
				display: inline-flex;
				flex-direction: column;
				gap: 0.5rem;
			}

			&:has(input[type="radio"]) {
				cursor: pointer;

				&:hover {
					background-color: hsl(from var(--text-color) h s l / 0.25);
					outline: 2px solid var(--text-color);
				}
			}

			&:has(input[type="radio"]:checked) {
				background-color: hsl(from var(--text-color) h s l / 0.5);
				outline: 2px solid var(--text-color);
			}
		}
	}
</style>
