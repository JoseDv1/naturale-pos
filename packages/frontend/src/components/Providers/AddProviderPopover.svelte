<script lang="ts">
	import { addProvider } from "@/lib/stores/providers";

	async function handleCreate(e: SubmitEvent) {
		e.preventDefault();
		const form = e.target as HTMLFormElement;
		const formData = new FormData(form);
		const data = {
			name: formData.get("name") as string,
			address: formData.get("address") as string,
			phone: formData.get("phone") as string,
			email: formData.get("email") as string,
		};

		await addProvider(data);
		form.reset();
	}
</script>

<dialog popover="auto" id="create-provider">
	<button popovertarget="create-provider" popovertargetaction="hide"
		>&times;</button
	>
	<h1>Añadir Proveedor</h1>
	<form onsubmit={handleCreate}>
		<label>
			<span>Nombre</span>
			<input type="text" name="name" autocomplete="off" />
		</label>

		<label>
			<span>Dirección</span>
			<input type="text" name="address" autocomplete="off" />
		</label>

		<label>
			<span>Teléfono</span>
			<input type="text" name="phone" autocomplete="off" />
		</label>

		<label>
			<span>Email</span>
			<input type="email" name="email" autocomplete="off" />
		</label>

		<button type="submit">Añadir</button>
	</form>
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
