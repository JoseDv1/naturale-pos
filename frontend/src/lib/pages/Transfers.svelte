<script lang="ts">
  import { untrack } from 'svelte';
  import { user, products, refreshTrigger, triggerRefresh } from '../store';
  import { getTransfers, createTransfer } from '../api/transfers';
  import { getProducts } from '../api/products';
  import TransferRow from '../components/organisms/TransferRow.svelte';

  import Spinner from '../components/atoms/Spinner.svelte';

  // State
  let transfers = $state<any[]>([]);

  // Modal State
  let showTransferModal = $state(false);
  let transferSourceId = $state('');
  let transferTargetId = $state('');
  let transferQty = $state(1);
  let transferError = $state('');
  let transferDirection = $state<'MARKET_TO_CAFE' | 'CAFE_TO_MARKET'>('MARKET_TO_CAFE');

  let transfersPromise = $state<Promise<any>>(
    Promise.all([getTransfers(), getProducts()]).then(([trans, prods]) => {
      transfers = trans;
      products.set(prods);
    })
  );

  $effect(() => {
    if ($refreshTrigger) {
      loadData();
    }
  });

  function loadData() {
    transfersPromise = Promise.all([getTransfers(), getProducts()]).then(([trans, prods]) => {
      transfers = trans;
      products.set(prods);
    });
  }

  function openTransfer() {
    transferSourceId = '';
    transferTargetId = '';
    transferQty = 1;
    transferError = '';
    transferDirection = 'MARKET_TO_CAFE';
    showTransferModal = true;
  }

  // Source department and Target department derived from selected direction
  let fromDept = $derived(transferDirection === 'MARKET_TO_CAFE' ? 'MARKET' : 'CAFE');
  let toDept = $derived(transferDirection === 'MARKET_TO_CAFE' ? 'CAFE' : 'MARKET');

  // Source products for transfer
  let transferSources = $derived($products.filter((p) => p.department === fromDept));
  // Target products
  let transferTargets = $derived($products.filter((p) => p.department === toDept));

  let selectedSourceProduct = $derived($products.find((p) => p.id === transferSourceId));

  async function submitTransfer() {
    transferError = '';
    if (!transferSourceId || transferQty <= 0) {
      transferError = 'Selecciona un producto origen y cantidad válida.';
      return;
    }

    if (selectedSourceProduct && selectedSourceProduct.stock < transferQty) {
      transferError = `Stock insuficiente en origen. Disponible: ${selectedSourceProduct.stock}`;
      return;
    }

    try {
      const payload = {
        productId: transferSourceId,
        targetProductId: transferTargetId || null,
        quantity: transferQty,
        fromDepartment: fromDept,
        toDepartment: toDept,
        userId: $user?.id,
      };
      await createTransfer(payload);
      showTransferModal = false;
      triggerRefresh();
      loadData();
    } catch (e: any) {
      transferError = e.message || 'Error al procesar el traslado';
    }
  }
</script>

