<script lang="ts">
	import { setUsers, users } from "@/lib/stores/users";
	import ChangePasswordDialog from "./ChangePasswordDialog.svelte";

	let changePassDialog = $state<HTMLDialogElement>();
</script>

<header>
	<button onclick={() => changePassDialog?.showPopover()}
		>Cambiar mi contraseña</button
	>

	<a href="/register" class="btn"> Añadir usuario </a>
</header>

<ul>
	{#await setUsers() then _}
		{#each $users as user}
			<li>
				<h2>{user.name}</h2>
				<p><b>ID: </b> {user.id}</p>
				<p><b>UName: </b> {user.username}</p>
				<p>
					<b>Rol: </b>
					{user.role === "ADMIN" ? "Administrador" : "Usuario"}
				</p>
			</li>
		{/each}

		<ChangePasswordDialog bind:thisEl={changePassDialog!} />
	{/await}
</ul>

<style>
	ul {
		padding: 1rem;
		background-color: var(--accent-color);
		border-radius: var(--border-radius);
	}

	li {
		margin-bottom: 1rem;
		padding: 1rem;
		background-color: var(--background-color);
		border-radius: var(--border-radius);
	}

	header {
		padding: 1rem;
		background-color: var(--accent-color);
		border-radius: var(--border-radius);
		margin-bottom: 1rem;
		display: flex;
		justify-content: space-between;
	}
</style>
