<script lang="ts">
	import { apiClient } from "@/lib/api";
	async function handleLogin(e: SubmitEvent) {
		e.preventDefault();
		const form = e.target as HTMLFormElement;
		const formData = new FormData(form);
		const data = {
			username: formData.get("username") as string,
			password: formData.get("password") as string,
		};

		const res = await apiClient.api.users.login.$post({ json: data });
		if (res.ok) {
			window.location.href = "/dashboard";
		}
	}
</script>

<form onsubmit={handleLogin}>
	<label for="username">
		<span>Usuario</span>
		<input type="text" id="username" name="username" autocomplete="off" />
	</label>

	<label for="password">
		<span>Contraseña</span>
		<input type="password" id="password" name="password" />
	</label>

	<button type="submit">Iniciar Sesion</button>
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
