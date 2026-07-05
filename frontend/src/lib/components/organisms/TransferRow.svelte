<script lang="ts">
  interface Props {
    transfer: any;
  }

  let { transfer: t }: Props = $props();
</script>

<tr class="animate-fade-in">
  <td>{new Date(t.createdAt).toLocaleString()}</td>
  <td>
    <strong class={t.fromDepartment === 'MARKET' ? 'text-market' : 'text-cafe'}>
      {t.product.name}
    </strong>
    <span class="product-desc-txt">
      SKU: {t.product.sku}
      <span class="dept-badge {t.fromDepartment === 'MARKET' ? 'badge-market' : 'badge-cafe'}">
        {t.fromDepartment === 'MARKET' ? 'Mercado' : 'Café'}
      </span>
    </span>
  </td>
  <td>
    {#if t.targetProduct}
      <strong class={t.toDepartment === 'MARKET' ? 'text-market' : 'text-cafe'}>
        {t.targetProduct.name}
      </strong>
      <span class="product-desc-txt">
        SKU: {t.targetProduct.sku}
        <span class="dept-badge {t.toDepartment === 'MARKET' ? 'badge-market' : 'badge-cafe'}">
          {t.toDepartment === 'MARKET' ? 'Mercado' : 'Café'}
        </span>
      </span>
    {:else}
      <em class="text-muted">Consumido en Cocina ({t.toDepartment === 'MARKET' ? 'Mercado' : 'Café'})</em>
    {/if}
  </td>
  <td class="text-center">x{t.quantity}</td>
  <td class="text-right">${t.unitCost.toLocaleString()}</td>
  <td class="text-right"><strong>${t.totalCost.toLocaleString()}</strong></td>
  <td>{t.user.name}</td>
</tr>

<style>
  .product-desc-txt {
    display: flex;
    align-items: center;
    font-size: 0.72rem;
    color: var(--text-muted);
    margin-top: 2px;
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
