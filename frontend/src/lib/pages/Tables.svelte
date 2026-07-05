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

  // Handle table selection on click
  function handleTableClick(e: MouseEvent, table: any) {
    if (hasDragged) {
      hasDragged = false;
      return;
    }
    selectedMapTable = table;
  }

  // Double click or direct action to open/resume
  function handleTableDoubleClick(table: any) {
    if (isDesignMode) return;
    
    if (table.status === 'AVAILABLE') {
      openTable(table);
    } else {
      resumeTable(table);
    }
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

    selectedTable.set({
      id: table.id,
      name: table.name,
      status: table.status,
      currentSaleId: table.currentSaleId,
    });

    const items = table.currentSale.items.map((item: any) => ({
      product: item.product,
      quantity: item.quantity,
    }));
    cart.set(items);
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
    let confirmMsg = `¿Estás seguro de que deseas eliminar la ${table.name}?`;
    if (table.status === 'OCCUPIED') {
      confirmMsg = `La ${table.name} tiene un pedido activo. Al eliminarla, se anulará la cuenta y se liberará el stock reservado. ¿Deseas continuar?`;
    }
    if (!confirm(confirmMsg)) return;

    try {
      await apiDeleteTable(table.id);
      loadTables();
    } catch (e: any) {
      alert(e.message || 'Error al eliminar la mesa');
    }
  }

  // Custom Table Shapes
  function setTableShape(tableId: string, shape: 'circle' | 'square' | 'rectangle') {
    tableShapes = { ...tableShapes, [tableId]: shape };
    localStorage.setItem('naturale_table_shapes', JSON.stringify(tableShapes));
  }

  // Dragging positioning logic
  function startDrag(e: MouseEvent | TouchEvent, table: any) {
    if (!isDesignMode) return;
    
    // Stop propagation so it doesn't trigger clicks or container events
    e.stopPropagation();

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    dragStartPos = { x: clientX, y: clientY };
    hasDragged = false;

    if (!containerEl) return;
    const containerRect = containerEl.getBoundingClientRect();
    
    // Calculate table center relative to container
    const tableCenterX = (table.x / 100) * containerRect.width;
    const tableCenterY = (table.y / 100) * containerRect.height;

    // Displacement between cursor and table center
    const mouseXInContainer = clientX - containerRect.left;
    const mouseYInContainer = clientY - containerRect.top;

    activeDragOffset = {
      x: mouseXInContainer - tableCenterX,
      y: mouseYInContainer - tableCenterY
    };

    draggingTableId = table.id;

    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('touchmove', onDragMove, { passive: false });
    window.addEventListener('mouseup', onDragEnd);
    window.addEventListener('touchend', onDragEnd);
  }

  function onDragMove(e: MouseEvent | TouchEvent) {
    if (!draggingTableId || !containerEl) return;
    if (e.cancelable) e.preventDefault();

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    // Check if dragging has started beyond a small threshold
    const dist = Math.hypot(clientX - dragStartPos.x, clientY - dragStartPos.y);
    if (dist > 4) {
      hasDragged = true;
    }

    const containerRect = containerEl.getBoundingClientRect();
    const mouseX = clientX - containerRect.left;
    const mouseY = clientY - containerRect.top;

    // Calculate new center
    let newCenterX = mouseX - activeDragOffset.x;
    let newCenterY = mouseY - activeDragOffset.y;

    // Convert back to percentage
    let newXPercent = (newCenterX / containerRect.width) * 100;
    let newYPercent = (newCenterY / containerRect.height) * 100;

    // Clamp coordinates to keep table nodes fully inside container
    newXPercent = Math.max(8, Math.min(92, newXPercent));
    newYPercent = Math.max(8, Math.min(92, newYPercent));

    tables = tables.map(t => {
      if (t.id === draggingTableId) {
        return { ...t, x: newXPercent, y: newYPercent };
      }
      return t;
    });
    
    // Keep selectedMapTable position synchronized
    if (selectedMapTable && selectedMapTable.id === draggingTableId) {
      selectedMapTable.x = newXPercent;
      selectedMapTable.y = newYPercent;
    }
  }

  async function onDragEnd() {
    if (!draggingTableId) return;

    const currentDraggingId = draggingTableId;
    draggingTableId = null;

    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('touchmove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);
    window.removeEventListener('touchend', onDragEnd);

    // Save final position to API
    const tableObj = tables.find(t => t.id === currentDraggingId);
    if (tableObj) {
      try {
        await fetch(`/api/tables/${currentDraggingId}/position`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ x: tableObj.x, y: tableObj.y }),
        });
      } catch (err) {
        console.error('Failed to save table position:', err);
      }
    }
  }

  // Calculate global statistics
  const totalTablesCount = $derived(tables.length);
  const occupiedCount = $derived(tables.filter(t => t.status === 'OCCUPIED').length);
  const availableCount = $derived(tables.filter(t => t.status === 'AVAILABLE').length);
  const activeSalesTotal = $derived(tables.reduce((sum, t) => sum + (t.currentSale ? parseFloat(t.currentSale.total) : 0), 0));
</script>

