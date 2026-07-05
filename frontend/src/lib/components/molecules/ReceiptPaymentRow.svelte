<script lang="ts">
  interface Props {
    pay: { method: string; amount: number };
  }

  let { pay }: Props = $props();
</script>

<div class="receipt-payment-row">
  <span>
    {#if pay.method === 'CASH'}💵 Efectivo
    {:else if pay.method === 'CARD'}💳 Tarjeta
    {:else if pay.method === 'TRANSFER'}📲 Transferencia
    {/if}
  </span>
  <span>${pay.amount.toLocaleString()}</span>
</div>

<style>
  .receipt-payment-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    color: var(--text-secondary);
    box-sizing: border-box;
    width: 100%;
  }
</style>
