<script lang="ts">
  import Badge from '../atoms/Badge.svelte';

  interface Props {
    product: any;
    onedit?: (p: any) => void;
    ondelete?: (id: string) => void;
    onquickstock?: (p: any) => void;
  }

  let { product: p, onedit, ondelete, onquickstock }: Props = $props();

  let activeVariants = $derived((p.variants || []).filter((v: any) => v.active !== false));
  let hasVariants = $derived(activeVariants.length > 0);
  let minVariantPrice = $derived(hasVariants ? Math.min(...activeVariants.map((v: any) => Number(v.price))) : Number(p.price));
  let maxVariantPrice = $derived(hasVariants ? Math.max(...activeVariants.map((v: any) => Number(v.price))) : Number(p.price));
  let minVariantCost = $derived(hasVariants ? Math.min(...activeVariants.map((v: any) => Number(v.cost ?? 0))) : Number(p.cost));
  let maxVariantCost = $derived(hasVariants ? Math.max(...activeVariants.map((v: any) => Number(v.cost ?? 0))) : Number(p.cost));
  let totalStock = $derived(hasVariants ? activeVariants.reduce((acc: number, v: any) => acc + Number(v.stock || 0), 0) : Number(p.stock));
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
        {#if hasVariants}
          <span class="row-variants-pill" title={activeVariants.map((v: any) => `${v.name}: $${Number(v.price).toLocaleString()} (Stock: ${v.stock})`).join('\n')}>
            ✨ {activeVariants.length} var: {activeVariants.map((v: any) => v.name).join(', ')}
          </span>
        {/if}
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
  <td class="text-right">
    {#if hasVariants && minVariantCost !== maxVariantCost}
      ${minVariantCost.toLocaleString()} - ${maxVariantCost.toLocaleString()}
    {:else}
      ${Number(hasVariants ? minVariantCost : p.cost).toLocaleString()}
    {/if}
  </td>
  <td class="text-right">
    {#if hasVariants && minVariantPrice !== maxVariantPrice}
      <strong>${minVariantPrice.toLocaleString()} - ${maxVariantPrice.toLocaleString()}</strong>
    {:else}
      <strong>${Number(hasVariants ? minVariantPrice : p.price).toLocaleString()}</strong>
    {/if}
  </td>
  <td class="text-center">
    {#if onquickstock}
      <button
        type="button"
        class="stock-btn-wrapper"
        onclick={() => onquickstock(p)}
        title="Hacer clic para editar la cantidad en stock"
        aria-label="Editar stock de {p.name}"
      >
        <span class="stock-badge" class:low-stock={totalStock <= 3 && !(p.department === 'CAFE' && (p.stock >= 900 || totalStock >= 900))}>
          {#if p.department === 'CAFE' && (p.stock >= 900 || totalStock >= 900)}
            Ilimitado
          {:else}
            {totalStock}
          {/if}
          <span class="stock-edit-hint">✏️</span>
        </span>
      </button>
    {:else}
      <span class="stock-badge" class:low-stock={totalStock <= 3 && !(p.department === 'CAFE' && (p.stock >= 900 || totalStock >= 900))}>
        {#if p.department === 'CAFE' && (p.stock >= 900 || totalStock >= 900)}
          Ilimitado
        {:else}
          {totalStock}
        {/if}
      </span>
    {/if}
  </td>
  <td class="text-center actions-cell">
    {#if onquickstock}
      <button class="action-stock-btn" onclick={() => onquickstock(p)} title="Ajustar Stock" aria-label="Ajustar stock de {p.name}">📦</button>
    {/if}
    {#if onedit}
      <button class="action-edit-btn" onclick={() => onedit(p)} title="Editar" aria-label="Editar producto {p.name}">✏️</button>
    {/if}
    {#if ondelete}
      <button class="action-delete-btn" onclick={() => ondelete(p.id)} title="Eliminar" aria-label="Eliminar producto {p.name}">🗑️</button>
    {/if}
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

  .row-variants-pill {
    display: inline-block;
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--color-general);
    background: var(--color-general-glow);
    padding: 1px 6px;
    border-radius: 4px;
    margin-top: 2px;
    width: fit-content;
    white-space: nowrap;
    max-width: 260px;
    overflow: hidden;
    text-overflow: ellipsis;
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

  .stock-btn-wrapper {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0;
    font-family: inherit;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .stock-badge {
    font-size: 0.85rem;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-glass);
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: var(--transition-fast);
  }

  .stock-btn-wrapper:hover .stock-badge {
    border-color: var(--color-general);
    background: rgba(16, 185, 129, 0.12);
    color: var(--color-general);
  }

  .stock-edit-hint {
    font-size: 0.65rem;
    opacity: 0.7;
  }

  .stock-badge.low-stock {
    background: rgba(244, 63, 94, 0.12);
    color: var(--color-danger);
    border-color: rgba(244, 63, 94, 0.2);
  }

  .actions-cell {
    display: flex;
    gap: 6px;
    justify-content: center;
  }

  .action-edit-btn, .action-delete-btn, .action-stock-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 1.05rem;
    padding: 4px;
    border-radius: 4px;
    transition: var(--transition-fast);
    outline: none;
  }

  .action-stock-btn:hover {
    background: rgba(59, 130, 246, 0.15);
  }

  .action-edit-btn:hover {
    background: rgba(16, 185, 129, 0.15);
  }

  .action-delete-btn:hover {
    background: rgba(244, 63, 94, 0.15);
  }
</style>