<div class="transfers-container flex-column animate-fade-in">
  <div class="transfers-header glass-panel">
    <div class="header-left">
      <h2>Traslados de Mercancía 🔄</h2>
      <p class="subtitle">Registra y audita traslados de productos e insumos entre el Mercado y la barra de Café.</p>
    </div>

    <div class="header-actions">
      <button class="btn btn-general" onclick={openTransfer}>
        ➕ Registrar Traslado
      </button>
    </div>
  </div>

  <!-- TRANSFERS LOG TABLE -->
  <div class="table-card glass-panel flex-1 scroll-y animate-scale-up">
    {#await transfersPromise}
      <div class="loading-state flex-center" style="padding: 40px 0;">
        <Spinner size="40px" />
        <p style="margin-top: 12px; color: var(--text-secondary);">Cargando traslados...</p>
      </div>
    {:then}
      <table class="pos-table">
        <thead>
          <tr>
            <th>Fecha y Hora</th>
            <th>Producto Origen</th>
            <th>Producto Destino</th>
            <th class="text-center">Cantidad</th>
            <th class="text-right">Costo Unitario</th>
            <th class="text-right">Costo Total</th>
            <th>Registrado Por</th>
          </tr>
        </thead>
        <tbody>
          {#each transfers as t}
            <TransferRow transfer={t} />
          {:else}
            <tr>
              <td colspan="7" class="text-center text-muted italic">No se han registrado traslados de mercancía aún.</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:catch error}
      <div class="error-banner animate-fade-in" style="margin: 20px;">
        Error al cargar traslados: {error.message}
      </div>
    {/await}
  </div>
</div>

<!-- ==========================================
     PRODUCT STOCK TRANSFER MODAL
     ========================================== -->
{#if showTransferModal}
  <div class="modal-overlay flex-center animate-fade-in">
    <div class="modal-container glass-panel animate-scale-up" style="max-width: 480px;">
      <div class="modal-header">
        <h2>Trasladar Producto ({transferDirection === 'MARKET_TO_CAFE' ? 'Mercado ➜ Café' : 'Café ➜ Mercado'})</h2>
        <button class="close-modal-btn" onclick={() => showTransferModal = false}>✕</button>
      </div>

      {#if transferError}
        <div class="error-banner">{transferError}</div>
      {/if}

      <div class="product-form-body">
        <div class="form-group">
          <label>Dirección del Traslado</label>
          <div class="segmented-control">
            <button
              type="button"
              class="segment-btn"
              class:active={transferDirection === 'MARKET_TO_CAFE'}
              onclick={() => { transferDirection = 'MARKET_TO_CAFE'; transferSourceId = ''; transferTargetId = ''; }}
            >
              🍏 Mercado a Café ☕
            </button>
            <button
              type="button"
              class="segment-btn"
              class:active={transferDirection === 'CAFE_TO_MARKET'}
              onclick={() => { transferDirection = 'CAFE_TO_MARKET'; transferSourceId = ''; transferTargetId = ''; }}
            >
              ☕ Café a Mercado 🍏
            </button>
          </div>
        </div>

        <div class="form-group">
          <label for="t-source">Producto de {fromDept === 'MARKET' ? 'Mercado' : 'Café'} (Origen) *</label>
          <select id="t-source" bind:value={transferSourceId}>
            <option value="">-- Selecciona el Producto --</option>
            {#each transferSources as s}
              <option value={s.id}>{s.name} (Dispo: {s.stock}) [Cost: ${s.cost.toLocaleString()}]</option>
            {/each}
          </select>
        </div>

        <div class="form-group">
          <label for="t-qty">Cantidad a Trasladar *</label>
          <input type="number" id="t-qty" bind:value={transferQty} min="1" max={selectedSourceProduct ? selectedSourceProduct.stock : 999} />
        </div>

        <div class="form-group">
          <label for="t-target">Asociar a Producto en {toDept === 'MARKET' ? 'Mercado' : 'Café'} (Destino / Opcional)</label>
          <select id="t-target" bind:value={transferTargetId}>
            <option value="">Ninguno (Consumo directo en cocina / Insumo)</option>
            {#each transferTargets as t}
              <option value={t.id}>{t.name} (Stock: {t.stock})</option>
            {/each}
          </select>
          <span class="help-text">Si seleccionas un producto de destino, su stock se incrementará. Si no, se registrará directamente como consumo de cocina del {toDept === 'MARKET' ? 'Mercado' : 'Café'}.</span>
        </div>

        {#if selectedSourceProduct && transferQty > 0}
          <div class="transfer-math-summary">
            <div class="math-row">
              <span>Valor por unidad (Costo):</span>
              <span>${selectedSourceProduct.cost.toLocaleString()}</span>
            </div>
            <div class="math-row total-row">
              <span>Gasto/Ingreso Interno Total:</span>
              <strong class={toDept === 'MARKET' ? 'text-market' : 'text-cafe'}>${(selectedSourceProduct.cost * transferQty).toLocaleString()}</strong>
            </div>
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" onclick={() => showTransferModal = false}>Cancelar</button>
        <button class="btn btn-general" onclick={submitTransfer}>Realizar Traslado 🔄</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .transfers-container {
    height: 100%;
    width: 100%;
    gap: 16px;
    padding: 6px;
    display: flex;
    flex-direction: column;
  }

  .flex-column {
    display: flex;
    flex-direction: column;
  }

  .flex-1 {
    flex: 1;
  }

  .scroll-y {
    overflow-y: auto;
  }

  .transfers-header {
    padding: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-left h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .subtitle {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .header-actions {
    display: flex;
    gap: 10px;
  }

  .table-card {
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .product-desc-txt {
    display: block;
    font-size: 0.76rem;
    color: var(--text-secondary);
    margin-top: 2px;
  }

  .text-right {
    text-align: right;
  }
  .text-center {
    text-align: center;
  }

  /* Modal forms */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(3, 7, 18, 0.4);
    backdrop-filter: blur(8px);
    z-index: 1000;
  }

  .modal-container {
    width: 100%;
    max-width: 580px;
    max-height: 90vh;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .modal-header h2 {
    font-size: 1.2rem;
    font-weight: 600;
  }

  .close-modal-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 1.2rem;
    cursor: pointer;
    outline: none;
  }

  .product-form-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
    padding-right: 4px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-group label {
    font-size: 0.8rem;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  .help-text {
    font-size: 0.72rem;
    color: var(--text-muted);
    line-height: 1.3;
    margin-top: 4px;
  }

  .error-banner {
    background: var(--color-danger-glow);
    border: 1px solid rgba(225, 29, 72, 0.2);
    color: var(--color-danger);
    padding: 10px;
    border-radius: var(--radius-sm);
    font-size: 0.88rem;
  }

  .transfer-math-summary {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    padding: 12px;
    margin-top: 8px;
  }

  .math-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-bottom: 6px;
  }

  .math-row:last-child {
    margin-bottom: 0;
  }

  .transfer-math-summary .total-row {
    border-top: 1px solid var(--border-glass);
    padding-top: 8px;
    font-size: 0.95rem;
    color: var(--text-primary);
  }

  .loading-state {
    padding: 40px;
    flex-direction: column;
    gap: 12px;
    color: var(--text-secondary);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(16, 185, 129, 0.05);
    border-top: 3px solid var(--color-general);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .text-market {
    color: var(--color-market);
  }

  .text-cafe {
    color: var(--color-cafe);
  }

  /* Segmented control for department */
  .segmented-control {
    display: flex;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    padding: 3px;
    gap: 4px;
    width: 100%;
    box-sizing: border-box;
    height: 40px; /* match input height */
  }

  .segment-btn {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 0.82rem;
    font-weight: 500;
    cursor: pointer;
    border-radius: calc(var(--radius-sm) - 2px);
    transition: var(--transition-fast);
    outline: none;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .segment-btn:hover {
    background: rgba(255, 255, 255, 0.03);
    color: var(--text-primary);
  }

  .segment-btn.active {
    background: var(--color-general-glow);
    color: var(--color-general);
    border: 1px solid rgba(16, 185, 129, 0.2);
    font-weight: 600;
  }
</style>
