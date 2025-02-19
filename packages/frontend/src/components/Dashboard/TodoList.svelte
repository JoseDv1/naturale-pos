<script lang="ts">
	interface Todo {
		id: number;
		text: string;
		completed: boolean;
	}
	let todos = $state<Todo[]>(
		JSON.parse(
			localStorage.getItem("tasks") ??
				JSON.stringify([{ id: 0, text: "", completed: false }])
		)
	);

	// Save this todos in the local storage
	$effect(() => {
		localStorage.setItem("tasks", JSON.stringify(todos));
	});

	const addTodo = () => {
		todos = [...todos, { id: todos.length, text: "", completed: false }];
	};

	const removeTodo = (id: number) => {
		todos = todos.filter((todo) => todo.id !== id);
	};
</script>

<main class="dash">
	<h2>Lista de tareas</h2>
	<section>
		{#each todos as todo (todo.id)}
			<div>
				<input type="checkbox" bind:checked={todo.completed} />
				<input
					type="text"
					bind:value={todo.text}
					placeholder="Escribe aqui tu tarea..."
				/>
				{#if todo.completed}
					<button onclick={() => removeTodo(todo.id)}> 🗑️ </button>
				{/if}
			</div>
		{/each}
		<button onclick={() => addTodo()}> Añadir Tarea </button>
	</section>
</main>

<style>
	main {
		flex: 0 1 calc(50% - 1rem);
		border-radius: var(--border-radius);
		background-color: var(--accent-color);
		padding: 1rem;
	}

	section {
		display: flex;
		flex-direction: column;
	}

	section div {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	section > button {
		margin: 0.75rem 0 0 auto;
	}

	input[type="text"] {
		flex: 1;
		border-bottom: 1px solid var(--text-color);
		background-color: transparent;
		border-radius: 0;

		&:focus {
			outline: none;
		}
	}

	input[type="checkbox"] {
		appearance: none;
		width: 1rem;
		height: 1rem;
		padding: 0;
		border: 1px solid var(--text-color);
		border-radius: 0.25rem;
		cursor: pointer;

		&:checked {
			background-color: var(--text-color);
		}
	}

	input[type="checkbox"]:checked + input[type="text"] {
		text-decoration: line-through;
	}
</style>
