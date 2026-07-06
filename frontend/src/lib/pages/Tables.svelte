<script lang="ts">
  import { untrack, onMount } from 'svelte';
  import { user, activeTab, selectedTable, cart, refreshTrigger, triggerRefresh } from '../store';
  import { getTables, openTable as apiOpenTable, cancelTableOrder as apiCancelTableOrder, createTable as apiCreateTable, deleteTable as apiDeleteTable } from '../api/tables';
  import TableCard from '../components/organisms/TableCard.svelte';

  let tables = $state<any[]>([]);
  let isLoading = $state(false);
  let errorMsg = $state('');

  // UI state
  let isMapView = $state(true); // Toggle Map vs Grid view
  let isDesignMode = $state(false); // Toggle rearranging tables
  let selectedMapTable = $state<any | null>(null);

  // Dragging state
  let containerEl = $state<HTMLDivElement | null>(null);
  let draggingTableId = $state<string | null>(null);
  let activeDragOffset = $state({ x: 0, y: 0 });
  let hasDragged = $state(false);
  let dragStartPos = { x: 0, y: 0 };

  // Table shapes database (persists in localStorage)
  let tableShapes = $state<Record<string, 'circle' | 'square' | 'rectangle'>>({});

  let tablesPromise = $state<Promise<any[]>>(Promise.resolve([]));

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

  async function loadTables() {
    isLoading = true;
    errorMsg = '';
    tablesPromise = getTables();
    try {
      tables = await tablesPromise;
    } catch (e: any) {
      errorMsg = e.message || 'Error al cargar las mesas';
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    loadTables();

    // Load shapes from localStorage
    const savedShapes = localStorage.getItem('naturale_table_shapes');
    if (savedShapes) {
      try {
        tableShapes = JSON.parse(savedShapes);
      } catch (e) {
        console.error('Failed to parse table shapes');
      }
    }
  });

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
      <!-- Layout Mode toggles -->
      <div class="mode-toggles">
        <button class="toggle-btn" class:active={isMapView} onclick={() => isMapView = true} title="Vista Plano">
          🗺️ Plano
        </button>
        <button class="toggle-btn" class:active={!isMapView} onclick={() => { isMapView = false; isDesignMode = false; }} title="Vista Rejilla">
          🔳 Rejilla
        </button>
      </div>

      {#if isMapView}
        <button class="btn btn-design-mode" class:active={isDesignMode} onclick={() => { isDesignMode = !isDesignMode; if(!isDesignMode) selectedMapTable = null; }}>
          🛠️ {isDesignMode ? 'Salir de Diseño' : 'Modo Diseño'}
        </button>
      {/if}

      {#if $user?.role === 'ADMIN'}
        <button class="btn btn-general" onclick={openAddModal}>
          ➕ Nueva Mesa
        </button>
      {/if}
      <button class="btn btn-secondary" onclick={loadTables} disabled={isLoading}>
        🔄 Actualizar
      </button>
    </div>
  </div>
{/snippet}

{#snippet loadingState()}
  <div class="loading-state flex-center glass-panel">
    <div class="spinner"></div>
    <p>Cargando salón...</p>
  </div>
{/snippet}

{#snippet mapTableNode(table: any)}
  {@const shape = tableShapes[table.id] || 'circle'}
  <div
    role="button"
    tabindex="0"
    aria-label="Mesa {table.name}"
    class="map-table-node shape-{shape} animate-scale-up"
    class:occupied={table.status === 'OCCUPIED'}
    class:dragging={draggingTableId === table.id}
    class:design-mode={isDesignMode}
    class:selected={selectedMapTable?.id === table.id}
    style="left: {table.x}%; top: {table.y}%;"
    onmousedown={(e) => startDrag(e, table)}
    ontouchstart={(e) => startDrag(e, table)}
    onclick={(e) => handleTableClick(e, table)}
    ondblclick={() => handleTableDoubleClick(table)}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleTableClick(e as any, table); }}
  >
    <!-- Indicator status dot -->
    <div class="table-node-dot" class:occupied={table.status === 'OCCUPIED'}></div>

    <span class="table-node-name">{table.name}</span>

    {#if table.status === 'OCCUPIED' && table.currentSale}
      <span class="table-node-total">${Math.round(table.currentSale.total).toLocaleString()}</span>
    {/if}

    {#if isDesignMode}
      <div class="drag-handle-badge">✥</div>
    {/if}
  </div>
{/snippet}

{#snippet tableDetailPanel(table: any)}
  <div class="panel-container flex-column animate-fade-in">
    <div class="panel-header">
      <div class="panel-title-group">
        <h3>{table.name}</h3>
        <span class="panel-badge" class:occupied={table.status === 'OCCUPIED'}>
          {table.status === 'OCCUPIED' ? 'Mesa Ocupada' : 'Mesa Libre'}
        </span>
      </div>
      <button class="btn-close-panel" onclick={() => selectedMapTable = null} title="Cerrar Detalles">✕</button>
    </div>

    <div class="panel-content flex-1">
      {#if table.status === 'OCCUPIED' && table.currentSale}
        <div class="active-order-details">
          <h4>Comanda Activa</h4>
          <p class="opened-time">Abierta: {new Date(table.currentSale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>

          <div class="order-items-scroll">
            {#each table.currentSale.items as item}
              <div class="panel-order-item">
                <span class="qty-badge">{item.quantity}</span>
                <span class="item-name">{item.product.name}</span>
                <span class="item-subtotal">${(item.quantity * parseFloat(item.price)).toLocaleString()}</span>
              </div>
            {/each}
          </div>

          <div class="panel-total-divider"></div>
          <div class="panel-total-row">
            <span>Total Acumulado:</span>
            <span class="grand-total">${parseFloat(table.currentSale.total).toLocaleString()}</span>
          </div>
        </div>
      {:else}
        <div class="panel-empty-state flex-center">
          <span class="empty-icon">🪑</span>
          <p>Mesa disponible. No hay cuentas ni comandas activas registradas en este momento.</p>
        </div>
      {/if}

      <!-- Table customization & deletion Section -->
      <div class="admin-panel-tools">
        <h4>Ajustes de Mesa</h4>

        <div class="tool-group">
          <span>Forma del Mobiliario:</span>
          <div class="shape-selector">
            <button
              class="shape-btn"
              class:active={(tableShapes[table.id] || 'circle') === 'circle'}
              onclick={() => setTableShape(table.id, 'circle')}
            >
              🔴 Círculo
            </button>
            <button
              class="shape-btn"
              class:active={tableShapes[table.id] === 'square'}
              onclick={() => setTableShape(table.id, 'square')}
            >
              🟩 Cuadrado
            </button>
            <button
              class="shape-btn"
              class:active={tableShapes[table.id] === 'rectangle'}
              onclick={() => setTableShape(table.id, 'rectangle')}
            >
              ▰ Rectángulo
            </button>
          </div>
        </div>

        {#if isDesignMode}
          <div class="design-mode-help">
            <p>✥ Arrastra la mesa en el mapa para ubicarla en su posición física.</p>
          </div>
        {/if}

        <button class="btn btn-danger w-100" style="margin-top: 15px;" onclick={() => deleteTable(table)}>
          🗑️ Eliminar Mesa
        </button>
      </div>
    </div>

    <div class="panel-footer">
      {#if table.status === 'AVAILABLE'}
        <button class="btn btn-market w-100 py-3" onclick={() => openTable(table)}>
          Abrir Mesa / Comanda 🪑
        </button>
      {:else}
        <div class="footer-actions-row">
          <button class="btn btn-cafe flex-1 py-3" onclick={() => resumeTable(table)}>
            Ver Cuenta / Facturar 🛒
          </button>
          <button class="btn btn-danger-outline" onclick={() => cancelTableOrder(table)} title="Anular Cuenta">
            ✕ Anular
          </button>
        </div>
      {/if}
    </div>
  </div>
{/snippet}

{#snippet salonStatsPanel()}
  <div class="panel-container flex-column animate-fade-in">
    <div class="panel-header">
      <h3>Estado General del Salón</h3>
    </div>

    <div class="panel-content flex-1">
      <!-- Circle occupancy visualization -->
      <div class="occupancy-graph flex-center">
        <div class="occupancy-circle flex-center" style="--occupancy-percent: {totalTablesCount > 0 ? (occupiedCount / totalTablesCount) * 100 : 0}%">
          <div class="circle-content">
            <span class="percentage">
              {totalTablesCount > 0 ? Math.round((occupiedCount / totalTablesCount) * 100) : 0}%
            </span>
            <span class="desc">Ocupación</span>
          </div>
        </div>
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
    align-content: start;
  }

  /* Interactive Visual Map View Mode */
  .map-wrapper {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    padding: 16px;
    gap: 12px;
    overflow: hidden;
  }

  .map-legend {
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 0.78rem;
    color: var(--text-secondary);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .status-available { background: var(--color-general); }
  .status-occupied { background: var(--color-cafe); }

  .design-badge {
    background: rgba(245, 158, 11, 0.1);
    color: #f59e0b;
    padding: 3px 10px;
    border-radius: 4px;
    border: 1px solid rgba(245, 158, 11, 0.2);
    font-weight: 500;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.8; }
  }

  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  .map-container {
    position: relative;
    flex: 1;
    min-height: 0;
    width: 100%;
    background-color: #f1f6f3; /* Soft sage light blueprint background */
    border: 1px solid rgba(16, 185, 129, 0.2);
    border-radius: var(--radius-md);
    overflow: hidden;
    /* Soft grid pattern */
    background-image: radial-gradient(rgba(16, 185, 129, 0.12) 1px, transparent 1px);
    background-size: 20px 20px;
    box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.05);
  }

  .map-container.design-active {
    border-color: rgba(245, 158, 11, 0.4);
    box-shadow: inset 0 0 15px rgba(245, 158, 11, 0.08);
  }

  .map-grid-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    border: 1px solid rgba(16, 185, 129, 0.05);
  }

  /* Table Node on the Map styling */
  .map-table-node {
    position: absolute;
    transform: translate(-50%, -50%);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    background: #ffffff;
    border: 2px solid var(--color-general);
    color: var(--text-primary);
    z-index: 10;
    user-select: none;
    outline: none;
    transition: background-color var(--transition-fast), border-color var(--transition-fast), transform var(--transition-fast), box-shadow var(--transition-fast);
  }

  .map-table-node:hover {
    transform: translate(-50%, -50%) scale(1.08);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
  }

  .map-table-node.selected {
    border-color: #6366f1 !important; /* Indigo selection ring */
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25), 0 6px 16px rgba(99, 102, 241, 0.2) !important;
  }

  .map-table-node.occupied {
    border-color: var(--color-cafe);
    background: #fffcf8;
  }

  .map-table-node.occupied:hover {
    border-color: var(--color-cafe-hover);
  }

  .map-table-node.dragging {
    opacity: 0.85;
    z-index: 100;
    cursor: grabbing;
    transform: translate(-50%, -50%) scale(1.12);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.18);
  }

  .map-table-node.design-mode {
    border-style: dashed;
    cursor: move;
  }

  /* Table shapes styling */
  .shape-circle {
    border-radius: 50%;
    width: 82px;
    height: 82px;
  }

  .shape-square {
    border-radius: var(--radius-sm);
    width: 82px;
    height: 82px;
  }

  .shape-rectangle {
    border-radius: var(--radius-sm);
    width: 110px;
    height: 72px;
  }

  /* Nodes visual text decoration */
  .table-node-name {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .table-node-total {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--color-cafe-hover);
    margin-top: 2px;
  }

  .table-node-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-general);
    margin-bottom: 4px;
  }

  .table-node-dot.occupied {
    background: var(--color-cafe);
  }

  .drag-handle-badge {
    position: absolute;
    bottom: -6px;
    background: #f59e0b;
    color: #fff;
    font-size: 0.65rem;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  /* Right Side Panels - Detail & Stats */
  .panel-container {
    height: 100%;
    width: 100%;
    padding: 20px;
    justify-content: space-between;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border-glass);
    margin-bottom: 16px;
  }

  .panel-title-group h3 {
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .panel-badge {
    display: inline-block;
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    background: var(--color-market-glow);
    color: var(--color-market);
    padding: 2px 8px;
    border-radius: 4px;
    margin-top: 4px;
  }

  .panel-badge.occupied {
    background: var(--color-cafe-glow);
    color: var(--color-cafe);
  }

  .btn-close-panel {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 1.2rem;
    cursor: pointer;
    outline: none;
  }

  .panel-content {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding-right: 2px;
  }

  /* Active Order Details Panel */
  .active-order-details h4 {
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--text-muted);
    letter-spacing: 0.6px;
    margin-bottom: 4px;
  }

  .opened-time {
    font-size: 0.78rem;
    color: var(--text-muted);
    margin-bottom: 12px;
  }

  .order-items-scroll {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 220px;
    overflow-y: auto;
    border: 1px solid var(--border-glass);
    padding: 8px;
    border-radius: var(--radius-sm);
    background: rgba(0, 0, 0, 0.02);
  }

  .panel-order-item {
    display: flex;
    align-items: center;
    font-size: 0.82rem;
    gap: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(0,0,0,0.02);
  }
  
  .panel-order-item:last-child {
    border-bottom: none;
  }

  .qty-badge {
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-size: 0.72rem;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
    min-width: 22px;
    text-align: center;
  }

  .item-name {
    flex: 1;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-subtotal {
    font-weight: 600;
    color: var(--text-primary);
  }

  .panel-total-divider {
    height: 1px;
    background: var(--border-glass);
    margin: 12px 0 8px 0;
  }

  .panel-total-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .panel-total-row span {
    font-size: 0.88rem;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .grand-total {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-cafe);
  }

  .panel-empty-state {
    text-align: center;
    flex-direction: column;
    padding: 30px 10px;
    color: var(--text-muted);
    font-size: 0.82rem;
    line-height: 1.5;
    background: rgba(16, 185, 129, 0.02);
    border: 1px dashed var(--border-glass);
    border-radius: var(--radius-sm);
  }

  .empty-icon {
    font-size: 2.2rem;
    margin-bottom: 8px;
    opacity: 0.5;
  }

  /* Admin tools panel */
  .admin-panel-tools {
    border-top: 1px solid var(--border-glass);
    padding-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .admin-panel-tools h4 {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    margin-bottom: 4px;
  }

  .tool-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .tool-group span {
    font-size: 0.78rem;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .shape-selector {
    display: flex;
    gap: 6px;
  }

  .shape-btn {
    flex: 1;
    background: rgba(0, 0, 0, 0.03);
    border: 1px solid var(--border-glass);
    color: var(--text-secondary);
    padding: 8px 4px;
    border-radius: 6px;
    font-size: 0.72rem;
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
    outline: none;
  }

  .shape-btn.active, .shape-btn:hover {
    background: #ffffff;
    color: var(--text-primary);
    border-color: var(--color-general);
    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
  }

  .design-mode-help {
    background: rgba(245, 158, 11, 0.05);
    border: 1px solid rgba(245, 158, 11, 0.15);
    padding: 10px;
    border-radius: var(--radius-sm);
    color: #b45309;
    font-size: 0.75rem;
    line-height: 1.4;
  }

  /* Salon Stats panel visual graphics */
  .occupancy-graph {
    height: 140px;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
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
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .circle-content {
    width: 88px;
    height: 88px;
    border-radius: 50%;
    background: var(--bg-primary);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .circle-content .percentage {
    font-size: 1.3rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .circle-content .desc {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
  }

  .stats-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 12px;
  }

  .stat-item {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    color: var(--text-secondary);
    padding: 4px 0;
    border-bottom: 1px solid rgba(0,0,0,0.03);
  }

  .stat-item-total {
    display: flex;
    justify-content: space-between;
    font-size: 0.95rem;
    font-weight: 700;
    padding-top: 8px;
    border-top: 1px solid var(--border-glass);
    color: var(--text-primary);
  }

  .salon-info-box {
    background: rgba(16, 185, 129, 0.02);
    border: 1px solid var(--border-glass);
    padding: 12px;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .salon-info-box h4 {
    font-size: 0.82rem;
    font-weight: 600;
    margin-bottom: 4px;
    color: var(--color-general);
  }

  .salon-info-box p {
    font-size: 0.75rem;
  }

  /* Panel footer buttons */
  .panel-footer {
    border-top: 1px solid var(--border-glass);
    padding-top: 16px;
    margin-top: 16px;
  }

  .footer-actions-row {
    display: flex;
    gap: 8px;
  }

  .btn-danger-outline {
    background: transparent;
    border: 1px solid rgba(244, 63, 94, 0.3);
    color: var(--color-danger);
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-weight: 500;
    font-size: 0.88rem;
    transition: var(--transition-fast);
    outline: none;
  }

  .btn-danger-outline:hover {
    background: var(--color-danger-glow);
    border-color: var(--color-danger);
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
