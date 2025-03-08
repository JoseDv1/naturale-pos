<script lang="ts">
	let { thisEl = $bindable() } = $props();

	let from = $state(new Date().toISOString().split("T")[0]);
	const now = new Date();
	const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
	let to = $state(endOfMonth.toISOString().split("T")[0]);

	async function generateReport(event: SubmitEvent) {
		event.preventDefault();
		window.location.href = "/dashboard/reports?from=" + from + "&to=" + to;
	}
</script>

<dialog popover="auto" id="generate-report" bind:this={thisEl}>
	<button onclick={() => thisEl.hidePopover()} popovertargetaction="hide"
		>&times;</button
	>
	<h2>Generar Reporte</h2>

	<form onsubmit={generateReport}>
		<label for="from">Desde</label>
		<input type="date" id="from" bind:value={from} />

		<label for="to">Hasta</label>
		<input type="date" id="to" bind:value={to} />

		<button type="submit">Generar Reporte</button>
	</form>

	<div class="actions">
		<button
			onclick={() => {
				const now = new Date();
				from = now.toISOString().split("T")[0];
				to = now.toISOString().split("T")[0];
			}}>Hoy</button
		>
		<button
			onclick={() => {
				const now = new Date();
				const yesterday = new Date(now).setDate(now.getDate() - 1);
				from = new Date(yesterday).toISOString().split("T")[0];
				to = new Date(yesterday).toISOString().split("T")[0];
			}}>Ayer</button
		>
		<button
			onclick={() => {
				const now = new Date();
				const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
				const endOfWeek = new Date(
					now.setDate(now.getDate() - now.getDay() + 6)
				);
				from = startOfWeek.toISOString().split("T")[0];
				to = endOfWeek.toISOString().split("T")[0];
			}}>Esta semana</button
		>
		<button
			onclick={() => {
				const now = new Date();
				const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
				const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
				from = startOfMonth.toISOString().split("T")[0];
				to = endOfMonth.toISOString().split("T")[0];
			}}>Este mes</button
		>
		<button
			onclick={() => {
				const now = new Date();
				const startOfYear = new Date(now.getFullYear(), 0, 1);
				const endOfYear = new Date(now.getFullYear(), 11, 31);
				from = startOfYear.toISOString().split("T")[0];
				to = endOfYear.toISOString().split("T")[0];
			}}>Este año</button
		>
	</div>
</dialog>

<style>
	dialog form {
		display: flex;
		flex-direction: column;
	}

	dialog form label {
		margin-top: 1rem;
	}

	dialog form input {
		margin-top: 0.5rem;
	}

	dialog .actions {
		display: flex;
		flex-direction: row;
		justify-content: space-around;
	}

	dialog button {
		margin-top: 1rem;
	}
</style>
