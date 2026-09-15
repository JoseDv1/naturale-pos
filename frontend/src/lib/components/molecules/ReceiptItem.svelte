<script lang="ts">
  interface Props {
    item: { product: any; quantity: number; variant?: any };
  }

  let { item }: Props = $props();
  let unitPrice = $derived(item.variant ? Number(item.variant.price) : Number(item.product.price));
  let subtotal = $derived(unitPrice * item.quantity);
</script>

<div class="receipt-item">
  <span>
    {item.product.name}
    {#if item.variant}
      <small class="variant-tag">({item.variant.name})</small>
    {/if}
    x{item.quantity}
  </span>
  <span>${subtotal.toLocaleString()}</span>
</div>

<style>
  .receipt-item {
    display: flex;
    justify-content: space-between;
    font-size: 0.9rem;
    color: var(--text-secondary);
    box-sizing: border-box;
    width: 100%;
    align-items: center;
    gap: 8px;
  }

  .variant-tag {
    color: var(--color-general);
    font-weight: 600;
  }
</style>
