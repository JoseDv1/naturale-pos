<script lang="ts">
	import { changePassword } from "@/lib/api/users";

	interface Props {
		thisEl: HTMLElement | null;
	}

	let { thisEl = $bindable() }: Props = $props();

	const handleSubmit = async (e: SubmitEvent) => {
		e.preventDefault();
		const form = e.target as HTMLFormElement;
		const formData = new FormData(form);
		const password = formData.get("password") as string;
		const confirmPassword = formData.get("confirm-password") as string;

		if (password !== confirmPassword) {
			alert("Las contraseñas no coinciden");
			return;
		}

		await changePassword(password);
		thisEl?.hidePopover();
		window.location.reload();
	};
</script>

<dialog popover="auto" bind:this={thisEl}>
	<h2>Cambiar Contraseña</h2>
	<form onsubmit={handleSubmit}>
		<label for="password"
			>Contraseña

			<input type="password" id="password" />
		</label>

		<label for="confirm-password"
			>Confirmar Contraseña

			<input type="password" id="confirm-password" />
		</label>

		<button type="submit">Cambiar Contraseña</button>
	</form>
</dialog>

<style>
	dialog {
		background-color: var(--background-color);
		border-radius: var(--border-radius);
		padding: 1rem;
	}

	form {
		display: grid;
		gap: 1rem;
	}

	label {
		display: grid;
		gap: 0.5rem;
	}
</style>