{#snippet headerSection()}
  <div class="tables-header glass-panel">
    <div class="header-left">
      <h2>Salón y Mapa de Mesas 🪑</h2>
      <p class="subtitle">Administra los pedidos activos por mesa y posiciona las mesas según la distribución del salón.</p>
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

      <div class="stats-list">
        <div class="stat-item">
          <span class="label">Total Mesas:</span>
          <span class="value">{totalTablesCount}</span>
        </div>
        <div class="stat-item">
          <span class="label text-market">Mesas Libres:</span>
          <span class="value text-market">{availableCount}</span>
        </div>
        <div class="stat-item">
          <span class="label text-cafe">Mesas Ocupadas:</span>
          <span class="value text-cafe">{occupiedCount}</span>
        </div>
        <div class="stat-item-total">
          <span class="label">Comandado en Curso:</span>
          <span class="value">${activeSalesTotal.toLocaleString()}</span>
        </div>
      </div>

      <div class="salon-info-box">
        <h4>🌿 Naturale Café</h4>
        <p>Selecciona una mesa en el mapa para administrar comandas de consumo, facturación de cuentas o reordenamiento del salón.</p>
      </div>
    </div>
  </div>
{/snippet}

{#snippet addTableModal()}
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
{/snippet}

<!-- Main Layout -->
<div class="tables-view-container flex-column animate-fade-in">
  {@render headerSection()}

  {#if errorMsg}
    <div class="error-banner">{errorMsg}</div>
  {/if}

  {#if isLoading && tables.length === 0}
    {@render loadingState()}
  {:else}
    <div class="tables-main-layout">
      <!-- Left side: The Visual Map or Grid View -->
      <div class="map-view-column flex-1">
        {#if isMapView}
          <div class="map-wrapper glass-panel">
            <div class="map-legend">
              <div class="legend-item">
                <span class="legend-dot status-available"></span>
                <span>Disponible</span>
              </div>
              <div class="legend-item">
                <span class="legend-dot status-occupied"></span>
                <span>Ocupada</span>
              </div>
              {#if isDesignMode}
                <div class="legend-item design-badge animate-pulse">
                  🔧 Modo Diseño Activo: Arrastra las mesas para reubicarlas. Double click en cualquier mesa para abrirla.
                </div>
              {/if}
            </div>

            <div 
              class="map-container" 
              bind:this={containerEl} 
              class:design-active={isDesignMode}
              onclick={(e) => {
                if (e.target === e.currentTarget) {
                  selectedMapTable = null;
                }
              }}
              role="none"
            >
              <!-- Blueprint grid lines -->
              <div class="map-grid-overlay"></div>

              <!-- Tables rendered on map -->
              {#each tables as table}
                {@render mapTableNode(table)}
              {/each}
            </div>
          </div>
        {:else}
          <div class="tables-grid">
            {#each tables as table}
              {@render tableCard(table)}
            {/each}
          </div>
        {/if}
      </div>

      <!-- Right side: Detail/Stats panel -->
      <div class="details-column glass-panel">
        {#if selectedMapTable}
          {@render tableDetailPanel(selectedMapTable)}
        {:else}
          {@render salonStatsPanel()}
        {/if}
      </div>
    </div>
  {/if}
</div>

{@render addTableModal()}

<style>
  .tables-view-container {
    height: 100%;
    width: 100%;
    gap: 16px;
    padding: 6px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
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
    color: var(--text-primary);
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
    height: 350px;
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

  /* Main Layout Split Screen */
  .tables-main-layout {
    display: flex;
    flex: 1;
    gap: 16px;
    height: calc(100vh - 120px);
    overflow: hidden;
  }

  .map-view-column {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: 100%;
    flex: 1;
    min-width: 0;
  }

  .flex-1 {
    flex: 1;
    min-width: 0;
    min-height: 0;
  }

  .details-column {
    width: 360px;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Header actions layout */
  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .mode-toggles {
    display: flex;
    background: rgba(0, 0, 0, 0.15);
    padding: 3px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-glass);
  }

  .toggle-btn {
    background: transparent;
    border: none;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--text-secondary);
    cursor: pointer;
    transition: var(--transition-fast);
    outline: none;
  }

  .toggle-btn.active {
    background: var(--bg-glass);
    color: var(--text-primary);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .btn-design-mode {
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.2);
    color: #f59e0b;
    font-size: 0.88rem;
    padding: 9px 15px;
    border-radius: var(--radius-sm);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-design-mode.active, .btn-design-mode:hover {
    background: #f59e0b;
    color: #fff;
    box-shadow: 0 0 15px rgba(245, 158, 11, 0.2);
  }

  /* Regular Grid View Mode */
  .tables-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
    overflow-y: auto;
    padding-bottom: 24px;
    height: 100%;
  }

  .occupancy-circle {
    width: 110px;
    height: 110px;
    border-radius: 50%;
    background: conic-gradient(
      var(--color-cafe) var(--occupancy-percent),
      var(--bg-secondary) 0%
    );
    position: relative;
    box-shadow: 0 4px 10px rgba(0,0,0,0.04);
  }



  /* Modals formatting overlay */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(3, 7, 18, 0.3);
    backdrop-filter: blur(6px);
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
  }

  .product-form-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
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
