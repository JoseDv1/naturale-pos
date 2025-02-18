<script lang="ts">
	import { setUsers, users } from "@/lib/stores/users";
</script>

<ul>
	{#await setUsers() then _}
		{#each $users as user}
			<li>
				<h2>{user.name}</h2>
				<p><b>ID: </b> {user.id}</p>
				<p>
					<b>Rol: </b>
					{user.role === "ADMIN" ? "Administrador" : "Usuario"}
				</p>
			</li>
		{/each}
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
</style>
