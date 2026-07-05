<script lang="ts">
  import Badge from '../atoms/Badge.svelte';

  interface Props {
    sale: any;
    oncancel: (id: string) => void;
  }

  let { sale, oncancel }: Props = $props();
</script>

<tr class="animate-fade-in" class:cancelled-row={sale.status === 'CANCELLED'}>
  <td><code>{sale.id.slice(0, 8).toUpperCase()}</code></td>
  <td>{new Date(sale.createdAt).toLocaleString()}</td>
  <td>{sale.user.name}</td>
  <td>
    <div class="exp-items-cell">
      {#each sale.items as item}
        <span>• {item.product.name} (x{item.quantity}) @ ${item.price.toLocaleString()}</span>
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
    {#if sale.status !== 'CANCELLED'}
      <button class="btn-cancel-sale" onclick={() => oncancel(sale.id)} title="Anular venta">
        Anular ✕
      </button>
    {:else}
      <span class="text-muted italic">Anulado</span>
    {/if}
  </td>
</tr>

<style>
  .exp-items-cell {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.82rem;
    text-align: left;
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

  .cancelled-row td {
    color: var(--text-muted) !important;
    background: rgba(244, 63, 94, 0.01);
  }
</style>
