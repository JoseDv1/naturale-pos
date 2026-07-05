<script lang="ts">
  interface Props {
    todo: { id: string; text: string; completed: boolean };
    ontoggle: (id: string) => void;
    ondelete: (id: string) => void;
  }

  let { todo, ontoggle, ondelete }: Props = $props();
</script>

<div class="todo-item" class:completed={todo.completed}>
  <label class="todo-label">
    <input type="checkbox" checked={todo.completed} onchange={() => ontoggle(todo.id)} />
    <span class="todo-text">{todo.text}</span>
  </label>
  <button class="remove-todo-btn" onclick={() => ondelete(todo.id)}>✕</button>
</div>

<style>
  .todo-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(255, 255, 255, 0.01);
    border: 1px solid var(--border-glass);
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    transition: var(--transition-fast);
    box-sizing: border-box;
    width: 100%;
  }

  .todo-item:hover {
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .todo-item.completed {
    opacity: 0.5;
  }

  .todo-item.completed .todo-text {
    text-decoration: line-through;
    color: var(--text-muted);
  }

  .todo-label {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    flex: 1;
  }

  .todo-label input {
    cursor: pointer;
    width: 16px;
    height: 16px;
  }

  .todo-text {
    font-size: 0.85rem;
    color: var(--text-primary);
  }

  .remove-todo-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: bold;
    padding: 2px 6px;
    transition: var(--transition-fast);
    outline: none;
  }

  .remove-todo-btn:hover {
    color: var(--color-danger);
  }
</style>
