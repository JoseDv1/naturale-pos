<script lang="ts">
  import { onMount } from 'svelte';
  import { user, activeTab, selectedTable, cart, refreshTrigger, triggerRefresh } from '../store';

  let tables = $state<any[]>([]);
  let isLoading = $state(false);
  let errorMsg = $state('');

  // Modal state for adding a table
  let showAddModal = $state(false);
  let newTableName = $state('');
  let addTableError = $state('');

  onMount(() => {
    loadTables();
  });

  // Reload tables on refresh trigger
  $effect(() => {
    if ($refreshTrigger) {
      loadTables();
    }
  });

  async function loadTables() {
    isLoading = true;
    errorMsg = '';
    try {
      const res = await fetch('/api/tables');
      if (res.ok) {
        tables = await res.json();
      } else {
        errorMsg = 'Error al cargar las mesas del salón';
      }
    } catch (e) {
      console.error('Error loading tables:', e);
      errorMsg = 'Error de conexión con el servidor';
    } finally {
      isLoading = false;
    }
  }

  async function openTable(table: any) {
    if (table.status !== 'AVAILABLE') return;
    try {
      const res = await fetch(`/api/tables/${table.id}/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: $user?.id }),
      });

      if (res.ok) {
        const data = await res.json();
        // Set active table in store
        selectedTable.set({
          id: data.table.id,
          name: data.table.name,
          status: data.table.status,
          currentSaleId: data.table.currentSaleId,
        });
        // Clear cart for fresh table order
        cart.set([]);
        // Redirect to sales terminal
        activeTab.set('checkout');
      } else {
        const err = await res.json();
        alert(err.error || 'Error al abrir la mesa');
      }
    } catch (e) {
      alert('Error de conexión al abrir la mesa');
    }
  }

  function resumeTable(table: any) {
    if (table.status !== 'OCCUPIED' || !table.currentSale) return;

    // Set selected table in store
    selectedTable.set({
      id: table.id,
      name: table.name,
      status: table.status,
      currentSaleId: table.currentSaleId,
    });

    // Load active sale items into cart
    const items = table.currentSale.items.map((item: any) => ({
      product: item.product,
      quantity: item.quantity,
    }));
    cart.set(items);

    // Redirect to checkout
    activeTab.set('checkout');
  }

  async function cancelTableOrder(table: any) {
    if (table.status !== 'OCCUPIED') return;
    if (!confirm(`¿Estás seguro de que deseas anular la cuenta de la ${table.name}? Esto liberará el stock reservado.`)) return;

    try {
      const res = await fetch(`/api/tables/${table.id}/cancel`, {
        method: 'POST',
      });

      if (res.ok) {
        triggerRefresh();
        loadTables();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al cancelar la cuenta de la mesa');
      }
    } catch (e) {
      alert('Error de conexión al anular la cuenta');
    }
  }

  function openAddModal() {
    newTableName = '';
    addTableError = '';
    showAddModal = true;
  }

  async function addTable() {
    if (!newTableName || newTableName.trim() === '') {
      addTableError = 'El nombre de la mesa es obligatorio';
      return;
    }
    addTableError = '';
    try {
      const res = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTableName })
      });
      if (res.ok) {
        showAddModal = false;
        loadTables();
      } else {
        const data = await res.json();
        addTableError = data.error || 'Error al crear la mesa';
      }
    } catch (e) {
      addTableError = 'Error de conexión con el servidor';
    }
  }

  async function deleteTable(table: any) {
    if (table.status !== 'AVAILABLE') {
      alert('Solo se pueden eliminar mesas libres y disponibles.');
      return;
    }
    if (!confirm(`¿Estás seguro de que deseas eliminar la ${table.name}?`)) return;

    try {
      const res = await fetch(`/api/tables/${table.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        loadTables();
      } else {
        const data = await res.json();
        alert(data.error || 'Error al eliminar la mesa');
      }
    } catch (e) {
      alert('Error de conexión al eliminar la mesa');
    }
  }
</script>

<div class="tables-view-container flex-column animate-fade-in">
  <div class="tables-header glass-panel">
    <div class="header-left">
      <h2>Salón y Mapa de Mesas 🪑</h2>
      <p class="subtitle">Administra los pedidos activos por mesa y procesa los pagos del café.</p>
    </div>
    
    <div class="header-actions">
      {#if $user?.role === 'ADMIN'}
        <button class="btn btn-general" onclick={openAddModal}>
          ➕ Nueva Mesa
        </button>
      {/if}
      <button class="btn btn-secondary" onclick={loadTables} disabled={isLoading}>
        🔄 Actualizar Salón
      </button>
    </div>
  </div>

  {#if errorMsg}
    <div class="error-banner">{errorMsg}</div>
  {/if}

  {#if isLoading && tables.length === 0}
    <div class="loading-state flex-center glass-panel">
      <div class="spinner"></div>
      <p>Cargando salón...</p>
    </div>
  {:else}
    <div class="tables-grid">
      {#each tables as table}
        <div class="table-card glass-panel animate-scale-up" class:occupied={table.status === 'OCCUPIED'}>
          <div class="table-card-header">
            <div class="header-left-side">
              <span class="table-icon">☕</span>
              {#if table.status === 'AVAILABLE' && $user?.role === 'ADMIN'}
                <button class="btn-delete-table" onclick={() => deleteTable(table)} title="Eliminar Mesa">
                  🗑️
                </button>
              {/if}
            </div>
            <span class="status-indicator" class:occupied={table.status === 'OCCUPIED'}>
              {table.status === 'OCCUPIED' ? 'Ocupada' : 'Disponible'}
            </span>
          </div>

          <div class="table-card-body">
            <h3>{table.name}</h3>
            
            {#if table.status === 'OCCUPIED' && table.currentSale}
              <div class="order-summary">
                <span class="items-count">📦 {table.currentSale.items.reduce((sum, i) => sum + i.quantity, 0)} Productos</span>
                <span class="order-total">${table.currentSale.total.toLocaleString()}</span>
              </div>
              <div class="order-time">
                <span>Abierta: {new Date(table.currentSale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            {:else}
              <p class="empty-msg">Mesa disponible para nuevos pedidos.</p>
            {/if}
          </div>

          <div class="table-card-actions">
            {#if table.status === 'AVAILABLE'}
              <button class="btn btn-market w-100" onclick={() => openTable(table)}>
                Abrir Mesa 🪑
              </button>
            {:else}
              <button class="btn btn-cafe flex-1" onclick={() => resumeTable(table)}>
                Ver Cuenta / Cobrar 🛒
              </button>
              <button class="btn btn-cancel-table" onclick={() => cancelTableOrder(table)} title="Anular cuenta de mesa">
                ✕
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- ==========================================
     NUEVA MESA MODAL
     ========================================== -->
{#if showAddModal}
  <div class="modal-overlay flex-center animate-fade-in">
    <div class="modal-container glass-panel animate-scale-up" style="max-width: 400px;">
      <div class="modal-header">
        <h2>Registrar Nueva Mesa</h2>
        <button class="close-modal-btn" onclick={() => showAddModal = false}>✕</button>
      </div>

      {#if addTableError}
        <div class="error-banner">{addTableError}</div>
      {/if}

      <div class="product-form-body">
        <div class="form-group">
          <label for="table-name-input">Nombre / Identificador de la Mesa *</label>
          <input 
            type="text" 
            id="table-name-input" 
            bind:value={newTableName} 
            placeholder="Ej: Mesa 5, Barra 2" 
          />
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" onclick={() => showAddModal = false}>Cancelar</button>
        <button class="btn btn-general" onclick={addTable}>Crear Mesa 🪑</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .tables-view-container {
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

  .tables-header {
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

  .error-banner {
    background: var(--color-danger-glow);
    border: 1px solid rgba(244, 63, 94, 0.2);
    color: #fda4af;
    padding: 10px;
    border-radius: var(--radius-sm);
    font-size: 0.88rem;
  }

  .loading-state {
    height: 250px;
    flex-direction: column;
    gap: 12px;
    color: var(--text-secondary);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(255, 255, 255, 0.05);
    border-top: 3px solid var(--color-general);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Tables Grid */
  .tables-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
    overflow-y: auto;
    padding-bottom: 24px;
  }

  .table-card {
    padding: 20px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 200px;
    transition: var(--transition-normal);
  }

  .table-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
  }

  .table-card.occupied {
    border-color: rgba(245, 158, 11, 0.3);
    box-shadow: 0 4px 20px rgba(245, 158, 11, 0.05);
  }

  .table-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .table-icon {
    font-size: 1.25rem;
  }

  .status-indicator {
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    background: var(--color-market-glow);
    color: var(--color-market);
    padding: 3px 8px;
    border-radius: 4px;
  }

  .status-indicator.occupied {
    background: var(--color-cafe-glow);
    color: var(--color-cafe);
  }

  .table-card-body {
    margin: 12px 0;
  }

  .table-card-body h3 {
    font-size: 1.15rem;
    font-weight: 600;
    margin-bottom: 6px;
    color: var(--text-primary);
  }

  .empty-msg {
    font-size: 0.82rem;
    color: var(--text-secondary);
  }

  .order-summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.88rem;
    margin-bottom: 4px;
  }

  .items-count {
    color: var(--text-secondary);
  }

  .order-total {
    font-weight: 700;
    color: var(--text-primary);
  }

  .order-time {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .table-card-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  .w-100 {
    width: 100%;
  }

  .flex-1 {
    flex: 1;
  }

  .btn-cancel-table {
    background: rgba(244, 63, 94, 0.08);
    border: 1px solid rgba(244, 63, 94, 0.2);
    color: var(--color-danger);
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-weight: 600;
    transition: var(--transition-fast);
    outline: none;
  }

  .btn-cancel-table:hover {
    background: var(--color-danger-glow);
    border-color: var(--color-danger);
    transform: scale(1.02);
  }

  .btn-cancel-table:active {
    transform: scale(0.98);
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .header-left-side {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-delete-table {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.95rem;
    padding: 2px;
    border-radius: var(--radius-sm);
    transition: var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.6;
  }

  .btn-delete-table:hover {
    opacity: 1;
    background: rgba(244, 63, 94, 0.15);
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
</style>
