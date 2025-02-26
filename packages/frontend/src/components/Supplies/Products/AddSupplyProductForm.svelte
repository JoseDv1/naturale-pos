<script lang="ts">
	import { moneyFormatter } from "@/lib/utils/formatters";
	import { derived as derivable, writable } from "svelte/store";
	import { addProductToSupply } from "@/lib/stores/supplies";
	import { products } from "@/lib/stores/products";

	interface Props {
		supplyId: number;
		thisEl: HTMLDialogElement | null;
	}

	let { supplyId, thisEl = $bindable() }: Props = $props();
	const search = writable("");
	const searchedProducts = derivable(
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
	let thisForm = $state<HTMLFormElement>();

	let quantity = $state(0);
	let unitCost = $state(0);
	let totalCost = $state(0);

	async function handleSubmitAddSupplyProduct(e: SubmitEvent) {
		e.preventDefault();
		const form = e.target as HTMLFormElement;
		const formData = new FormData(form);
		const productId = formData.get("supplyProduct") as string;

		const data = {
			quantity,
			unitPrice: unitCost,
			productId,
		};

		if (data.quantity < 1 || data.unitPrice < 1) return;

		await addProductToSupply(supplyId, data);
		form.reset();
		(form.querySelector("input[type='search']") as HTMLInputElement)?.focus();
	}

	// Enable and disbale unitCost and total inputs when quantity changes
	function handleQuantityChange(e: Event) {
		const unitCostInput = thisForm!.querySelector(
			'input[name="unitCost"]'
		) as HTMLInputElement;
		const totalInput = thisForm!.querySelector(
			'input[name="total"]'
		) as HTMLInputElement;

		// Si no hay un cantidad valida, deshabilitar los inputs
		if (isNaN(quantity) || quantity < 1 || !quantity) {
			unitCostInput.disabled = true;
			totalInput.disabled = true;
			return;
		}

		// If the unit cost or total cost is already set, calculate it again
		if (!isNaN(unitCost) && unitCost > 0) {
			totalCost = quantity * unitCost;
		}

		if (!isNaN(totalCost) && totalCost > 0) {
			unitCost = totalCost / quantity;
		}

		unitCostInput.disabled = false;
		totalInput.disabled = false;
	}

	// Calculate total cost when unit cost changes
	function handleUnitCostChange(e: Event) {
		const totalInput = thisForm!.querySelector(
			'input[name="total"]'
		) as HTMLInputElement;

		if (isNaN(quantity) || quantity < 1 || !quantity) {
			totalInput.value = "";
		} else {
			totalCost = quantity * unitCost;
		}
		totalInput.disabled = true;
	}

	// Calculate untit cost when total cost changes
	function handleTotalCostChange(e: Event) {
		const unitCostInput = thisForm!.querySelector(
			'input[name="unitCost"]'
		) as HTMLInputElement;

		if (isNaN(quantity) || quantity < 1 || !quantity) {
			unitCostInput.value = "";
		} else {
			unitCost = totalCost / quantity;
		}
		unitCostInput.disabled = true;
	}
</script>

<dialog popover="auto" id={`add-detail-${supplyId}`} bind:this={thisEl!}>
	<div class="popover">
		<h2>Añadir producto al suministro #{supplyId}</h2>
		<form
			id={`add-detail-form-${supplyId}`}
			class="add-detail-form"
			onsubmit={handleSubmitAddSupplyProduct}
			bind:this={thisForm}
		>
			<input
				type="search"
				placeholder="Buscar producto..."
				bind:value={$search}
			/>
			{#each $searchedProducts as supplyProduct, i (supplyProduct.id)}
				<label>
					<span>
						<p>{supplyProduct.name}</p>
						<p>{moneyFormatter(supplyProduct.price)}</p>
					</span>
					<input
						type="radio"
						name="supplyProduct"
						value={supplyProduct.id}
						checked={i === 0}
					/>
				</label>
			{/each}
			<label>
				Cantidad
				<input
					type="number"
					min="1"
					name="quantity"
					step="1"
					onchange={handleQuantityChange}
					required
					bind:value={quantity}
				/>
			</label>

			<div>
				<label>
					<span> Precio Unitario</span>
					<input
						type="number"
						step="1"
						name="unitCost"
						disabled
						onchange={handleUnitCostChange}
						required
						bind:value={unitCost}
					/>
				</label>

				<label>
					<span> Precio Total</span>
					<input
						type="number"
						step="1"
						name="total"
						disabled
						onchange={handleTotalCostChange}
						bind:value={totalCost}
					/>
				</label>
			</div>
			<button form={`add-detail-form-${supplyId}`} type="submit">
				Añadir
			</button>
		</form>
	</div>
</dialog>

<style>
	form.add-detail-form {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	form.add-detail-form input[type="search"] {
		margin-bottom: 1rem;
	}

	form.add-detail-form label {
		display: inline-flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		border-radius: var(--border-radius);
		flex-wrap: wrap;
		line-height: 1;
	}

	form.add-detail-form label span {
		flex: 1;
		display: inline-flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	form.add-detail-form label:has(input[type="radio"]) {
		cursor: pointer;
	}

	form.add-detail-form label:has(input[type="radio"]):hover {
		background-color: hsl(from var(--text-color) h s l / 0.25);
		outline: 2px solid var(--text-color);
	}

	form.add-detail-form label:has(input[type="radio"]:checked) {
		background-color: hsl(from var(--text-color) h s l / 0.5);
		outline: 2px solid var(--text-color);
	}

	form.add-detail-form div {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 1rem;
	}

	input {
		min-width: 100px;
	}
</style>
