<script lang="ts">
	import type { Sale } from "@/lib/api/sales";
	import { swapPaymentMethod } from "@/lib/stores/sales";

	interface Props {
		saleId: number;
		thisEl: HTMLDialogElement | null;
		paymentMethod: Sale["paymentMethod"];
	}

	let { saleId, thisEl = $bindable(), paymentMethod }: Props = $props();

	const handleSubmit = async (e: SubmitEvent) => {
		e.preventDefault();
		await swapPaymentMethod(saleId, paymentMethod);
		thisEl?.hidePopover();
	};
</script>

<dialog popover="auto" bind:this={thisEl}>
	<button
		popovertargetaction="hide"
		onclick={() => {
			thisEl?.hidePopover();
		}}>&times;</button
	>
	<form onsubmit={handleSubmit}>
		<div>
			<label>
				<input
					type="radio"
					bind:group={paymentMethod}
					name="paymentMethod"
					value="CASH"
				/>
				Efectivo
			</label>
			<label>
				<input
					type="radio"
					bind:group={paymentMethod}
					name="paymentMethod"
					value="CARD"
				/>
				Tarjeta
			</label>
			<label>
				<input
					type="radio"
					bind:group={paymentMethod}
					name="paymentMethod"
					value="TRANSFER"
				/>
				Transferencia
			</label>
		</div>

		<button type="submit">Cambiar</button>
	</form>
</dialog>

<style>
	form {
		display: flex;
		flex-direction: column;
		margin-block: 1.5rem 1rem;
	}

	label {
		display: flex;
		align-items: center;
		padding: 0.5rem 1rem;
		border: 1px solid var(--text-color);
		border-radius: 0.5rem;
	}

	input[type="radio"] {
		margin-right: 0.5rem;
		appearance: none;
		width: 1rem;
		height: 1rem;
		border: 1px solid var(--text-color);
		border-radius: 50%;
		padding: 0;

		&:checked {
			background-color: var(--accent-color);
		}

		&:focus {
			outline: none;
			box-shadow: 0 0 0 2px var(--accent-color);
		}
	}

	label:hover,
	label:has(input:checked) {
		background-color: var(--text-color);
		color: var(--background-color);

		input {
			background-color: var(--background-color);
		}
	}

	button {
		margin-top: 1rem;
	}

	form > div {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
</style>
