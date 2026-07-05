<script lang="ts">
  interface Props {
    item: { product: any; quantity: number };
  }

  let { item }: Props = $props();
</script>

<div class="receipt-item">
  <span>{item.product.name} x{item.quantity}</span>
  <span>${(item.product.price * item.quantity).toLocaleString()}</span>
</div>

<style>
  .receipt-item {
    display: flex;
    justify-content: space-between;
    font-size: 0.9rem;
    color: var(--text-secondary);
    box-sizing: border-box;
    width: 100%;
  }
</style>
