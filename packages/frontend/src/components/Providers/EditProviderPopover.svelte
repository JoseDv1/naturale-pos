<script lang="ts">
	import { type Provider } from "@/lib/api/providers";
	import { editProvider } from "@/lib/stores/providers";

	interface Props {
		provider: Provider;
	}

	let { provider }: Props = $props();

	async function handleEdit(e: SubmitEvent) {
		e.preventDefault();
		const form = e.target as HTMLFormElement;
		const formData = new FormData(form);
		const data = {
			name: formData.get("name") as string,
			address: formData.get("address") as string,
			phone: formData.get("phone") as string,
			email: formData.get("email") as string,
		};
		await editProvider(provider.id, data);
		form.reset();
	}
</script>

<dialog popover="auto" id={`edit-provider-${provider.id}`}>
	<button
		popovertarget={`edit-provider-${provider.id}`}
		popovertargetaction="hide">×</button
	>
	<h1>Editar Proveedor</h1>
	<form onsubmit={handleEdit}>
		<label>
			<span>Nombre</span>
			<input
				type="text"
				name="name"
				autocomplete="off"
				defaultValue={provider.name}
			/>
		</label>

		<label>
			<span>Dirección</span>
			<input
				type="text"
				name="address"
				autocomplete="off"
				defaultValue={provider.address ?? ""}
			/>
		</label>

		<label>
			<span>Teléfono</span>
			<input
				type="text"
				name="phone"
				autocomplete="off"
				defaultValue={provider.phone ?? ""}
			/>
		</label>

		<label>
			<span>Email</span>
			<input
				type="email"
				name="email"
				autocomplete="off"
				defaultValue={provider.email ?? ""}
			/>
		</label>

		<button type="submit">Guardar</button>
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
