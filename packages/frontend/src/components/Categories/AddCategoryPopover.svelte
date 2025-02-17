<script lang="ts">
	import { addCategory } from "@/lib/stores/categories";

	async function handleCreate(e: SubmitEvent) {
		e.preventDefault();
		const form = e.target as HTMLFormElement;
		const formData = new FormData(form);
		const data = {
			name: formData.get("name") as string,
			description: formData.get("description") as string,
		};

		await addCategory(data);
		form.reset();
	}
</script>

<dialog popover="auto" id="create-category">
	<button popovertarget="create-category" popovertargetaction="hide"
		>&times;</button
	>
	<h1>Añadir Categoria</h1>
	<form onsubmit={handleCreate}>
		<label>
			<span>Nombre</span>
			<input type="text" name="name" autocomplete="off" />
		</label>

		<label>
			<span>Descripción</span>
			<textarea name="description" autocomplete="off"></textarea>
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
