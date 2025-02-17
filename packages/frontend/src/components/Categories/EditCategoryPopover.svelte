<script lang="ts">
	import { type Category } from "@/lib/api/categories";
	import { editCategory } from "@/lib/stores/categories";

	interface Props {
		category: Category;
	}

	let { category }: Props = $props();

	async function handleEdit(e: SubmitEvent) {
		e.preventDefault();
		const form = e.target as HTMLFormElement;
		const formData = new FormData(form);
		const data = {
			name: formData.get("name") as string,
			description: formData.get("description") as string,
		};
		await editCategory(category.id, data);
		form.reset();
	}
</script>

<dialog popover="auto" id={`edit-category-${category.id}`}>
	<button
		popovertarget={`edit-category-${category.id}`}
		popovertargetaction="hide">&times;</button
	>
	<h1>Editar Categoria</h1>
	<form onsubmit={handleEdit}>
		<label>
			<span>Nombre</span>
			<input
				type="text"
				name="name"
				autocomplete="off"
				defaultValue={category.name}
			/>
		</label>

		<label>
			<span>Descripción</span>
			<!-- svelte-ignore element_invalid_self_closing_tag -->
			<textarea
				name="description"
				autocomplete="off"
				value={category.description}
			/>
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
