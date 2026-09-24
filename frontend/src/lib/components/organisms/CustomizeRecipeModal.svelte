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

<div class="modal-overlay flex-center animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="custom-modal-title">
  <div class="modal-container glass-panel animate-scale-up" style="max-width: 600px; max-height: 94vh; display: flex; flex-direction: column;">
    <!-- Header -->
    <header class="modal-header">
      <div class="header-info">
        <span class="header-icon">🍓</span>
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
          <span class="section-label">1. Tamaño / Variante Base:</span>
          <div class="variants-pill-group">
            {#each product.variants as v (v.id)}
              <button
                type="button"
                class="variant-pill-btn"
                class:active={currentVariant?.id === v.id}
                onclick={() => (currentVariant = v)}
              >
                <span class="v-name">{v.name}</span>
                <span class="v-price">${Number(v.price).toLocaleString()}</span>
              </button>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Additions / Recipe Modifiers Selection -->
      <section class="section-block">
        <div class="section-header-row">
          <span class="section-label">
            {product.variants && product.variants.length > 0 ? '2.' : '1.'} Adiciones e Ingredientes Extras:
          </span>
          <span class="section-hint">Selecciona los ingredientes deseados</span>
        </div>

        <div class="modifiers-grid">
          {#each availableModifiers as mod (mod.name)}
            <button
              type="button"
              class="modifier-card"
              class:selected={selectedMap[mod.name]}
              onclick={() => toggleModifier(mod)}
            >
              <div class="checkbox-indicator">
                {selectedMap[mod.name] ? '✓' : ''}
              </div>
              <div class="mod-info">
                <span class="mod-name">{mod.name}</span>
                <span class="mod-price" class:free={Number(mod.price) === 0}>
                  {Number(mod.price) > 0 ? `+$${Number(mod.price).toLocaleString()}` : 'Incluido'}
                </span>
              </div>
            </button>
          {/each}
        </div>
      </section>

      <!-- Custom Addition Input -->
      <section class="section-block custom-addition-box">
        <span class="section-label">¿Deseas agregar una adición diferente?</span>
        <div class="custom-addition-row">
          <input
            type="text"
            placeholder="Ej. Fruta Kiwi, Leche de coco..."
            bind:value={customAddName}
            class="custom-input name-input"
            aria-label="Nombre de adición personalizada"
          />
          <input
            type="number"
            placeholder="+$ Valor (ej. 1500)"
            bind:value={customAddPrice}
            class="custom-input price-input"
            aria-label="Precio de adición personalizada"
            min="0"
            step="100"
          />
          <button
            type="button"
            class="btn btn-secondary btn-sm"
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
                {c.name} {c.price > 0 ? `(+$${Number(c.price).toLocaleString()})` : ''}
                <button type="button" class="btn-remove-tag" onclick={() => removeCustomAddition(idx)} aria-label="Quitar adición">✕</button>
              </span>
            {/each}
          </div>
        {/if}
      </section>

      <!-- Preparation Notes -->
      <section class="section-block">
        <label for="prep-notes" class="section-label">Instrucciones Especiales / Nota de Cocina:</label>
        <input
          type="text"
          id="prep-notes"
          bind:value={notes}
          placeholder="Ej. Sin endulzante, poco hielo, para llevar, empacar aparte..."
          class="notes-input"
        />
      </section>

      <!-- Quantity Selector -->
      <section class="section-block flex-row-between">
        <span class="section-label">Cantidad:</span>
        <div class="quantity-control-group">
          <button
            type="button"
            class="qty-btn"
            onclick={() => { if (quantity > 1) quantity--; }}
            disabled={quantity <= 1}
            aria-label="Reducir cantidad"
          >
            -
          </button>
          <span class="qty-display">{quantity}</span>
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
        <button type="button" class="btn btn-secondary" onclick={onclose}>
          Cancelar
        </button>
        <button type="button" class="btn btn-primary btn-confirm" onclick={handleConfirm}>
          ✨ Agregar al Pedido (${lineTotal.toLocaleString()})
        </button>
      </div>
    </footer>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(6px);
    z-index: 1050;
    padding: 16px;
  }

  .modal-container {
    width: 100%;
    background: var(--bg-card);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-lg);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 18px 22px;
    border-bottom: 1px solid var(--border-glass);
    background: rgba(255, 255, 255, 0.02);
  }

  .header-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-icon {
    font-size: 1.8rem;
  }

  .modal-header h2 {
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0;
    color: var(--text-primary);
  }

  .header-sub {
    font-size: 0.8rem;
    color: var(--text-secondary);
    margin: 2px 0 0;
  }

  .close-modal-btn {
    background: transparent;
    border: none;
    font-size: 1.2rem;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: var(--radius-sm);
  }

  .close-modal-btn:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.08);
  }

  .modal-body-scroll {
    padding: 20px 22px;
    gap: 18px;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
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
    font-weight: 600;
    color: var(--text-primary);
  }

  .section-hint {
    font-size: 0.75rem;
    color: var(--text-secondary);
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
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }

  .variant-pill-btn:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .variant-pill-btn.active {
    background: rgba(59, 130, 246, 0.15);
    border-color: #3b82f6;
  }

  .variant-pill-btn .v-name {
    font-weight: 600;
    font-size: 0.88rem;
    color: var(--text-primary);
  }

  .variant-pill-btn .v-price {
    font-size: 0.8rem;
    color: #3b82f6;
    font-family: monospace;
  }

  .modifiers-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 8px;
  }

  .modifier-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }

  .modifier-card:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .modifier-card.selected {
    background: rgba(16, 185, 129, 0.12);
    border-color: #10b981;
  }

  .checkbox-indicator {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: 1.5px solid var(--border-glass);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    font-weight: bold;
    color: #10b981;
    background: rgba(0, 0, 0, 0.2);
  }

  .modifier-card.selected .checkbox-indicator {
    border-color: #10b981;
    background: rgba(16, 185, 129, 0.25);
  }

  .mod-info {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .mod-name {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .mod-price {
    font-size: 0.78rem;
    font-family: monospace;
    color: #10b981;
    font-weight: 600;
  }

  .mod-price.free {
    color: var(--text-secondary);
    font-weight: normal;
  }

  .custom-addition-box {
    background: rgba(255, 255, 255, 0.02);
    padding: 12px;
    border-radius: var(--radius-sm);
    border: 1px dashed var(--border-glass);
  }

  .custom-addition-row {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }

  .custom-input {
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-size: 0.85rem;
  }

  .name-input {
    flex: 2;
  }

  .price-input {
    flex: 1;
    min-width: 100px;
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
    padding: 3px 8px;
    background: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 9999px;
    font-size: 0.78rem;
    color: #93c5fd;
  }

  .btn-remove-tag {
    background: none;
    border: none;
    color: #ef4444;
    cursor: pointer;
    font-size: 0.75rem;
    padding: 0;
  }

  .notes-input {
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-size: 0.88rem;
    width: 100%;
  }

  .notes-input:focus, .custom-input:focus {
    outline: none;
    border-color: var(--color-general);
  }

  .flex-row-between {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .quantity-control-group {
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-glass);
    padding: 4px;
    border-radius: var(--radius-sm);
  }

  .qty-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.08);
    border: none;
    border-radius: var(--radius-xs);
    color: var(--text-primary);
    font-size: 1.1rem;
    cursor: pointer;
  }

  .qty-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .qty-display {
    font-size: 1.1rem;
    font-weight: 700;
    min-width: 24px;
    text-align: center;
    font-family: monospace;
  }

  .modal-footer-custom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 22px;
    border-top: 1px solid var(--border-glass);
    background: rgba(0, 0, 0, 0.2);
    gap: 12px;
    flex-wrap: wrap;
  }

  .price-breakdown {
    display: flex;
    flex-direction: column;
  }

  .unit-breakdown {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .total-line {
    font-size: 0.9rem;
    color: var(--text-primary);
  }

  .total-amount {
    font-size: 1.25rem;
    color: #10b981;
    font-family: monospace;
  }

  .footer-actions {
    display: flex;
    gap: 10px;
  }

  .btn-confirm {
    font-weight: 700;
  }
</style>
