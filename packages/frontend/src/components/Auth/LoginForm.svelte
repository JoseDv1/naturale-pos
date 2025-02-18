<script lang="ts">
	import { apiClient } from "@/lib/api";
	let error = $state<string>("");

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
		} else {
			const status = res.status;
			switch (status) {
				case 401:
					error = "Usuario o contraseña incorrectos";
					break;
				case 404:
					error = "Usuario no encontrado";
					break;
			}
		}
	}
</script>

<form onsubmit={handleLogin}>
	<label for="username">
		<span>Usuario</span>
		<input
			type="text"
			id="username"
			name="username"
			autocomplete="off"
			required
		/>
	</label>

	<label for="password">
		<span>Contraseña</span>
		<input
			type="password"
			id="password"
			name="password"
			autocomplete="current-password"
			required
		/>
	</label>

	<button type="submit">Iniciar Sesion</button>
</form>

{#if error}
	<p class="error">{error}</p>
{/if}

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

	.error {
		color: hsl(from var(--color-error) h s 40%);
		background-color: var(--color-error);
		border-radius: 0.5rem;
		padding: 1rem;
		font-size: 1.5rem;
		font-weight: 500;
		margin-bottom: 1rem;
	}
</style>
