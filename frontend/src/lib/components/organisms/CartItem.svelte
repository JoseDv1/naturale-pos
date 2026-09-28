<script lang="ts">
  import { untrack } from 'svelte';
  import type { CartItem as CartItemType } from '../../store';

  interface Props {
    item: CartItemType;
    onupdateqty: (productId: string, variantId: string | null, delta: number) => void;
    onsetqty?: (productId: string, variantId: string | null, qty: number) => void;
    onremove: (productId: string, variantId: string | null) => void;
    oncustomize?: () => void;
  }

  let { item, onupdateqty, onsetqty, onremove, oncustomize }: Props = $props();

  let unitPrice = $derived(
    item.unitPrice !== undefined
      ? Number(item.unitPrice)
      : (item.variant ? Number(item.variant.price) : Number(item.product.price))
  );
  let subtotal = $derived(unitPrice * item.quantity);
  let variantId = $derived(item.variant?.id || null);

  let isFocused = $state(false);
  let inputValue = $state<number | string>(untrack(() => item.quantity));

  $effect(() => {
    if (!isFocused) {
      inputValue = item.quantity;
    }
  });

  function handleFocus(e: FocusEvent) {
    isFocused = true;
    (e.currentTarget as HTMLInputElement).select();
  }

  function handleBlur() {
    isFocused = false;
    const val = parseInt(String(inputValue), 10);
    if (isNaN(val) || val <= 0) {
      inputValue = item.quantity;
    } else {
      applyQuantity(val);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      (e.currentTarget as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      inputValue = item.quantity;
      (e.currentTarget as HTMLInputElement).blur();
    }
  }

  function handleInput(e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    inputValue = target.value;
    const val = parseInt(target.value, 10);
    if (!isNaN(val) && val > 0) {
      applyQuantity(val);
    }
  }

  function applyQuantity(qty: number) {
    if (onsetqty) {
      onsetqty(item.product.id, variantId, qty);
    } else {
      const delta = qty - item.quantity;
      if (delta !== 0) {
        onupdateqty(item.product.id, variantId, delta);
      }
    }
  }
</script>

<div class="cart-item animate-fade-in">
  <div class="item-details">
    <div class="item-title-col">
      <span class="item-name">{item.product.name}</span>
      {#if item.variant}
        <span class="variant-chip">✨ {item.variant.name}</span>
      {/if}
      {#if item.notes}
        <span class="notes-chip">🍓 {item.notes}</span>
      {/if}
    </div>
    <span class="item-price">${unitPrice.toLocaleString()} c/u</span>
  </div>

  <div class="item-actions">
    <div class="qty-controls">
      <button
        type="button"
        class="qty-btn"
        onclick={() => onupdateqty(item.product.id, variantId, -1)}
        aria-label="Disminuir cantidad"
      >
        -
      </button>
      <input
        type="number"
        class="qty-input"
        min="1"
        step="1"
        value={inputValue}
        onfocus={handleFocus}
        onblur={handleBlur}
        oninput={handleInput}
        onkeydown={handleKeyDown}
        aria-label="Cantidad del producto"
      />
      <button
        type="button"
        class="qty-btn"
        onclick={() => onupdateqty(item.product.id, variantId, 1)}
        aria-label="Aumentar cantidad"
      >
        +
      </button>
    </div>
    
    <span class="item-subtotal">${subtotal.toLocaleString()}</span>

    <div class="action-buttons-group">
      {#if oncustomize}
        <button
          type="button"
          class="customize-btn"
          onclick={oncustomize}
          title="Personalizar adiciones y receta"
          aria-label="Personalizar adiciones"
        >
          🍓
        </button>
      {/if}
      <button
        type="button"
        class="remove-btn"
        onclick={() => onremove(item.product.id, variantId)}
        aria-label="Eliminar producto del carrito"
      >
        ❌
      </button>
    </div>
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

  .item-title-col {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .item-name {
    font-weight: 500;
    font-size: 0.92rem;
  }

  .variant-chip {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-general);
    background: var(--color-general-glow);
    padding: 2px 6px;
    border-radius: 4px;
    display: inline-block;
    width: fit-content;
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
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    overflow: hidden;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .qty-controls:focus-within {
    border-color: var(--color-general);
    box-shadow: 0 0 0 2px var(--color-general-glow);
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
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease, color 0.15s ease;
    user-select: none;
  }

  .qty-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--color-general);
  }

  .qty-input {
    width: 40px;
    height: 28px;
    text-align: center;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-primary);
    background: rgba(0, 0, 0, 0.2);
    border: none;
    border-left: 1px solid var(--border-glass);
    border-right: 1px solid var(--border-glass);
    outline: none;
    padding: 0 2px;
    font-family: inherit;
    -moz-appearance: textfield;
    appearance: textfield;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .qty-input::-webkit-inner-spin-button,
  .qty-input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .qty-input:focus {
    background: rgba(16, 185, 129, 0.15);
    color: #fff;
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

  .notes-chip {
    font-size: 0.72rem;
    color: #f472b6;
    background: rgba(236, 72, 153, 0.12);
    border: 1px solid rgba(236, 72, 153, 0.25);
    padding: 2px 6px;
    border-radius: 4px;
    display: inline-block;
    width: fit-content;
    line-height: 1.3;
    word-break: break-word;
  }

  .action-buttons-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .customize-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-glass);
    cursor: pointer;
    font-size: 0.85rem;
    padding: 3px 6px;
    border-radius: 4px;
    transition: all 0.15s ease;
  }

  .customize-btn:hover {
    background: rgba(236, 72, 153, 0.2);
    border-color: #f472b6;
  }
</style>
