<script lang="ts">
  import { untrack } from 'svelte';
  import type { CartItem as CartItemType } from '../../store';

  interface Props {
    item: CartItemType;
    onupdateqty: (productId: string, variantId: string | null, delta: number) => void;
    onsetqty?: (productId: string, variantId: string | null, qty: number) => void;
    onsetprice?: (productId: string, variantId: string | null, price: number | null) => void;
    onremove: (productId: string, variantId: string | null) => void;
    oncustomize?: () => void;
  }

  let { item, onupdateqty, onsetqty, onsetprice, onremove, oncustomize }: Props = $props();

  let catalogPrice = $derived(
    item.variant ? Number(item.variant.price) : Number(item.product.price)
  );
  let unitPrice = $derived(
    item.unitPrice !== undefined ? Number(item.unitPrice) : catalogPrice
  );
  let isCustomPrice = $derived(
    item.unitPrice !== undefined && item.unitPrice !== catalogPrice
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

  // Price inline editing state
  let isEditingPrice = $state(false);
  let priceInputValue = $state<number | string>(untrack(() => unitPrice));
  let priceInputEl = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (!isEditingPrice) {
      priceInputValue = unitPrice;
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

  function startEditingPrice() {
    if (!onsetprice) return;
    priceInputValue = unitPrice;
    isEditingPrice = true;
    setTimeout(() => {
      if (priceInputEl) {
        priceInputEl.focus();
        priceInputEl.select();
      }
    }, 20);
  }

  function cancelEditingPrice() {
    isEditingPrice = false;
    priceInputValue = unitPrice;
  }

  function savePrice() {
    if (!isEditingPrice) return;
    isEditingPrice = false;
    const parsed = Math.round(Number(priceInputValue));
    if (isNaN(parsed) || parsed < 0) {
      priceInputValue = unitPrice;
      return;
    }
    if (parsed === catalogPrice) {
      if (onsetprice) {
        onsetprice(item.product.id, variantId, null);
      }
    } else {
      if (onsetprice) {
        onsetprice(item.product.id, variantId, parsed);
      }
    }
  }

  function handlePriceKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      savePrice();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditingPrice();
    }
  }

  function resetToCatalogPrice(e: MouseEvent) {
    e.stopPropagation();
    if (onsetprice) {
      onsetprice(item.product.id, variantId, null);
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

    <div class="price-display-wrapper">
      {#if isEditingPrice}
        <div class="inline-price-editor">
          <span class="currency-prefix">$</span>
          <input
            type="number"
            class="price-edit-input"
            min="0"
            step="100"
            bind:value={priceInputValue}
            bind:this={priceInputEl}
            onblur={savePrice}
            onkeydown={handlePriceKeyDown}
            aria-label="Precio unitario"
          />
          <button
            type="button"
            class="btn-price-action confirm"
            onmousedown={(e) => { e.preventDefault(); savePrice(); }}
            title="Confirmar precio"
            aria-label="Confirmar precio"
          >
            ✓
          </button>
          <button
            type="button"
            class="btn-price-action cancel"
            onmousedown={(e) => { e.preventDefault(); cancelEditingPrice(); }}
            title="Cancelar edición"
            aria-label="Cancelar edición"
          >
            ✕
          </button>
        </div>
      {:else}
        <div class="price-pill-row">
          <button
            type="button"
            class="btn-price-pill"
            class:custom-price={isCustomPrice}
            onclick={startEditingPrice}
            title={isCustomPrice
              ? `Precio editado manualmente (Catálogo: $${catalogPrice.toLocaleString()}). Click para cambiar.`
              : 'Click para editar precio unitario'}
            aria-label="Editar precio unitario"
          >
            <span class="price-value">${unitPrice.toLocaleString()} c/u</span>
            {#if isCustomPrice}
              <span class="custom-badge" title="Precio modificado">✏️</span>
            {:else}
              <span class="edit-hint-icon">✏️</span>
            {/if}
          </button>
          {#if isCustomPrice}
            <button
              type="button"
              class="btn-revert-price"
              onclick={resetToCatalogPrice}
              title={`Restablecer precio de catálogo ($${catalogPrice.toLocaleString()})`}
              aria-label="Restablecer precio de catálogo"
            >
              ↺
            </button>
          {/if}
        </div>
      {/if}
    </div>
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
    align-items: flex-start;
    gap: 8px;
  }

  .item-title-col {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    min-width: 0;
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

  .price-display-wrapper {
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

  .price-pill-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .btn-price-pill {
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-size: 0.8rem;
    font-weight: 500;
    padding: 2px 6px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: all 0.15s ease;
    font-family: inherit;
    user-select: none;
  }

  .btn-price-pill:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: var(--border-glass);
    color: var(--text-primary);
  }

  .btn-price-pill.custom-price {
    background: rgba(245, 158, 11, 0.12);
    border-color: rgba(245, 158, 11, 0.35);
    color: #fbbf24;
    font-weight: 600;
  }

  .btn-price-pill.custom-price:hover {
    background: rgba(245, 158, 11, 0.2);
    border-color: rgba(245, 158, 11, 0.55);
  }

  .edit-hint-icon {
    font-size: 0.7rem;
    opacity: 0.35;
    transition: opacity 0.15s ease;
  }

  .btn-price-pill:hover .edit-hint-icon {
    opacity: 0.9;
  }

  .custom-badge {
    font-size: 0.7rem;
  }

  .btn-revert-price {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-glass);
    color: var(--text-secondary);
    font-size: 0.8rem;
    font-weight: bold;
    width: 22px;
    height: 22px;
    border-radius: 4px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition: all 0.15s ease;
  }

  .btn-revert-price:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.4);
    color: #f87171;
  }

  .inline-price-editor {
    display: flex;
    align-items: center;
    gap: 3px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    padding: 2px 4px;
  }

  .currency-prefix {
    font-size: 0.8rem;
    color: var(--text-secondary);
    font-weight: 600;
  }

  .price-edit-input {
    width: 65px;
    height: 24px;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid var(--border-glass);
    border-radius: 3px;
    color: var(--text-primary);
    font-size: 0.85rem;
    font-weight: 600;
    text-align: right;
    padding: 0 4px;
    font-family: inherit;
    outline: none;
    -moz-appearance: textfield;
    appearance: textfield;
  }

  .price-edit-input::-webkit-inner-spin-button,
  .price-edit-input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .price-edit-input:focus {
    border-color: var(--color-general);
    box-shadow: 0 0 0 1px var(--color-general-glow);
  }

  .btn-price-action {
    border: none;
    height: 24px;
    padding: 0 6px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: bold;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    outline: none;
    transition: background 0.15s ease;
  }

  .btn-price-action.confirm {
    background: rgba(16, 185, 129, 0.25);
    color: #10b981;
  }

  .btn-price-action.confirm:hover {
    background: rgba(16, 185, 129, 0.45);
    color: #fff;
  }

  .btn-price-action.cancel {
    background: rgba(244, 63, 94, 0.2);
    color: #f43f5e;
  }

  .btn-price-action.cancel:hover {
    background: rgba(244, 63, 94, 0.4);
    color: #fff;
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
