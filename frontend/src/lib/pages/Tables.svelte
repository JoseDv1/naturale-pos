<script lang="ts">
  import { untrack } from 'svelte';
  import { user, activeTab, selectedTable, cart, refreshTrigger, triggerRefresh } from '../store';
  import { getTables, openTable as apiOpenTable, cancelTableOrder as apiCancelTableOrder, createTable as apiCreateTable, deleteTable as apiDeleteTable } from '../api/tables';
  import TableCard from '../components/organisms/TableCard.svelte';

  let tablesPromise = $state<Promise<any[]>>(getTables());

  // Modal state for adding a table
  let showAddModal = $state(false);
  let newTableName = $state('');
  let addTableError = $state('');

  // Reload tables on refresh trigger
  $effect(() => {
    if ($refreshTrigger) {
      loadTables();
    }
  });

  function loadTables() {
    tablesPromise = getTables();
  }

  async function openTable(table: any) {
    if (table.status !== 'AVAILABLE') return;
    try {
      const data = await apiOpenTable(table.id, $user?.id);
      // Set active table in store
      selectedTable.set({
        id: data.table.id,
        name: data.table.name,
        status: data.table.status,
        currentSaleId: data.table.currentSaleId,
      });
      cart.set([]);
      activeTab.set('checkout');
    } catch (e: any) {
      alert(e.message || 'Error al abrir la mesa');
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
      await apiCancelTableOrder(table.id);
      triggerRefresh();
      loadTables();
    } catch (e: any) {
      alert(e.message || 'Error al cancelar la cuenta de la mesa');
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
      await apiCreateTable(newTableName);
      showAddModal = false;
      loadTables();
    } catch (e: any) {
      addTableError = e.message || 'Error al crear la mesa';
    }
  }

  async function deleteTable(table: any) {
    if (table.status !== 'AVAILABLE') {
      alert('Solo se pueden eliminar mesas libres y disponibles.');
      return;
    }
    if (!confirm(`¿Estás seguro de que deseas eliminar la ${table.name}?`)) return;

    try {
      await apiDeleteTable(table.id);
      loadTables();
    } catch (e: any) {
      alert(e.message || 'Error al eliminar la mesa');
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
      <button class="btn btn-secondary" onclick={loadTables}>
        🔄 Actualizar Salón
      </button>
    </div>
  </div>

  {#await tablesPromise}
    <div class="loading-state flex-center glass-panel">
      <div class="spinner"></div>
      <p>Cargando salón...</p>
    </div>
  {:then resolvedTables}
    <div class="tables-grid">
      {#each resolvedTables as table}
        <TableCard
          {table}
          userRole={$user?.role}
          ondelete={deleteTable}
          onopen={openTable}
          onresume={resumeTable}
          oncancel={cancelTableOrder}
        />
      {/each}
    </div>
  {:catch error}
    <div class="error-banner animate-fade-in">Error al cargar las mesas: {error.message}</div>
  {/await}
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

  .header-actions {
    display: flex;
    gap: 8px;
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
