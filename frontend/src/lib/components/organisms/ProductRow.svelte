<script lang="ts">
  import Badge from '../atoms/Badge.svelte';

  interface Props {
    product: any;
    onedit: (p: any) => void;
    ondelete: (id: string) => void;
  }

  let { product: p, onedit, ondelete }: Props = $props();
</script>

<tr class="animate-fade-in">
  <td><code>{p.sku}</code></td>
  <td>
    <div class="product-info-cell">
      {#if p.imageUrl}
        <img src={p.imageUrl} alt={p.name} class="table-product-thumb" loading="lazy" />
      {:else}
        <div class="table-product-thumb placeholder">
          {p.department === 'MARKET' ? '🌿' : '☕'}
        </div>
      {/if}
      <div class="product-text-details">
        <strong class="product-name-txt">{p.name}</strong>
        {#if p.description}
          <span class="product-desc-txt">{p.description}</span>
        {/if}
      </div>
    </div>
  </td>
  <td>{p.category?.name || '—'}</td>
  <td>
    <Badge text={p.department === 'MARKET' ? 'Mercado' : 'Café'} type={p.department === 'MARKET' ? 'market' : 'cafe'} />
  </td>
  <td>
    {#if p.isRawMaterial}
      <span class="text-general">Insumo / M. Prima</span>
    {:else}
      <span class="text-secondary">Venta Directa</span>
    {/if}
  </td>
  <td class="text-right">${Number(p.cost).toLocaleString()}</td>
  <td class="text-right">${Number(p.price).toLocaleString()}</td>
  <td class="text-center">
    <span class="stock-badge" class:low-stock={p.stock <= 3 && !(p.department === 'CAFE' && p.stock >= 900)}>
      {p.department === 'CAFE' && p.stock >= 900 ? 'Ilimitado' : p.stock}
    </span>
  </td>
  <td class="text-center actions-cell">
    <button class="action-edit-btn" onclick={() => onedit(p)} title="Editar" aria-label="Editar producto">✏️</button>
    <button class="action-delete-btn" onclick={() => ondelete(p.id)} title="Eliminar" aria-label="Eliminar producto">🗑️</button>
  </td>
</tr>

<style>
  .product-info-cell {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .table-product-thumb {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-sm, 6px);
    object-fit: cover;
    flex-shrink: 0;
    border: 1px solid var(--border-glass);
    background: rgba(0, 0, 0, 0.15);
  }

  .table-product-thumb.placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    background: rgba(255, 255, 255, 0.04);
  }

  .product-text-details {
    display: flex;
    flex-direction: column;
  }

  .product-name-txt {
    display: block;
    font-size: 0.9rem;
    color: var(--text-primary);
  }

  .product-desc-txt {
    display: block;
    font-size: 0.72rem;
    color: var(--text-muted);
  }

  .text-general {
    color: var(--color-general);
    font-weight: 500;
  }

  .text-secondary {
    color: var(--text-secondary);
  }

  .stock-badge {
    font-size: 0.85rem;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-glass);
  }

  .stock-badge.low-stock {
    background: rgba(244, 63, 94, 0.12);
    color: var(--color-danger);
    border-color: rgba(244, 63, 94, 0.2);
  }

  .actions-cell {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  .action-edit-btn, .action-delete-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 1.05rem;
    padding: 4px;
    border-radius: 4px;
    transition: var(--transition-fast);
    outline: none;
  }

  .action-edit-btn:hover {
    background: rgba(16, 185, 129, 0.15);
  }

  .action-delete-btn:hover {
    background: rgba(244, 63, 94, 0.15);
  }
</style>
