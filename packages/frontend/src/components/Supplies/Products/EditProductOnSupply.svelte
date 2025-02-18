<script lang="ts">
	import type { Supply } from "@/lib/api/supplies";
	import { editProductOnSupply } from "@/lib/stores/supplies";

	interface Props {
		productOnSupply: Supply["supplyProducts"][0];
		thisEl?: HTMLDialogElement | null;
	}

	let { productOnSupply, thisEl = $bindable() }: Props = $props();

	export async function handleSubmitEditProductOnSupply(e: SubmitEvent) {
		e.preventDefault();
		const form = e.target as HTMLFormElement;
		const formData = new FormData(form);
		const data = {
			quantity: parseInt(formData.get("quantity") as string),
			unitPrice: parseFloat(formData.get("unitCost") as string),
		};

		await editProductOnSupply(
			productOnSupply.supplyId,
			productOnSupply.productId,
			data
		);
	}

	let editForm = $state<HTMLFormElement>();

	function handleEditQuantityChange(e: Event) {
		const qtyInput = e.currentTarget as HTMLInputElement;
		const qty = parseInt(qtyInput.value);
		const unitCostInput = editForm!.querySelector(
			'input[name="unitCost"]'
		) as HTMLInputElement;
		const totalInput = editForm!.querySelector(
			'input[name="total"]'
		) as HTMLInputElement;

		if (isNaN(qty) || qty < 1) {
			unitCostInput.disabled = true;
			totalInput.disabled = true;
			return;
		}

		const unitCost = parseFloat(unitCostInput.value);
		if (!isNaN(unitCost) && unitCost > 0) {
			totalInput.value = (qty * unitCost).toString();
		}

		const total = parseFloat(totalInput.value);
		if (!isNaN(total) && total > 0) {
			unitCostInput.value = (total / qty).toString();
		}

		unitCostInput.disabled = false;
		totalInput.disabled = false;
	}

	function handleEditUnitCostChange(e: Event) {
		const unitCostInput = e.currentTarget as HTMLInputElement;
		const unitCost = parseFloat(unitCostInput.value);
		const qtyInput = editForm!.querySelector(
			'input[name="quantity"]'
		) as HTMLInputElement;
		const totalInput = editForm!.querySelector(
			'input[name="total"]'
		) as HTMLInputElement;
		const qty = parseInt(qtyInput.value);

		if (isNaN(qty) || qty < 1) {
			totalInput.value = "";
		} else {
			totalInput.value = (qty * unitCost).toString();
		}
		totalInput.disabled = true;
	}

	function handleEditTotalCostChange(e: Event) {
		const totalInput = e.currentTarget as HTMLInputElement;
		const total = parseFloat(totalInput.value);
		const qtyInput = editForm!.querySelector(
			'input[name="quantity"]'
		) as HTMLInputElement;
		const unitCostInput = editForm!.querySelector(
			'input[name="unitCost"]'
		) as HTMLInputElement;
		const qty = parseInt(qtyInput.value);

		if (isNaN(qty) || qty < 1) {
			unitCostInput.value = "";
		} else {
			unitCostInput.value = (total / qty).toString();
		}
		unitCostInput.disabled = true;
	}
</script>

<dialog
	popover="auto"
	id={`
		edit-supply-${productOnSupply.supplyId}-${productOnSupply.productId}
	`}
	bind:this={thisEl}
>
	<div class="popover">
		<h2>
			Editar producto {productOnSupply.product.name} en el suministro {productOnSupply.supplyId}
		</h2>

		<form
			id={`edit-supply-${productOnSupply.supplyId}-${productOnSupply.productId}-form`}
			onsubmit={handleSubmitEditProductOnSupply}
			bind:this={editForm}
		>
			<label>
				Cantidad
				<input
					type="number"
					name="quantity"
					value={productOnSupply.quantity}
					required
					onchange={handleEditQuantityChange}
				/>
			</label>

			<div>
				<label>
					Precio unitario
					<input
						type="number"
						name="unitCost"
						value={productOnSupply.price}
						min="0"
						step="1"
						required
						onchange={handleEditUnitCostChange}
					/>
				</label>

				<label>
					<span> Precio Total</span>
					<input
						type="number"
						step="1"
						name="total"
						value={productOnSupply.price * productOnSupply.quantity}
						onchange={handleEditTotalCostChange}
					/>
				</label>
			</div>
		</form>
		<div class="buttons">
			<button
				class="danger"
				type="button"
				onclick={() => {
					thisEl?.hidePopover();
				}}
			>
				Cancelar
			</button>
			<button
				type="submit"
				class="success"
				form={`edit-supply-${productOnSupply.supplyId}-${productOnSupply.productId}-form`}
			>
				Editar
			</button>
		</div>
	</div>
</dialog>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
</style>
