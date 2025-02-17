<script lang="ts">
	import type { Sale } from "@/lib/api/sales";
	import { editProductOnSale } from "@/lib/stores/sales";
	interface Props {
		productOnSale: Sale["products"][0];
		thisEl?: HTMLDialogElement | null;
	}

	let { productOnSale, thisEl = $bindable() }: Props = $props();

	export async function handleSumbitEditProductOnSale(e: SubmitEvent) {
		e.preventDefault();
		const form = e.target as HTMLFormElement;
		const formData = new FormData(form);
		const data = {
			quantity: parseInt(formData.get("quantity") as string),
			unitPrice: parseFloat(formData.get("unitCost") as string),
		};

		await editProductOnSale(
			productOnSale.saleId,
			productOnSale.productId,
			data
		);

		thisEl?.hidePopover();
	}
</script>

<dialog
	popover="auto"
	id={`
	edit-detail-${productOnSale.saleId}-${productOnSale.productId}`}
	bind:this={thisEl}
>
	<div class="popover">
		<h2>
			Editar producto {productOnSale.product.name} en la venta #{productOnSale.saleId}
		</h2>

		<form
			id={`edit-detail-${productOnSale.saleId}-${productOnSale.productId}-form`}
			onsubmit={handleSumbitEditProductOnSale}
		>
			<label>
				Cantidad
				<input
					type="number"
					name="quantity"
					value={productOnSale.quantity}
					min="1"
					required
				/>
			</label>

			<label>
				Precio unitario
				<input
					type="number"
					name="unitCost"
					value={productOnSale.price}
					min="0"
					step="0.01"
					required
				/>
			</label>
		</form>
		<div class="buttons">
			<button
				class="danger"
				type="button"
				onclick={() => {
					thisEl?.hidePopover();
				}}
			>
				❌ Cancelar
			</button>
			<button
				type="submit"
				form={`edit-detail-${productOnSale.saleId}-${productOnSale.productId}-form`}
				>✏️ Editar</button
			>
		</div>
	</div>
</dialog>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-block: 1rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
</style>
