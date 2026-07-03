<script lang="ts">
  import { onMount } from 'svelte';
  import { user, products, refreshTrigger, triggerRefresh } from '../store';

  // State
  let transfers = $state<any[]>([]);
  let isLoading = $state(false);
  let errorMsg = $state('');

  // Modal State
  let showTransferModal = $state(false);
  let transferSourceId = $state('');
  let transferTargetId = $state('');
  let transferQty = $state(1);
  let transferError = $state('');

  onMount(() => {
    loadData();
  });

  $effect(() => {
    if ($refreshTrigger) {
      loadData();
    }
  });

  async function loadData() {
    isLoading = true;
    errorMsg = '';
    try {
      // Fetch transfers
      const transRes = await fetch('/api/transfers');
      if (transRes.ok) {
        transfers = await transRes.json();
      } else {
        errorMsg = 'Error al cargar historial de traslados';
      }

      // Fetch products (needed for dropdown selections in transfer modal)
      const prodRes = await fetch('/api/products');
      if (prodRes.ok) {
        products.set(await prodRes.json());
      }
    } catch (e) {
      console.error('Error loading transfer data:', e);
      errorMsg = 'Error de conexión con el servidor';
    } finally {
      isLoading = false;
    }
  }

  function openTransfer() {
    transferSourceId = '';
    transferTargetId = '';
    transferQty = 1;
    transferError = '';
    showTransferModal = true;
  }

  // Source products for transfer (usually Market products, especially raw materials/supplies)
  let transferSources = $derived($products.filter((p) => p.department === 'MARKET'));
  // Target products (usually Café products)
  let transferTargets = $derived($products.filter((p) => p.department === 'CAFE'));

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
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: transferSourceId,
          targetProductId: transferTargetId || null,
          quantity: transferQty,
          fromDepartment: 'MARKET',
          toDepartment: 'CAFE',
          userId: $user?.id,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showTransferModal = false;
        triggerRefresh();
        loadData();
      } else {
        transferError = data.error || 'Error al procesar el traslado';
      }
    } catch (e) {
      transferError = 'Error de conexión con el servidor';
    }
  }
</script>

<div class="transfers-container flex-column animate-fade-in">
  <div class="transfers-header glass-panel">
    <div class="header-left">
      <h2>Traslados de Mercancía 🔄</h2>
      <p class="subtitle">Registra y audita traslados de productos e insumos desde el Mercado hacia la barra de Café.</p>
    </div>

    <div class="header-actions">
      <button class="btn btn-general" onclick={openTransfer}>
        ➕ Registrar Traslado
      </button>
    </div>
  </div>

  {#if errorMsg}
    <div class="error-banner">{errorMsg}</div>
  {/if}

  <!-- TRANSFERS LOG TABLE -->
  <div class="table-card glass-panel flex-1 scroll-y animate-scale-up">
    {#if isLoading && transfers.length === 0}
      <div class="loading-state flex-center">
        <div class="spinner"></div>
        <p>Cargando traslados...</p>
      </div>
    {:else}
      <table class="pos-table">
        <thead>
          <tr>
            <th>Fecha y Hora</th>
            <th>Producto Origen (Mercado)</th>
            <th>Producto Destino (Café)</th>
            <th class="text-center">Cantidad</th>
            <th class="text-right">Costo Unitario</th>
            <th class="text-right">Costo Total</th>
            <th>Registrado Por</th>
          </tr>
        </thead>
        <tbody>
          {#each transfers as t}
            <tr class="animate-fade-in">
              <td>{new Date(t.createdAt).toLocaleString()}</td>
              <td>
                <strong class="text-market">{t.product.name}</strong>
                <span class="product-desc-txt">SKU: {t.product.sku}</span>
              </td>
              <td>
                {#if t.targetProduct}
                  <strong class="text-cafe">{t.targetProduct.name}</strong>
                  <span class="product-desc-txt">SKU: {t.targetProduct.sku}</span>
                {:else}
                  <em class="text-muted">Consumido en Cocina (Insumo)</em>
                {/if}
              </td>
              <td class="text-center">x{t.quantity}</td>
              <td class="text-right">${t.unitCost.toLocaleString()}</td>
              <td class="text-right"><strong>${t.totalCost.toLocaleString()}</strong></td>
              <td>{t.user.name}</td>
            </tr>
          {:else}
            <tr>
              <td colspan="7" class="text-center text-muted italic">No se han registrado traslados de mercancía aún.</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div>

<!-- ==========================================
     PRODUCT STOCK TRANSFER MODAL
     ========================================== -->
{#if showTransferModal}
  <div class="modal-overlay flex-center animate-fade-in">
    <div class="modal-container glass-panel animate-scale-up" style="max-width: 480px;">
      <div class="modal-header">
        <h2>Trasladar Producto (Mercado ➜ Café)</h2>
        <button class="close-modal-btn" onclick={() => showTransferModal = false}>✕</button>
      </div>

      {#if transferError}
        <div class="error-banner">{transferError}</div>
      {/if}

      <div class="product-form-body">
        <div class="form-group">
          <label for="t-source">Producto del Mercado (Origen) *</label>
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
          <label for="t-target">Asociar a Producto en Café (Destino / Opcional)</label>
          <select id="t-target" bind:value={transferTargetId}>
            <option value="">Ninguno (Consumo directo en cocina / Insumo)</option>
            {#each transferTargets as t}
              <option value={t.id}>{t.name} (Stock: {t.stock})</option>
            {/each}
          </select>
          <span class="help-text">Si seleccionas un producto de destino, su stock se incrementará. Si no, se registrará directamente como consumo de cocina del Café.</span>
        </div>

        {#if selectedSourceProduct && transferQty > 0}
          <div class="transfer-math-summary">
            <div class="math-row">
              <span>Valor por unidad (Costo):</span>
              <span>${selectedSourceProduct.cost.toLocaleString()}</span>
            </div>
            <div class="math-row total-row">
              <span>Gasto/Ingreso Interno Total:</span>
              <strong class="text-cafe">${(selectedSourceProduct.cost * transferQty).toLocaleString()}</strong>
            </div>
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" onclick={() => showTransferModal = false}>Cancelar</button>
        <button class="btn btn-cafe" onclick={submitTransfer}>Realizar Traslado 🔄</button>
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
</style>
