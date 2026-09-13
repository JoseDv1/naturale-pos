<script lang="ts">
  interface Props {
    table: any;
    tables: any[];
    userId: string;
    ontransfer: (sourceId: string, targetTableId: string, items: Array<{ productId: string; quantity: number }>) => Promise<void>;
    oncheckout: (tableId: string, payload: { userId: string; items: any[]; payments: any[] }) => Promise<any>;
    onclose: () => void;
  }

  let { table, tables = [], userId, ontransfer, oncheckout, onclose }: Props = $props();

  // State: item quantities selected for splitting
  // Map of productId -> selected quantity
  let selectedQuantities = $state<Record<string, number>>({});
  let activeAction = $state<'TRANSFER' | 'CHECKOUT'>('TRANSFER');
  let selectedTargetTableId = $state<string | null>(null);

  // Payment state for CHECKOUT action
  let payments = $state<Array<{ method: 'CASH' | 'CARD' | 'TRANSFER' | 'INTERNAL'; amount: number }>>([]);
  let currentMethod = $state<'CASH' | 'CARD' | 'TRANSFER' | 'INTERNAL'>('CASH');
  let currentAmountInput = $state<string>('');

  let isLoading = $state(false);
  let errorMsg = $state('');

  const items = $derived(table.currentSale?.items || []);

  // Candidate tables for transfer
  const candidateTables = $derived(
    tables.filter(t => t.id !== table.id)
  );

  // Total selected items count
  const totalSelectedCount = $derived(
    Object.values(selectedQuantities).reduce((sum, q) => sum + (q || 0), 0)
  );

  // Subtotal for selected items
  const selectedSubtotal = $derived(
    items.reduce((sum: number, it: any) => {
      const q = selectedQuantities[it.productId] || 0;
      return sum + (q * parseFloat(it.price));
    }, 0)
  );

  // Original total
  const originalTotal = $derived(parseFloat(table.currentSale?.total || 0));

  // Remaining subtotal on table
  const remainingTableSubtotal = $derived(
    Math.max(0, originalTotal - selectedSubtotal)
  );

  // Payment calculations
  const totalPaid = $derived(
    payments.reduce((sum, p) => sum + p.amount, 0)
  );

  const remainingToPay = $derived(
    Math.max(0, selectedSubtotal - totalPaid)
  );

  const cashChange = $derived(
    totalPaid > selectedSubtotal ? totalPaid - selectedSubtotal : 0
  );

  function incrementItem(productId: string, maxQty: number) {
    const current = selectedQuantities[productId] || 0;
    if (current < maxQty) {
      selectedQuantities = { ...selectedQuantities, [productId]: current + 1 };
    }
  }

  function decrementItem(productId: string) {
    const current = selectedQuantities[productId] || 0;
    if (current > 0) {
      selectedQuantities = { ...selectedQuantities, [productId]: current - 1 };
    }
  }

  function selectAllOfItem(productId: string, maxQty: number) {
    selectedQuantities = { ...selectedQuantities, [productId]: maxQty };
  }

  function selectAllItems() {
    const updated: Record<string, number> = {};
    for (const item of items) {
      updated[item.productId] = item.quantity;
    }
    selectedQuantities = updated;
  }

  function clearSelection() {
    selectedQuantities = {};
    payments = [];
  }

  // Payment helpers
  function addPayment() {
    const val = parseFloat(currentAmountInput);
    if (isNaN(val) || val <= 0) return;

    payments = [...payments, { method: currentMethod, amount: val }];
    currentAmountInput = '';
  }

  function removePayment(index: number) {
    payments = payments.filter((_, i) => i !== index);
  }

  function setExactAmount() {
    currentAmountInput = remainingToPay.toString();
  }

  // Handlers
  async function handleTransfer() {
    if (!selectedTargetTableId) {
      errorMsg = 'Selecciona una mesa de destino';
      return;
    }
    if (totalSelectedCount === 0) {
      errorMsg = 'Selecciona al menos un producto para transferir';
      return;
    }

    const payloadItems = Object.entries(selectedQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));

    isLoading = true;
    errorMsg = '';
    try {
      await ontransfer(table.id, selectedTargetTableId, payloadItems);
      onclose();
    } catch (e: any) {
      errorMsg = e.message || 'Error al transferir productos';
    } finally {
      isLoading = false;
    }
  }

  async function handlePartialCheckout() {
    if (totalSelectedCount === 0) {
      errorMsg = 'Selecciona al menos un producto para cobrar';
      return;
    }
    if (remainingToPay > 0.01) {
      errorMsg = 'El total de pagos debe cubrir el subtotal seleccionado';
      return;
    }

    const payloadItems = items
      .filter((it: any) => (selectedQuantities[it.productId] || 0) > 0)
      .map((it: any) => ({
        productId: it.productId,
        quantity: selectedQuantities[it.productId],
        price: parseFloat(it.price)
      }));

    isLoading = true;
    errorMsg = '';
    try {
      await oncheckout(table.id, {
        userId,
        items: payloadItems,
        payments
      });
      onclose();
    } catch (e: any) {
      errorMsg = e.message || 'Error al procesar cobro parcial';
    } finally {
      isLoading = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-overlay flex-center animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="split-modal-title">
  <div class="modal-container glass-panel animate-scale-up">
    <div class="modal-header">
      <div class="header-title-group">
        <h2 id="split-modal-title">Dividir Cuenta: {table.name}</h2>
        <span class="total-badge">Total Original: ${originalTotal.toLocaleString()}</span>
      </div>
      <button class="close-modal-btn" onclick={onclose} aria-label="Cerrar ventana">✕</button>
    </div>

    {#if errorMsg}
      <div class="error-banner animate-fade-in" role="alert">
        <span>⚠️ {errorMsg}</span>
      </div>
    {/if}

{#snippet itemRow(item: any)}
  {@const selectedQty = selectedQuantities[item.productId] || 0}
  {@const unitPrice = parseFloat(item.price)}
  <div class="item-split-row" class:has-selected={selectedQty > 0}>
    <div class="item-info">
      <span class="item-name">{item.product.name}</span>
      <span class="item-price-desc">${unitPrice.toLocaleString()} c/u (Disp: {item.quantity})</span>
    </div>

    <div class="item-stepper">
      <button
        type="button"
        class="stepper-btn"
        onclick={() => decrementItem(item.productId)}
        disabled={selectedQty === 0}
        aria-label="Disminuir"
      >
        -
      </button>
      <span class="stepper-value">{selectedQty}</span>
      <button
        type="button"
        class="stepper-btn"
        onclick={() => incrementItem(item.productId, item.quantity)}
        disabled={selectedQty >= item.quantity}
        aria-label="Aumentar"
      >
        +
      </button>
      <button
        type="button"
        class="stepper-all-btn"
        onclick={() => selectAllOfItem(item.productId, item.quantity)}
        title="Seleccionar todo de este producto"
      >
        Todo
      </button>
    </div>

    <div class="item-subtotal-col">
      ${(selectedQty * unitPrice).toLocaleString()}
    </div>
  </div>
{/snippet}

{#snippet destinationTableOption(t: any)}
  <button
    type="button"
    class="target-table-option"
    class:selected={selectedTargetTableId === t.id}
    onclick={() => selectedTargetTableId = t.id}
  >
    <div class="t-opt-header">
      <strong>{t.name}</strong>
      <span class="t-status" class:occupied={t.status === 'OCCUPIED'}>
        {t.status === 'OCCUPIED' ? 'Ocupada' : 'Libre'}
      </span>
    </div>
    {#if t.status === 'OCCUPIED' && t.currentSale}
      <span class="t-total">${parseFloat(t.currentSale.total).toLocaleString()}</span>
    {:else}
      <span class="t-empty">Lista para recibir</span>
    {/if}
  </button>
{/snippet}

{#snippet paymentPill(pay: any, idx: number)}
  <div class="payment-pill">
    <span>{pay.method}: ${pay.amount.toLocaleString()}</span>
    <button type="button" class="del-pay-btn" onclick={() => removePayment(idx)} aria-label="Eliminar pago">✕</button>
  </div>
{/snippet}

    <!-- Action mode switch -->
    <div class="action-mode-switcher">
      <button
        type="button"
        class="mode-btn"
        class:active={activeAction === 'TRANSFER'}
        onclick={() => activeAction = 'TRANSFER'}
      >
        🔀 Mover a otra Mesa
      </button>
      <button
        type="button"
        class="mode-btn"
        class:active={activeAction === 'CHECKOUT'}
        onclick={() => { activeAction = 'CHECKOUT'; if (payments.length === 0 && selectedSubtotal > 0) setExactAmount(); }}
      >
        💳 Cobrar Selección
      </button>
    </div>

    <div class="split-content-layout">
      <!-- Left Column: Item Selection -->
      <div class="items-selection-column">
        <div class="section-title-row">
          <h4>Seleccionar Productos</h4>
          <div class="bulk-actions">
            <button type="button" class="link-btn" onclick={selectAllItems}>Seleccionar Todos</button>
            <span class="separator">·</span>
            <button type="button" class="link-btn" onclick={clearSelection}>Limpiar</button>
          </div>
        </div>

        <div class="items-list-scroll">
          {#each items as item}
            {@render itemRow(item)}
          {/each}
        </div>

        <!-- Balance display -->
        <div class="selection-math-card">
          <div class="math-row">
            <span>Productos a separar:</span>
            <strong>{totalSelectedCount} uds.</strong>
          </div>
          <div class="math-row highlight">
            <span>Subtotal Separado:</span>
            <strong class="text-cafe">${selectedSubtotal.toLocaleString()}</strong>
          </div>
          <div class="math-row">
            <span>Restante en {table.name}:</span>
            <strong class="text-muted">${remainingTableSubtotal.toLocaleString()}</strong>
          </div>
        </div>
      </div>

      <!-- Right Column: Destination or Payment -->
      <div class="action-column">
        {#if activeAction === 'TRANSFER'}
          <div class="destination-section">
            <h4>Mesa de Destino</h4>
            <p class="section-hint">Selecciona la mesa a la cual se trasladarán los {totalSelectedCount} productos seleccionados.</p>

            <div class="target-tables-picker">
              {#each candidateTables as t}
                {@render destinationTableOption(t)}
              {:else}
                <p class="empty-msg">No hay otras mesas en el salón.</p>
              {/each}
            </div>

            <div class="action-footer">
              <button
                type="button"
                class="btn btn-cafe w-100"
                onclick={handleTransfer}
                disabled={totalSelectedCount === 0 || !selectedTargetTableId || isLoading}
              >
                {isLoading ? 'Transfiriendo...' : 'Confirmar Traslado 🔀'}
              </button>
            </div>
          </div>
        {:else}
          <!-- CHECKOUT SECTION -->
          <div class="payment-section">
            <h4>Cobro Parcial Inmediato</h4>
            <div class="payment-summary-box">
              <div class="p-summary-row">
                <span>A Cobrar:</span>
                <strong class="text-cafe">${selectedSubtotal.toLocaleString()}</strong>
              </div>
              <div class="p-summary-row">
                <span>Registrado:</span>
                <strong class="text-market">${totalPaid.toLocaleString()}</strong>
              </div>
              <div class="p-summary-row">
                <span>Faltante:</span>
                <strong class={remainingToPay > 0 ? 'text-danger' : 'text-market'}>${remainingToPay.toLocaleString()}</strong>
              </div>
            </div>

            <!-- Add Payment input -->
            {#if remainingToPay > 0}
              <div class="add-payment-box">
                <div class="method-selector">
                  <button type="button" class="method-btn" class:active={currentMethod === 'CASH'} onclick={() => currentMethod = 'CASH'}>💵 Efec</button>
                  <button type="button" class="method-btn" class:active={currentMethod === 'CARD'} onclick={() => currentMethod = 'CARD'}>💳 Tarj</button>
                  <button type="button" class="method-btn" class:active={currentMethod === 'TRANSFER'} onclick={() => currentMethod = 'TRANSFER'}>📱 Transf</button>
                  <button type="button" class="method-btn" class:active={currentMethod === 'INTERNAL'} onclick={() => currentMethod = 'INTERNAL'}>🏢 Int</button>
                </div>

                <div class="input-row">
                  <input
                    type="number"
                    placeholder="Monto a ingresar"
                    bind:value={currentAmountInput}
                    class="payment-input"
                  />
                  <button type="button" class="btn btn-secondary btn-sm" onclick={setExactAmount}>
                    Exacto
                  </button>
                  <button type="button" class="btn btn-market btn-sm" onclick={addPayment}>
                    + Agregar
                  </button>
                </div>
              </div>
            {/if}

            <!-- Payments list -->
            {#if payments.length > 0}
              <div class="registered-payments">
                {#each payments as pay, idx}
                  {@render paymentPill(pay, idx)}
                {/each}
              </div>
            {/if}

            {#if cashChange > 0}
              <div class="change-alert">
                <span>Cambio en efectivo:</span>
                <strong>${cashChange.toLocaleString()}</strong>
              </div>
            {/if}

            <div class="action-footer">
              <button
                type="button"
                class="btn btn-market w-100"
                onclick={handlePartialCheckout}
                disabled={totalSelectedCount === 0 || remainingToPay > 0.01 || isLoading}
              >
                {isLoading ? 'Facturando...' : 'Facturar y Emitir Recibo ✔'}
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(3, 7, 18, 0.45);
    backdrop-filter: blur(8px);
    z-index: 1000;
  }

  .modal-container {
    width: 92%;
    max-width: 860px;
    background: #ffffff;
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-lg, 16px);
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: 0 20px 40px rgba(11, 38, 20, 0.15);
    max-height: 92vh;
    overflow-y: auto;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .header-title-group h2 {
    margin: 0 0 4px 0;
    font-size: 1.35rem;
    color: var(--text-primary);
  }

  .total-badge {
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .close-modal-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 1.25rem;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
  }

  .close-modal-btn:hover {
    color: var(--color-danger);
  }

  .error-banner {
    background: var(--color-danger-glow);
    border: 1px solid rgba(190, 18, 60, 0.3);
    color: #991b1b;
    font-weight: 500;
    padding: 10px 14px;
    border-radius: var(--radius-sm, 8px);
    font-size: 0.88rem;
  }

  .action-mode-switcher {
    display: flex;
    gap: 8px;
    background: rgba(0, 0, 0, 0.05);
    padding: 4px;
    border-radius: var(--radius-md, 10px);
  }

  .mode-btn {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    padding: 10px;
    border-radius: var(--radius-sm, 8px);
    font-weight: 600;
    font-size: 0.92rem;
    cursor: pointer;
    transition: var(--transition-fast, all 0.2s);
  }

  .mode-btn.active {
    background: var(--color-general);
    color: #ffffff;
    box-shadow: 0 2px 8px rgba(4, 120, 87, 0.25);
  }

  .split-content-layout {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    gap: 20px;
    align-items: stretch;
  }

  @media (max-width: 768px) {
    .split-content-layout {
      grid-template-columns: 1fr;
    }
  }

  .items-selection-column, .action-column {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .section-title-row h4 {
    margin: 0;
    font-size: 0.95rem;
    color: var(--text-secondary);
  }

  .bulk-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .link-btn {
    background: transparent;
    border: none;
    color: var(--color-general);
    font-size: 0.78rem;
    font-weight: 500;
    cursor: pointer;
    text-decoration: underline;
    padding: 0;
  }

  .separator {
    color: var(--text-muted);
  }

  .items-list-scroll {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 320px;
    overflow-y: auto;
    padding-right: 4px;
  }

  .item-split-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(0, 0, 0, 0.02);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm, 8px);
    padding: 8px 12px;
    gap: 8px;
    transition: var(--transition-fast, all 0.2s);
  }

  .item-split-row.has-selected {
    background: rgba(4, 120, 87, 0.08);
    border-color: rgba(4, 120, 87, 0.3);
  }

  .item-info {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .item-name {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .item-price-desc {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .item-stepper {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .stepper-btn {
    background: rgba(0, 0, 0, 0.04);
    border: 1px solid var(--border-glass);
    color: var(--text-primary);
    width: 28px;
    height: 28px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 700;
  }

  .stepper-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .stepper-value {
    min-width: 24px;
    text-align: center;
    font-weight: 700;
    font-size: 0.95rem;
    color: var(--text-primary);
  }

  .stepper-all-btn {
    background: transparent;
    border: 1px solid var(--border-glass);
    color: var(--text-secondary);
    font-size: 0.7rem;
    font-weight: 500;
    padding: 4px 6px;
    border-radius: 4px;
    cursor: pointer;
  }

  .item-subtotal-col {
    min-width: 70px;
    text-align: right;
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .selection-math-card {
    background: rgba(0, 0, 0, 0.03);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm, 8px);
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .math-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .math-row.highlight {
    font-size: 1rem;
    font-weight: 700;
    padding-top: 4px;
    border-top: 1px solid var(--border-glass);
  }

  .text-cafe {
    color: var(--color-cafe);
  }

  .text-market {
    color: var(--color-market);
  }

  .text-danger {
    color: var(--color-danger);
  }

  .text-muted {
    color: var(--text-muted);
  }

  /* Destination & Payment column styling */
  .destination-section, .payment-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: rgba(0, 0, 0, 0.02);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-md, 10px);
    padding: 14px;
    flex: 1;
  }

  .destination-section h4, .payment-section h4 {
    margin: 0;
    font-size: 0.95rem;
    color: var(--text-primary);
  }

  .section-hint {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .target-tables-picker {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 8px;
    max-height: 240px;
    overflow-y: auto;
  }

  .target-table-option {
    background: rgba(0, 0, 0, 0.02);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm, 8px);
    padding: 10px;
    text-align: left;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 4px;
    transition: var(--transition-fast, all 0.2s);
  }

  .target-table-option:hover {
    background: rgba(0, 0, 0, 0.05);
    border-color: var(--color-cafe);
  }

  .target-table-option.selected {
    border-color: var(--color-cafe);
    background: rgba(180, 83, 9, 0.1);
  }

  .t-opt-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .t-status {
    font-size: 0.65rem;
    padding: 2px 4px;
    border-radius: 3px;
    background: var(--color-general-glow);
    color: var(--color-general);
    font-weight: 600;
  }

  .t-status.occupied {
    background: var(--color-cafe-glow);
    color: var(--color-cafe);
    font-weight: 600;
  }

  .t-total {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .t-empty {
    font-size: 0.72rem;
    color: var(--text-muted);
  }

  .payment-summary-box {
    background: rgba(0, 0, 0, 0.03);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm, 8px);
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .p-summary-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
  }

  .add-payment-box {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .method-selector {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
  }

  .method-btn {
    background: rgba(0, 0, 0, 0.03);
    border: 1px solid var(--border-glass);
    color: var(--text-secondary);
    padding: 6px 4px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
  }

  .method-btn.active {
    background: var(--color-market);
    color: #ffffff;
    border-color: var(--color-market);
  }

  .input-row {
    display: flex;
    gap: 6px;
  }

  .payment-input {
    flex: 1;
    background: #ffffff;
    border: 1px solid var(--border-glass);
    border-radius: 4px;
    color: var(--text-primary);
    padding: 6px 10px;
    font-size: 0.9rem;
  }

  .btn-sm {
    padding: 6px 10px;
    font-size: 0.8rem;
  }

  .registered-payments {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .payment-pill {
    background: var(--color-market-glow);
    border: 1px solid rgba(21, 128, 61, 0.3);
    border-radius: 12px;
    padding: 3px 8px;
    font-size: 0.78rem;
    color: var(--color-market);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .del-pay-btn {
    background: transparent;
    border: none;
    color: var(--color-danger);
    cursor: pointer;
    font-size: 0.75rem;
  }

  .change-alert {
    background: var(--color-cafe-glow);
    border: 1px solid rgba(180, 83, 9, 0.3);
    border-radius: 6px;
    padding: 8px 12px;
    display: flex;
    justify-content: space-between;
    font-size: 0.88rem;
    color: #78350f;
    font-weight: 600;
  }

  .action-footer {
    margin-top: auto;
    padding-top: 10px;
  }

  .w-100 {
    width: 100%;
  }
</style>
