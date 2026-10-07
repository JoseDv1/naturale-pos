<script lang="ts">
  interface Props {
    transfer: any;
  }

  let { transfer: t }: Props = $props();
</script>

<tr class="animate-fade-in">
  <td>{new Date(t.createdAt).toLocaleString()}</td>
  <td>
    {@render productBadge(t.product, t.variant, t.fromDepartment)}
  </td>
  <td>
    {#if t.targetProduct}
      {@render productBadge(t.targetProduct, t.targetVariant, t.toDepartment)}
    {:else}
      <em class="text-muted">Consumido en Cocina ({t.toDepartment === 'MARKET' ? 'Mercado' : 'Café'})</em>
    {/if}
  </td>
  <td class="text-center">x{t.quantity}</td>
  <td class="text-right">${t.unitCost.toLocaleString()}</td>
  <td class="text-right"><strong>${t.totalCost.toLocaleString()}</strong></td>
  <td>{t.user?.name || 'Sistema'}</td>
</tr>

{#snippet productBadge(product: any, variant: any, department: string)}
  <div class="product-header">
    <strong class={department === 'MARKET' ? 'text-market' : 'text-cafe'}>
      {product.name}
    </strong>
    {#if variant}
      <span class="variant-badge">
        {variant.name}
      </span>
    {/if}
  </div>
  <span class="product-desc-txt">
    SKU: {variant?.sku || product.sku}
    <span class="dept-badge {department === 'MARKET' ? 'badge-market' : 'badge-cafe'}">
      {department === 'MARKET' ? 'Mercado' : 'Café'}
    </span>
  </span>
{/snippet}

<style>
  .product-header {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .product-desc-txt {
    display: flex;
    align-items: center;
    font-size: 0.72rem;
    color: var(--text-muted);
    margin-top: 2px;
  }

  .variant-badge {
    display: inline-block;
    font-size: 0.68rem;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgba(14, 165, 233, 0.12);
    color: #0284c7;
    border: 1px solid rgba(14, 165, 233, 0.25);
    font-weight: 600;
  }

  .text-market {
    color: var(--color-market);
  }

  .text-cafe {
    color: var(--color-cafe);
  }

  .dept-badge {
    display: inline-block;
    font-size: 0.62rem;
    padding: 1px 4px;
    border-radius: 3px;
    margin-left: 6px;
    font-weight: 600;
  }

  .badge-market {
    background: rgba(22, 163, 74, 0.08);
    color: var(--color-market);
    border: 1px solid rgba(22, 163, 74, 0.15);
  }

  .badge-cafe {
    background: rgba(217, 119, 6, 0.08);
    color: var(--color-cafe);
    border: 1px solid rgba(217, 119, 6, 0.15);
  }
</style>
