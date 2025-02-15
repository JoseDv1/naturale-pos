<script lang="ts">
	import { apiClient } from "@/lib/api";
	import { navigate } from "astro:transitions/client";
	async function handleRegister(e: SubmitEvent) {
		e.preventDefault();
		const form = e.target as HTMLFormElement;
		const formData = new FormData(form);
		const data = {
			name: formData.get("name") as string,
			username: formData.get("username") as string,
			password: formData.get("password") as string,
		};

		const res = await apiClient.api.users.register.$post({ json: data });
		if (res.ok) {
			navigate("/login");
		}
	}
</script>

<form onsubmit={handleRegister}>
	<label for="name">
		<span>Nombre</span>
		<input
			type="text"
			id="name"
			name="name"
			placeholder="Alejandra Villegas..."
			autocomplete="off"
		/>
	</label>

	<label for="username">
		<span>Usuario</span>
		<input
			type="text"
			id="username"
			name="username"
			placeholder="Naturale..."
			autocomplete="off"
		/>
	</label>

	<label for="password">
		<span>Contraseña</span>
		<input type="password" id="password" name="password" />
	</label>

	<label for="confirm-password">
		<span>Confirmar contraseña</span>
		<input type="password" id="confirm-password" name="confirm-password" />
	</label>

	<button type="submit">Registrarse</button>
</form>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 2rem;
		width: 100%;
	}

	label {
		display: flex;
		flex-direction: column;
		font-size: 1.5rem;
		gap: 0.5rem;
		font-weight: 500;
	}
</style>
