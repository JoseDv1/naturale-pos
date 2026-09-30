<script lang="ts">
  import { untrack } from 'svelte';
  import type { ProductModifier, ProductVariant } from '../../store';

  interface Props {
    product: any;
    selectedVariant?: ProductVariant | null;
    initialModifiers?: ProductModifier[];
    initialNotes?: string;
    initialQuantity?: number;
    onconfirm: (result: {
      variant: ProductVariant | null;
      selectedModifiers: ProductModifier[];
      notes: string;
      unitPrice: number;
      quantity: number;
    }) => void;
    onclose: () => void;
  }

  let {
    product,
    selectedVariant = null,
    initialModifiers = [],
    initialNotes = '',
    initialQuantity = 1,
    onconfirm,
    onclose,
  }: Props = $props();

  // Selected variant state
  let currentVariant = $state<ProductVariant | null>(
    untrack(() => selectedVariant || (product.variants && product.variants.length > 0 ? product.variants[0] : null))
  );

  // Available modifiers from product
  let availableModifiers = $derived<ProductModifier[]>(
    product.modifiers && product.modifiers.length > 0
      ? product.modifiers
      : [
          // Helpful defaults for café/fresh items if product has no configured modifiers yet
          { name: 'Mermelada de Frutos Rojos', price: 2000 },
          { name: 'Fruta Extra (Fresas frescas)', price: 1500 },
          { name: 'Banano en rodajas', price: 1000 },
          { name: 'Granola Artesanal Extra', price: 1500 },
          { name: 'Mantequilla de Maní 100% natural', price: 2000 },
          { name: 'Miel de Abejas pura', price: 1000 },
          { name: 'Semillas de Chía', price: 1000 },
        ]
  );

  function initSelectedMap(): Record<string, boolean> {
    const map: Record<string, boolean> = {};
    if (initialModifiers && initialModifiers.length > 0) {
      for (const m of initialModifiers) {
        map[m.name] = true;
      }
    }
    return map;
  }

  // Track selected modifier names or objects
  let selectedMap = $state<Record<string, boolean>>(untrack(() => initSelectedMap()));

  // Custom addition fields
  let customAddName = $state('');
  let customAddPrice = $state<string | number>('');
  let customAdditionsList = $state<Array<{ name: string; price: number }>>([]);

  // Preparation notes
  let notes = $state(untrack(() => initialNotes || ''));
  let quantity = $state(untrack(() => (initialQuantity > 0 ? initialQuantity : 1)));
  let isQtyFocused = $state(false);
  let qtyInputVal = $state<number | string>(untrack(() => (initialQuantity > 0 ? initialQuantity : 1)));

  $effect(() => {
    if (!isQtyFocused) {
      qtyInputVal = quantity;
    }
  });

  function handleQtyFocus(e: FocusEvent) {
    isQtyFocused = true;
    (e.currentTarget as HTMLInputElement).select();
  }

  function handleQtyBlur() {
    isQtyFocused = false;
    const val = parseInt(String(qtyInputVal), 10);
    if (isNaN(val) || val <= 0) {
      quantity = 1;
      qtyInputVal = 1;
    } else {
      quantity = val;
      qtyInputVal = val;
    }
  }

  function handleQtyInput(e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    qtyInputVal = target.value;
    const val = parseInt(target.value, 10);
    if (!isNaN(val) && val > 0) {
      quantity = val;
    }
  }

  function handleQtyKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      (e.currentTarget as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      qtyInputVal = quantity;
      (e.currentTarget as HTMLInputElement).blur();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onclose();
    }
  }

  // Derived base unit price
  let basePrice = $derived.by(() => {
    if (currentVariant) return Number(currentVariant.price);
    return Number(product.price || 0);
  });

  // Selected additions total
  let additionsSum = $derived.by(() => {
    let sum = 0;
    for (const mod of availableModifiers) {
      if (selectedMap[mod.name]) {
        sum += Number(mod.price || 0);
      }
    }
    for (const c of customAdditionsList) {
      sum += Number(c.price || 0);
    }
    return sum;
  });

  let unitPrice = $derived(basePrice + additionsSum);
  let lineTotal = $derived(unitPrice * quantity);

  function toggleModifier(mod: ProductModifier) {
    selectedMap[mod.name] = !selectedMap[mod.name];
  }

  function handleAddCustomModifier() {
    const name = customAddName.trim();
    if (!name) return;
    const priceNum = parseFloat(String(customAddPrice)) || 0;
    customAdditionsList.push({ name, price: priceNum });
    customAddName = '';
    customAddPrice = '';
  }

  function removeCustomAddition(index: number) {
    customAdditionsList.splice(index, 1);
  }

  function handleConfirm() {
    const selectedMods: ProductModifier[] = [];

    for (const mod of availableModifiers) {
      if (selectedMap[mod.name]) {
        selectedMods.push(mod);
      }
    }

    for (const c of customAdditionsList) {
      selectedMods.push({
        name: c.name,
        price: c.price,
      });
    }

    // Build human-readable recipe / additions description
    const parts: string[] = [];
    if (selectedMods.length > 0) {
      const modStrings = selectedMods.map((m) =>
        m.price > 0 ? `+ ${m.name} (+$${Number(m.price).toLocaleString()})` : `+ ${m.name}`
      );
      parts.push(modStrings.join(', '));
    }

    if (notes.trim()) {
      parts.push(`Nota: ${notes.trim()}`);
    }

    const fullNotes = parts.join(' | ');

    onconfirm({
      variant: currentVariant,
      selectedModifiers: selectedMods,
      notes: fullNotes,
      unitPrice,
      quantity,
    });
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#snippet variantPill(v: ProductVariant)}
  <button
    type="button"
    class="variant-pill-btn"
    class:active={currentVariant?.id === v.id}
    onclick={() => (currentVariant = v)}
    aria-pressed={currentVariant?.id === v.id}
  >
    <span class="v-name">{v.name}</span>
    <span class="v-price">${Number(v.price).toLocaleString()}</span>
  </button>
{/snippet}

{#snippet modifierCard(mod: ProductModifier)}
  <button
    type="button"
    class="modifier-card"
    class:selected={selectedMap[mod.name]}
    onclick={() => toggleModifier(mod)}
    aria-pressed={selectedMap[mod.name]}
  >
    <div class="checkbox-indicator" aria-hidden="true">
      {selectedMap[mod.name] ? '✓' : ''}
    </div>
    <div class="mod-info">
      <span class="mod-name">{mod.name}</span>
      <span class="mod-price" class:free={Number(mod.price) === 0}>
        {Number(mod.price) > 0 ? `+$${Number(mod.price).toLocaleString()}` : 'Incluido'}
      </span>
    </div>
  </button>
{/snippet}

<div
  class="modal-overlay flex-center animate-fade-in"
  role="dialog"
  aria-modal="true"
  aria-labelledby="custom-modal-title"
  tabindex="-1"
  onclick={(e) => { if (e.target === e.currentTarget) onclose(); }}
  onkeydown={(e) => { if (e.key === 'Escape') onclose(); }}
>
  <div class="modal-container animate-scale-up" role="document">
    <!-- Header -->
    <header class="modal-header">
      <div class="header-info">
        <div class="header-icon-badge" aria-hidden="true">
          <span>🍓</span>
        </div>
        <div>
          <h2 id="custom-modal-title">{product.name}</h2>
          <p class="header-sub">Personalizar receta, adiciones y preparación</p>
        </div>
      </div>
      <button type="button" class="close-modal-btn" onclick={onclose} aria-label="Cerrar modal">✕</button>
    </header>

    <!-- Scrollable Body -->
    <div class="modal-body-scroll scroll-y flex-1">
      <!-- Variant Selector if exists -->
      {#if product.variants && product.variants.length > 0}
        <section class="section-block">
          <span class="section-label">
            <span class="section-badge-num">1</span> Tamaño / Variante Base:
          </span>
          <div class="variants-pill-group">
            {#each product.variants as v (v.id)}
              {@render variantPill(v)}
            {/each}
          </div>
        </section>
      {/if}

      <!-- Additions / Recipe Modifiers Selection -->
      <section class="section-block">
        <div class="section-header-row">
          <span class="section-label">
            <span class="section-badge-num">{product.variants && product.variants.length > 0 ? '2' : '1'}</span> Adiciones e Ingredientes Extras:
          </span>
          <span class="section-hint">Selecciona los ingredientes deseados</span>
        </div>

        <div class="modifiers-grid">
          {#each availableModifiers as mod (mod.name)}
            {@render modifierCard(mod)}
          {/each}
        </div>
      </section>

      <!-- Custom Addition Input -->
      <section class="section-block custom-addition-box">
        <div class="custom-addition-header">
          <span class="custom-addition-icon" aria-hidden="true">✨</span>
          <span class="section-label-inner">¿Deseas agregar una adición diferente?</span>
        </div>
        <div class="custom-addition-row">
          <input
            type="text"
            placeholder="Ej. Fruta Kiwi, Leche de coco..."
            bind:value={customAddName}
            class="custom-input name-input"
            aria-label="Nombre de adición personalizada"
            onkeydown={(e) => { if (e.key === 'Enter') handleAddCustomModifier(); }}
          />
          <input
            type="number"
            placeholder="+$ Valor (ej. 1500)"
            bind:value={customAddPrice}
            class="custom-input price-input"
            aria-label="Precio de adición personalizada"
            min="0"
            step="100"
            onkeydown={(e) => { if (e.key === 'Enter') handleAddCustomModifier(); }}
          />
          <button
            type="button"
            class="btn-add-custom"
            onclick={handleAddCustomModifier}
            disabled={!customAddName.trim()}
          >
            + Añadir
          </button>
        </div>

        {#if customAdditionsList.length > 0}
          <div class="custom-tags-container">
            {#each customAdditionsList as c, idx (idx)}
              <span class="custom-tag">
                <span>{c.name} {c.price > 0 ? `(+$${Number(c.price).toLocaleString()})` : ''}</span>
                <button type="button" class="btn-remove-tag" onclick={() => removeCustomAddition(idx)} aria-label={`Quitar adición ${c.name}`}>✕</button>
              </span>
            {/each}
          </div>
        {/if}
      </section>

      <!-- Preparation Notes -->
      <section class="section-block">
        <label for="prep-notes" class="section-label">
          <span class="section-badge-num">{product.variants && product.variants.length > 0 ? '3' : '2'}</span> Instrucciones Especiales / Nota de Cocina:
        </label>
        <input
          type="text"
          id="prep-notes"
          bind:value={notes}
          placeholder="Ej. Sin endulzante, poco hielo, para llevar, empacar aparte..."
          class="notes-input"
        />
      </section>

      <!-- Quantity Selector -->
      <section class="section-block flex-row-between quantity-section">
        <span class="section-label">Cantidad a preparar:</span>
        <div class="quantity-control-group">
          <button
            type="button"
            class="qty-btn"
            onclick={() => { if (quantity > 1) quantity--; }}
            disabled={quantity <= 1}
            aria-label="Reducir cantidad"
          >
            −
          </button>
          <input
            type="number"
            class="qty-input"
            min="1"
            step="1"
            value={qtyInputVal}
            onfocus={handleQtyFocus}
            onblur={handleQtyBlur}
            oninput={handleQtyInput}
            onkeydown={handleQtyKeyDown}
            aria-label="Cantidad a agregar"
          />
          <button
            type="button"
            class="qty-btn"
            onclick={() => quantity++}
            aria-label="Aumentar cantidad"
          >
            +
          </button>
        </div>
      </section>
    </div>

    <!-- Footer with Dynamic Live Price & Action -->
    <footer class="modal-footer-custom">
      <div class="price-breakdown">
        <span class="unit-breakdown">
          Base: ${basePrice.toLocaleString()} {#if additionsSum > 0}+ Extras: ${additionsSum.toLocaleString()}{/if}
        </span>
        <div class="total-line">
          Total: <strong class="total-amount">${lineTotal.toLocaleString()}</strong>
        </div>
      </div>

      <div class="footer-actions">
        <button type="button" class="btn-cancel" onclick={onclose}>
          Cancelar
        </button>
        <button type="button" class="btn-confirm" onclick={handleConfirm}>
          <span>✨ Agregar al Pedido</span>
          <span class="confirm-price-pill">${lineTotal.toLocaleString()}</span>
        </button>
      </div>
    </footer>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.55);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 1050;
    padding: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow-y: auto;
  }

  .modal-container {
    width: 100%;
    max-width: 600px;
    max-height: 92vh;
    display: flex;
    flex-direction: column;
    background: #ffffff;
    border: 1px solid rgba(16, 185, 129, 0.22);
    border-radius: var(--radius-lg, 20px);
    box-shadow: 0 20px 45px -10px rgba(11, 38, 20, 0.22), 0 0 0 1px rgba(16, 185, 129, 0.08);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 22px;
    border-bottom: 1px solid rgba(16, 185, 129, 0.16);
    background: linear-gradient(135deg, rgba(4, 120, 87, 0.07) 0%, rgba(242, 247, 244, 0.95) 100%);
  }

  .header-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-icon-badge {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: rgba(236, 72, 153, 0.12);
    border: 1px solid rgba(236, 72, 153, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .modal-header h2 {
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0;
    color: var(--text-primary, #112217);
    line-height: 1.2;
  }

  .header-sub {
    font-size: 0.8rem;
    color: var(--text-secondary, #2d4f38);
    margin: 2px 0 0;
  }

  .close-modal-btn {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.04);
    border: 1px solid rgba(0, 0, 0, 0.08);
    font-size: 1.05rem;
    color: var(--text-secondary, #2d4f38);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition: all 0.15s ease;
  }

  .close-modal-btn:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.25);
    transform: scale(1.05);
  }

  .modal-body-scroll {
    padding: 20px 22px;
    gap: 18px;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    background: #ffffff;
  }

  .section-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .section-label {
    font-size: 0.88rem;
    font-weight: 700;
    color: var(--text-primary, #112217);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .section-badge-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    background: var(--color-general-glow, rgba(4, 120, 87, 0.12));
    color: var(--color-general, #047857);
    border: 1px solid rgba(4, 120, 87, 0.2);
    border-radius: 50%;
    font-size: 0.72rem;
    font-weight: 700;
  }

  .section-hint {
    font-size: 0.75rem;
    color: var(--text-muted, #3d5e47);
  }

  .variants-pill-group {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .variant-pill-btn {
    display: flex;
    flex-direction: column;
    padding: 8px 14px;
    background: #f8faf8;
    border: 1.5px solid rgba(16, 185, 129, 0.2);
    border-radius: var(--radius-sm, 8px);
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }

  .variant-pill-btn:hover {
    background: #eef7f2;
    border-color: var(--color-general, #047857);
  }

  .variant-pill-btn.active {
    background: rgba(4, 120, 87, 0.08);
    border-color: var(--color-general, #047857);
    box-shadow: 0 0 0 2px var(--color-general-glow, rgba(4, 120, 87, 0.15));
  }

  .variant-pill-btn .v-name {
    font-weight: 600;
    font-size: 0.88rem;
    color: var(--text-primary, #112217);
  }

  .variant-pill-btn.active .v-name {
    color: var(--color-general, #047857);
    font-weight: 700;
  }

  .variant-pill-btn .v-price {
    font-size: 0.8rem;
    color: var(--color-cafe, #b45309);
    font-weight: 600;
    font-family: inherit;
  }

  .modifiers-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 9px;
  }

  .modifier-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: #ffffff;
    border: 1.5px solid #dce8e0;
    border-radius: var(--radius-sm, 8px);
    cursor: pointer;
    text-align: left;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
    transition: all 0.15s ease;
  }

  .modifier-card:hover {
    background: #f4faf6;
    border-color: rgba(4, 120, 87, 0.45);
    transform: translateY(-1px);
    box-shadow: 0 3px 8px rgba(4, 120, 87, 0.08);
  }

  .modifier-card.selected {
    background: linear-gradient(135deg, rgba(4, 120, 87, 0.08) 0%, rgba(16, 185, 129, 0.14) 100%);
    border-color: var(--color-general, #047857);
    box-shadow: 0 2px 10px var(--color-general-glow, rgba(4, 120, 87, 0.15));
  }

  .checkbox-indicator {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    border: 1.5px solid #cbd5e1;
    background: #f8fafc;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85rem;
    font-weight: 800;
    color: transparent;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .modifier-card.selected .checkbox-indicator {
    border-color: var(--color-general, #047857);
    background: var(--color-general, #047857);
    color: #ffffff;
    box-shadow: 0 2px 4px rgba(4, 120, 87, 0.25);
  }

  .mod-info {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  .mod-name {
    font-size: 0.86rem;
    font-weight: 600;
    color: var(--text-primary, #112217);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .modifier-card.selected .mod-name {
    color: var(--color-general-hover, #065f46);
    font-weight: 700;
  }

  .mod-price {
    font-size: 0.78rem;
    color: var(--color-cafe, #b45309);
    font-weight: 600;
  }

  .mod-price.free {
    color: var(--text-muted, #3d5e47);
    font-weight: 500;
    font-size: 0.74rem;
  }

  .custom-addition-box {
    background: #f7faf8;
    padding: 14px;
    border-radius: var(--radius-sm, 8px);
    border: 1.5px dashed rgba(16, 185, 129, 0.35);
  }

  .custom-addition-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .custom-addition-icon {
    font-size: 1rem;
  }

  .section-label-inner {
    font-size: 0.84rem;
    font-weight: 600;
    color: var(--text-secondary, #2d4f38);
  }

  .custom-addition-row {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }

  .custom-input {
    padding: 8px 12px;
    background: #ffffff;
    border: 1.5px solid #d1ded5;
    border-radius: var(--radius-sm, 8px);
    color: var(--text-primary, #112217);
    font-size: 0.85rem;
    transition: all 0.15s ease;
  }

  .custom-input:focus {
    outline: none;
    border-color: var(--color-general, #047857);
    box-shadow: 0 0 0 3px var(--color-general-glow, rgba(4, 120, 87, 0.12));
    background: #ffffff;
  }

  .name-input {
    flex: 2;
  }

  .price-input {
    flex: 1;
    min-width: 100px;
  }

  .btn-add-custom {
    padding: 8px 14px;
    background: var(--color-cafe, #b45309);
    color: #ffffff;
    border: none;
    border-radius: var(--radius-sm, 8px);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-add-custom:hover:not(:disabled) {
    background: var(--color-cafe-hover, #92400e);
    box-shadow: 0 2px 8px var(--color-cafe-glow, rgba(180, 83, 9, 0.2));
    transform: translateY(-1px);
  }

  .btn-add-custom:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .custom-tags-container {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 8px;
  }

  .custom-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: rgba(180, 83, 9, 0.1);
    border: 1px solid rgba(180, 83, 9, 0.25);
    border-radius: 9999px;
    font-size: 0.78rem;
    font-weight: 600;
    color: #92400e;
  }

  .btn-remove-tag {
    background: none;
    border: none;
    color: #be123c;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 700;
    padding: 0;
    line-height: 1;
  }

  .btn-remove-tag:hover {
    color: #9f1239;
  }

  .notes-input {
    padding: 10px 14px;
    background: #ffffff;
    border: 1.5px solid #d1ded5;
    border-radius: var(--radius-sm, 8px);
    color: var(--text-primary, #112217);
    font-size: 0.88rem;
    width: 100%;
    transition: all 0.15s ease;
  }

  .notes-input:focus {
    outline: none;
    border-color: var(--color-general, #047857);
    box-shadow: 0 0 0 3px var(--color-general-glow, rgba(4, 120, 87, 0.12));
    background: #ffffff;
  }

  .flex-row-between {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .quantity-section {
    padding: 8px 0;
  }

  .quantity-control-group {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #edf4ef;
    border: 1.5px solid #d1ded5;
    padding: 3px 4px;
    border-radius: 10px;
  }

  .qty-btn {
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #ffffff;
    border: 1px solid #d1ded5;
    border-radius: 7px;
    color: var(--text-primary, #112217);
    font-size: 1.15rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  }

  .qty-btn:hover:not(:disabled) {
    background: #e2ece5;
    color: var(--color-general, #047857);
  }

  .qty-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .qty-input {
    width: 50px;
    height: 34px;
    text-align: center;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-primary, #112217);
    background: #ffffff;
    border: 1px solid #d1ded5;
    border-radius: 7px;
    outline: none;
    padding: 0 4px;
    font-family: inherit;
    -moz-appearance: textfield;
    appearance: textfield;
    transition: all 0.15s ease;
  }

  .qty-input::-webkit-inner-spin-button,
  .qty-input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .qty-input:focus {
    border-color: var(--color-general, #047857);
    box-shadow: 0 0 0 2px var(--color-general-glow, rgba(4, 120, 87, 0.15));
  }

  .modal-footer-custom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 22px;
    border-top: 1px solid rgba(16, 185, 129, 0.18);
    background: linear-gradient(180deg, #fbfdfc 0%, #f0f5f2 100%);
    gap: 12px;
    flex-wrap: wrap;
  }

  .price-breakdown {
    display: flex;
    flex-direction: column;
  }

  .unit-breakdown {
    font-size: 0.78rem;
    color: var(--text-muted, #3d5e47);
    font-weight: 500;
  }

  .total-line {
    font-size: 0.92rem;
    color: var(--text-secondary, #2d4f38);
    font-weight: 600;
  }

  .total-amount {
    font-size: 1.35rem;
    color: var(--color-general, #047857);
    font-weight: 800;
  }

  .footer-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .btn-cancel {
    background: #ffffff;
    border: 1.5px solid #d1ded5;
    color: var(--text-secondary, #2d4f38);
    padding: 10px 18px;
    border-radius: var(--radius-sm, 8px);
    font-weight: 600;
    font-size: 0.92rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-cancel:hover {
    background: #f1f6f3;
    color: var(--text-primary, #112217);
    border-color: #b8ccbe;
  }

  .btn-confirm {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: linear-gradient(135deg, #059669 0%, #10b981 100%);
    color: #ffffff;
    font-weight: 700;
    font-size: 0.95rem;
    padding: 10px 20px;
    border-radius: var(--radius-sm, 8px);
    border: none;
    box-shadow: 0 4px 14px rgba(4, 120, 87, 0.32);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-confirm:hover {
    background: linear-gradient(135deg, #047857 0%, #059669 100%);
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(4, 120, 87, 0.4);
  }

  .confirm-price-pill {
    background: rgba(0, 0, 0, 0.18);
    padding: 2px 7px;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 800;
    color: #ffffff;
  }
</style>
