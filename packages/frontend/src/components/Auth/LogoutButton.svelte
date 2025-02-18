<script>
	import { apiClient } from "@/lib/api";
</script>

<button
	onclick={async () => {
		await apiClient.api.users.logout.$get();
		window.location.reload();
	}}
>
	Cerrar Sesion
</button>
