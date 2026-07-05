<script lang="ts">
  interface Props {
    item: { product: any; quantity: number };
    onupdateqty: (productId: string, delta: number) => void;
    onremove: (productId: string) => void;
  }

  let { item, onupdateqty, onremove }: Props = $props();
</script>

<div class="cart-item animate-fade-in">
  <div class="item-details">
    <span class="item-name">{item.product.name}</span>
    <span class="item-price">${item.product.price.toLocaleString()} c/u</span>
  </div>

  <div class="item-actions">
    <div class="qty-controls">
      <button class="qty-btn" onclick={() => onupdateqty(item.product.id, -1)}>-</button>
      <span class="qty-val">{item.quantity}</span>
      <button class="qty-btn" onclick={() => onupdateqty(item.product.id, 1)}>+</button>
    </div>
    
    <span class="item-subtotal">${(item.product.price * item.quantity).toLocaleString()}</span>
    
    <button class="remove-btn" onclick={() => onremove(item.product.id)}>
      ❌
    </button>
  </div>
</div>

<style>
  .cart-item {
    padding: 14px 18px;
    border-bottom: 1px solid var(--border-glass);
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-sizing: border-box;
    width: 100%;
  }

  .item-details {
    display: flex;
    justify-content: space-between;
  }

  .item-name {
    font-weight: 500;
    font-size: 0.92rem;
  }

  .item-price {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .item-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .qty-controls {
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .qty-btn {
    border: none;
    background: transparent;
    color: var(--text-primary);
    width: 28px;
    height: 28px;
    cursor: pointer;
    font-weight: 600;
    outline: none;
  }
  .qty-btn:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .qty-val {
    width: 30px;
    text-align: center;
    font-size: 0.88rem;
    font-weight: 500;
  }

  .item-subtotal {
    font-weight: 600;
    font-size: 0.95rem;
  }

  .remove-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 0.9rem;
    padding: 4px;
    border-radius: 4px;
    outline: none;
  }
  .remove-btn:hover {
    background: rgba(244, 63, 94, 0.1);
  }
</style>
