<script lang="ts">
  import Badge from '../atoms/Badge.svelte';

  interface Props {
    expense: any;
  }

  let { expense: exp }: Props = $props();
</script>

<tr class="animate-fade-in">
  <td>{new Date(exp.date || exp.createdAt).toLocaleString()}</td>
  <td>
    <strong class="expense-desc-txt">{exp.description}</strong>
  </td>
  <td>
    <span class="category-tag">{exp.category.toUpperCase()}</span>
  </td>
  <td>
    <Badge
      text={exp.department === 'MARKET' ? 'Mercado' : exp.department === 'CAFE' ? 'Café' : 'General'}
      type={exp.department === 'MARKET' ? 'market' : exp.department === 'CAFE' ? 'cafe' : 'general'}
    />
  </td>
  <td>
    {#if exp.items && exp.items.length > 0}
      <div class="exp-items-cell">
        {#each exp.items as item}
          <span>• {item.product.name} (x{item.quantity})</span>
        {/each}
      </div>
    {:else}
      <span class="text-muted italic">N/A (Gasto Administrativo)</span>
    {/if}
  </td>
  <td class="text-right">
    <strong class="text-danger">${exp.amount.toLocaleString()}</strong>
  </td>
  <td>{exp.user?.name || 'Sistema'}</td>
</tr>

<style>
  .expense-desc-txt {
    font-size: 0.9rem;
    color: var(--text-primary);
  }

  .category-tag {
    font-size: 0.72rem;
    background: rgba(255, 255, 255, 0.05);
    padding: 3px 8px;
    border-radius: 4px;
    font-weight: 500;
  }

  .exp-items-cell {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.82rem;
    text-align: left;
  }

  .text-danger {
    color: var(--color-danger);
  }
</style>
