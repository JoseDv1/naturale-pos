<script lang="ts">
  import Badge from '../atoms/Badge.svelte';

  interface Props {
    sale: any;
    oncancel: (id: string) => void;
    onview?: (sale: any) => void;
    oneditpayment?: (sale: any) => void;
  }

  let { sale, oncancel, onview, oneditpayment }: Props = $props();

  const canEditPayment = $derived(sale.status !== 'CANCELLED' && sale.shift?.status === 'OPEN');
</script>

<tr
  class="animate-fade-in clickable-sale-row"
  class:cancelled-row={sale.status === 'CANCELLED'}
  onclick={(e) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.btn-cancel-sale') && !target.closest('.btn-edit-payment')) {
      onview?.(sale);
    }
  }}
>
  <td><code>{sale.id.slice(0, 8).toUpperCase()}</code></td>
  <td>{new Date(sale.createdAt).toLocaleString()}</td>
  <td>{sale.user.name}</td>
  <td>
    <div class="exp-items-cell">
      {#each sale.items as item}
        <span>
          • {item.product.name}
          {#if item.variant}
            <span class="variant-sale-tag">({item.variant.name})</span>
          {/if}
          {#if item.notes}
            <small style="color: #f472b6; font-style: italic;">[{item.notes}]</small>
          {/if}
          (x{item.quantity}) @ ${Number(item.price).toLocaleString()}
        </span>
      {/each}
    </div>
  </td>
  <td>
    <div class="exp-items-cell">
      {#each sale.payments as pay}
        <span>
          {#if pay.method === 'CASH'}💵 Efectivo
          {:else if pay.method === 'CARD'}💳 Tarjeta
          {:else if pay.method === 'TRANSFER'}📲 Transferencia
          {:else if pay.method === 'INTERNAL'}🔄 Interno
          {/if}
          : ${pay.amount.toLocaleString()}
        </span>
      {/each}
    </div>
  </td>
  <td class="text-right"><strong>${sale.total.toLocaleString()}</strong></td>
  <td class="text-center">
    {#if sale.status === 'COMPLETED'}
      <Badge text="COMPLETADO" type="completed" />
    {:else if sale.status === 'TRANSFER_OUT'}
      <Badge text="TRASLADO OUT" type="transfer" />
    {:else if sale.status === 'CANCELLED'}
      <Badge text="ANULADO" type="cancelled" />
    {/if}
  </td>
  <td class="text-center">
    <div class="row-actions flex-center" style="gap: 6px;">
      <button
        type="button"
        class="btn-detail-sale"
        onclick={(e) => { e.stopPropagation(); onview?.(sale); }}
        title="Ver comprobante de venta"
        aria-label="Ver comprobante de venta"
      >
        🧾 Ver
      </button>
      {#if sale.status !== 'CANCELLED'}
        <button
          type="button"
          class="btn-edit-payment"
          onclick={(e) => {
            e.stopPropagation();
            if (canEditPayment) {
              oneditpayment?.(sale);
            }
          }}
          disabled={!canEditPayment}
          title={canEditPayment ? 'Editar métodos de pago' : 'No editable (Turno cerrado)'}
          aria-label="Editar métodos de pago"
        >
          💳 Editar
        </button>
        <button
          type="button"
          class="btn-cancel-sale"
          onclick={(e) => { e.stopPropagation(); oncancel(sale.id); }}
          title="Anular venta"
          aria-label="Anular venta"
        >
          Anular ✕
        </button>
      {:else}
        <span class="text-muted italic" style="font-size: 0.75rem;">Anulado</span>
      {/if}
    </div>
  </td>
</tr>

<style>
  .clickable-sale-row {
    cursor: pointer;
    transition: background-color 0.15s;
  }

  .clickable-sale-row:hover td {
    background: rgba(255, 255, 255, 0.03);
  }

  .exp-items-cell {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.82rem;
    text-align: left;
  }

  .variant-sale-tag {
    color: var(--color-general);
    font-weight: 600;
  }

  .btn-detail-sale {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-glass);
    color: var(--text-primary);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: var(--transition-fast);
    outline: none;
  }

  .btn-detail-sale:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: var(--color-general);
  }

  .btn-cancel-sale {
    background: rgba(244, 63, 94, 0.08);
    border: 1px solid rgba(244, 63, 94, 0.2);
    color: var(--color-danger);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: var(--transition-fast);
    outline: none;
  }

  .btn-cancel-sale:hover {
    background: var(--color-danger-glow);
    border-color: var(--color-danger);
  }

  .btn-edit-payment {
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.25);
    color: var(--color-general);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: var(--transition-fast);
    outline: none;
    white-space: nowrap;
  }

  .btn-edit-payment:hover:not(:disabled) {
    background: rgba(16, 185, 129, 0.2);
    border-color: var(--color-general);
  }

  .btn-edit-payment:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    border-color: rgba(255, 255, 255, 0.08);
    color: var(--text-muted);
  }

  .cancelled-row td {
    color: var(--text-muted) !important;
    background: rgba(244, 63, 94, 0.01);
  }
</style>
