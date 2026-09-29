<script lang="ts">
  import { refreshTrigger, triggerRefresh } from '../store';
  import { getDashboardData, getInventoryAlerts } from '../api/reports';
  import { getSales, cancelSale as apiCancelSale } from '../api/sales';
  import { getShifts } from '../api/shifts';
  import KpiCard from '../components/molecules/KpiCard.svelte';
  import PayMethodBar from '../components/molecules/PayMethodBar.svelte';
  import AlertItem from '../components/molecules/AlertItem.svelte';
  import SaleRow from '../components/organisms/SaleRow.svelte';
  import SaleDetailModal from '../components/organisms/SaleDetailModal.svelte';
  import ShiftDetailModal from '../components/organisms/ShiftDetailModal.svelte';
  import Spinner from '../components/atoms/Spinner.svelte';

  // Filters
  let startDate = $state('');
  let endDate = $state('');
  let activeTab = $state('CONSOLIDATED'); // 'CONSOLIDATED' | 'MARKET' | 'CAFE'

  // Subtab switch between Sales History and Shift Closures
  let historySubTab = $state<'sales' | 'shifts'>('sales');

  // Sales History Interactive Filters
  let searchQuery = $state('');
  let selectedStatus = $state('ALL'); // 'ALL' | 'COMPLETED' | 'CANCELLED' | 'TRANSFER_OUT'
  let selectedPayment = $state('ALL'); // 'ALL' | 'CASH' | 'CARD' | 'TRANSFER' | 'INTERNAL'
  let salesList = $state<any[]>([]);

  // Shift History State
  let shiftsList = $state<any[]>([]);
  let shiftsPromise = $state<Promise<any[]>>(getShifts());
  let selectedShiftId = $state<string | null>(null);
  let showShiftDetailModal = $state(false);

  // Modal State for Sale Ticket Details
  let showDetailModal = $state(false);
  let selectedSale = $state<any | null>(null);

  let reportsPromise = $state<Promise<any>>(getDashboardData());
  let lowStockPromise = $state<Promise<any[]>>(getInventoryAlerts());
  let salesPromise = $state<Promise<any[]>>(getSales());

  $effect(() => {
    if ($refreshTrigger) {
      loadReports();
      loadLowStock();
      loadSalesHistory();
      loadShifts();
    }
  });

  function loadReports() {
    reportsPromise = getDashboardData(startDate, endDate);
  }

  function loadLowStock() {
    lowStockPromise = getInventoryAlerts();
  }

  function loadSalesHistory(): Promise<any[]> {
    const p: Promise<any[]> = getSales({
      q: searchQuery.trim() || undefined,
      status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
      paymentMethod: selectedPayment !== 'ALL' ? selectedPayment : undefined,
      start: startDate ? new Date(startDate).toISOString() : undefined,
      end: endDate ? new Date(endDate + 'T23:59:59.999Z').toISOString() : undefined,
    }).then((data) => {
      salesList = data;
      return data;
    });
    salesPromise = p;
    return p;
  }

  function loadShifts(): Promise<any[]> {
    const p: Promise<any[]> = getShifts().then((data) => {
      shiftsList = data;
      return data;
    });
    shiftsPromise = p;
    return p;
  }

  function handleDateChange() {
    loadReports();
    loadSalesHistory();
    loadShifts();
  }

  function resetDateFilters() {
    startDate = '';
    endDate = '';
    searchQuery = '';
    selectedStatus = 'ALL';
    selectedPayment = 'ALL';
    loadReports();
    loadSalesHistory();
  }

  // Real-time client filter on sales list for instantaneous feedback
  let filteredSales = $derived.by(() => {
    const q = searchQuery.trim().toLowerCase();
    return salesList.filter((s) => {
      if (selectedStatus !== 'ALL' && s.status !== selectedStatus) {
        return false;
      }
      if (selectedPayment !== 'ALL') {
        const hasMethod = s.payments && s.payments.some((p: any) => p.method === selectedPayment);
        if (!hasMethod) return false;
      }
      if (q) {
        const ticketMatch = (s.id || '').toLowerCase().includes(q);
        const cashierMatch =
          (s.user?.name || '').toLowerCase().includes(q) ||
          (s.user?.username || '').toLowerCase().includes(q);
        const productMatch =
          s.items &&
          s.items.some(
            (it: any) =>
              (it.product?.name || '').toLowerCase().includes(q) ||
              (it.variant?.name || '').toLowerCase().includes(q)
          );
        if (!ticketMatch && !cashierMatch && !productMatch) {
          return false;
        }
      }
      return true;
    });
  });

  function openSaleDetail(sale: any) {
    selectedSale = sale;
    showDetailModal = true;
  }

  async function cancelSale(saleId: string) {
    if (!confirm('¿Estás seguro de que deseas ANULAR esta venta? Esto reintegrará el stock y cancelará los ingresos.')) return;

    try {
      await apiCancelSale(saleId);
      triggerRefresh();
    } catch (e: any) {
      alert(e.message || 'Error al cancelar la venta');
    }
  }
</script>

<div class="reports-container flex-column animate-fade-in">
  <!-- Top Filter Bar -->
  <div class="reports-header glass-panel">
    <div class="header-left">
      <h2>Estadísticas y Reportes Financieros 📊</h2>
    </div>

    <div class="date-filters">
      <div class="date-input-group">
        <label for="start-d">Desde</label>
        <input type="date" id="start-d" bind:value={startDate} onchange={handleDateChange} />
      </div>
      <div class="date-input-group">
        <label for="end-d">Hasta</label>
        <input type="date" id="end-d" bind:value={endDate} onchange={handleDateChange} />
      </div>
      <button class="btn btn-secondary" onclick={resetDateFilters} title="Limpiar Filtros">
        🔄 Restablecer
      </button>
    </div>
  </div>

  {#await Promise.all([reportsPromise, lowStockPromise])}
    <div class="loading-state flex-center glass-panel" style="padding: 40px 0;">
      <Spinner size="40px" />
      <p style="margin-top: 12px; color: var(--text-secondary);">Cargando estadísticas...</p>
    </div>
  {:then [data, alerts]}
    <!-- Tab Selector (Consolidated, Market, Cafe) -->
    <div class="tab-navigator glass-panel">
      <button class="tab-link" class:active={activeTab === 'CONSOLIDATED'} onclick={() => (activeTab = 'CONSOLIDATED')}>
        🏛️ Consolidado General
      </button>
      <button class="tab-link" class:active={activeTab === 'MARKET'} onclick={() => (activeTab = 'MARKET')}>
        🍏 Mercado Saludable
      </button>
      <button class="tab-link" class:active={activeTab === 'CAFE'} onclick={() => (activeTab = 'CAFE')}>
        ☕ Café
      </button>
    </div>

    <!-- KPI Dashboard Cards -->
    <div class="dashboard-grid animate-scale-up">
      <!-- Ingresos -->
      {#if activeTab !== 'GENERAL'}
        <KpiCard title="Ingresos Totales (Ventas)" value={"$" + (data[activeTab]?.revenue || 0).toLocaleString()} desc="Ventas registradas en el período" borderClass="border-general" textClass="text-general" animate={false} />
      {/if}

      <!-- Costo de Ventas -->
      {#if activeTab !== 'GENERAL'}
        <KpiCard title="Costo de Ventas (COGS)" value={"$" + (data[activeTab]?.costOfSales || 0).toLocaleString()} desc="Costo de compra de los artículos vendidos" borderClass="border-cafe" textClass="text-cafe" animate={false} />
      {/if}

      <!-- Utilidad Bruta -->
      {#if activeTab !== 'GENERAL'}
        <KpiCard title="Utilidad Bruta" value={"$" + (data[activeTab]?.grossProfit || 0).toLocaleString()} desc="Margen antes de gastos fijos/operativos" borderClass="border-market" textClass="text-market" animate={false} />
      {/if}

      <!-- Gastos Operativos -->
      <KpiCard title="Gastos / Compras" value={"$" + (data[activeTab]?.expenses || 0).toLocaleString()} desc={activeTab === 'CONSOLIDATED' ? 'Incluye Gastos Generales: $' + data.GENERAL.expenses.toLocaleString() : 'Gastos asignados a este departamento'} borderClass="border-danger" textClass="text-danger" animate={false} />

      <!-- Utilidad Neta -->
      {#if activeTab !== 'GENERAL'}
        <KpiCard title="Utilidad Neta" value={"$" + (data[activeTab]?.netProfit || 0).toLocaleString()} desc="Rendimiento neto real (Utilidad Bruta - Gastos)" borderClass="border-net" isNegative={(data[activeTab]?.netProfit || 0) < 0} animate={false} />
      {/if}
    </div>

    <!-- Split Visual: Payments Methods & Inventory Alerts -->
    <div class="secondary-dashboard-row">
      <!-- Payment Methods -->
      <div class="visual-panel glass-panel flex-1 animate-scale-up">
        <h3>Distribución de Medios de Pago</h3>
        <div class="payment-methods-grid">
          <PayMethodBar label="💵 Efectivo:" amount={data.paymentMethods.CASH} />
          <PayMethodBar label="💳 Tarjeta:" amount={data.paymentMethods.CARD} />
          <PayMethodBar label="📲 Transferencia:" amount={data.paymentMethods.TRANSFER} />
          <PayMethodBar label="🔄 Traslado Interno (Virtual):" amount={data.paymentMethods.INTERNAL} />
        </div>
      </div>

      <!-- Low Stock Alerts -->
      <div class="visual-panel glass-panel flex-1 animate-scale-up">
        <h3>⚠️ Alertas de Inventario Bajo</h3>
        <div class="alerts-list scroll-y">
          {#each alerts as item}
            <AlertItem {item} />
          {:else}
            <div class="no-alerts">
              ✅ Todos los productos tienen stock suficiente.
            </div>
          {/each}
        </div>
      </div>
    </div>
  {:catch error}
    <div class="error-banner animate-fade-in" style="margin: 20px;">
      Error al cargar estadísticas: {error.message}
    </div>
  {/await}

  <!-- ==========================================
       SALES HISTORY & MULTI-FACET FILTERS
       ========================================== -->
  <div class="sales-history-panel glass-panel flex-1 flex-column animate-scale-up">
    <div class="panel-top-row">
      <div class="history-subtab-switch">
        <button
          type="button"
          class="subtab-btn"
          class:active={historySubTab === 'sales'}
          onclick={() => (historySubTab = 'sales')}
        >
          📋 Historial de Ventas
          <span class="count-pill">
            {filteredSales.length} {filteredSales.length === 1 ? 'venta' : 'ventas'}
          </span>
        </button>
        <button
          type="button"
          class="subtab-btn"
          class:active={historySubTab === 'shifts'}
          onclick={() => { historySubTab = 'shifts'; loadShifts(); }}
        >
          🔒 Turnos y Cierres de Caja
          <span class="count-pill">
            {shiftsList.length} {shiftsList.length === 1 ? 'turno' : 'turnos'}
          </span>
        </button>
      </div>
    </div>

    {#if historySubTab === 'sales'}
      <!-- Real-Time Interactive Filter Toolbar for Sales -->
      <div class="sales-filter-toolbar">
        <!-- Search Input -->
        <div class="search-field">
          <span class="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Buscar por # ticket, cajero o producto..."
            bind:value={searchQuery}
            class="sales-search-input"
            aria-label="Buscar ventas"
          />
          {#if searchQuery}
            <button type="button" class="btn-clear-search" onclick={() => (searchQuery = '')}>✕</button>
          {/if}
        </div>

        <!-- Status Filter -->
        <div class="filter-select-group">
          <label for="status-filter">Estado:</label>
          <select id="status-filter" bind:value={selectedStatus} class="filter-select">
            <option value="ALL">Todos los Estados</option>
            <option value="COMPLETED">✅ Completadas</option>
            <option value="CANCELLED">❌ Anuladas</option>
            <option value="TRANSFER_OUT">🔄 Traslados</option>
          </select>
        </div>

        <!-- Payment Method Filter -->
        <div class="filter-select-group">
          <label for="payment-filter">Método de Pago:</label>
          <select id="payment-filter" bind:value={selectedPayment} class="filter-select">
            <option value="ALL">Todos los Métodos</option>
            <option value="CASH">💵 Efectivo</option>
            <option value="CARD">💳 Tarjeta</option>
            <option value="TRANSFER">📲 Transferencia</option>
            <option value="INTERNAL">🔄 Interno</option>
          </select>
        </div>

        {#if searchQuery || selectedStatus !== 'ALL' || selectedPayment !== 'ALL'}
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            onclick={() => { searchQuery = ''; selectedStatus = 'ALL'; selectedPayment = 'ALL'; }}
          >
            Limpiar Filtros
          </button>
        {/if}
      </div>

      <div class="table-container scroll-y flex-1">
        {#await salesPromise}
          <div class="loading-state flex-center" style="padding: 40px 0;">
            <Spinner size="40px" />
            <p style="margin-top: 12px; color: var(--text-secondary);">Cargando historial...</p>
          </div>
        {:then}
          <table class="pos-table" aria-label="Historial de Ventas">
            <thead>
              <tr>
                <th>ID Ticket</th>
                <th>Fecha y Hora</th>
                <th>Usuario</th>
                <th>Productos</th>
                <th>Métodos de Pago</th>
                <th class="text-right">Total</th>
                <th class="text-center">Estado</th>
                <th class="text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredSales as sale (sale.id)}
                <SaleRow {sale} oncancel={cancelSale} onview={openSaleDetail} />
              {:else}
                <tr>
                  <td colspan="8" class="text-center text-muted italic" style="padding: 30px;">
                    No se encontraron ventas que coincidan con los filtros aplicados.
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:catch error}
          <div class="error-banner animate-fade-in" style="margin: 20px;">
            Error al cargar historial: {error.message}
          </div>
        {/await}
      </div>
    {:else}
      <!-- Shifts and Cash Closures Table -->
      <div class="table-container scroll-y flex-1">
        {#await shiftsPromise}
          <div class="loading-state flex-center" style="padding: 40px 0;">
            <Spinner size="40px" />
            <p style="margin-top: 12px; color: var(--text-secondary);">Cargando turnos y cierres de caja...</p>
          </div>
        {:then}
          <table class="pos-table" aria-label="Turnos y Cierres de Caja">
            <thead>
              <tr>
                <th>ID Turno</th>
                <th>Apertura</th>
                <th>Cajero</th>
                <th>Cierre</th>
                <th>Estado</th>
                <th class="text-right">Base Inicial</th>
                <th class="text-right">Efectivo Real</th>
                <th class="text-right">Diferencia</th>
                <th class="text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {#each shiftsList as shift (shift.id)}
                <tr>
                  <td class="font-mono" style="font-weight: 600;">
                    #{shift.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td>
                    {new Date(shift.openedAt).toLocaleDateString()}
                    <span style="display: block; font-size: 0.75rem; color: var(--text-secondary);">
                      {new Date(shift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </td>
                  <td>
                    <strong>{shift.user?.name || shift.user?.username || 'Cajero'}</strong>
                  </td>
                  <td>
                    {#if shift.closedAt}
                      {new Date(shift.closedAt).toLocaleDateString()}
                      <span style="display: block; font-size: 0.75rem; color: var(--text-secondary);">
                        {new Date(shift.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    {:else}
                      <span style="color: #10b981; font-weight: 500;">En curso</span>
                    {/if}
                  </td>
                  <td>
                    {#if shift.status === 'OPEN'}
                      <span class="status-badge status-open">🟢 Abierto</span>
                    {:else}
                      <span class="status-badge status-closed">🔒 Cerrado</span>
                    {/if}
                  </td>
                  <td class="text-right font-mono">
                    ${Number(shift.initialCash || 0).toLocaleString()}
                  </td>
                  <td class="text-right font-mono">
                    {#if shift.actualCash !== null}
                      ${Number(shift.actualCash).toLocaleString()}
                    {:else}
                      <span class="text-muted">-</span>
                    {/if}
                  </td>
                  <td class="text-right font-mono">
                    {#if shift.difference !== null}
                      <span class={shift.difference > 0 ? 'diff-positive' : shift.difference < 0 ? 'diff-negative' : 'diff-zero'}>
                        {shift.difference > 0 ? '+' : ''}${Number(shift.difference).toLocaleString()}
                      </span>
                    {:else}
                      <span class="text-muted">-</span>
                    {/if}
                  </td>
                  <td class="text-center">
                    <button
                      type="button"
                      class="btn btn-secondary btn-sm"
                      onclick={() => {
                        selectedShiftId = shift.id;
                        showShiftDetailModal = true;
                      }}
                      title="Ver arqueo y comprobante de cierre"
                    >
                      🧾 Ver Cierre
                    </button>
                  </td>
                </tr>
              {:else}
                <tr>
                  <td colspan="9" class="text-center text-muted italic" style="padding: 30px;">
                    No se han registrado turnos de caja en este período.
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:catch error}
          <div class="error-banner animate-fade-in" style="margin: 20px;">
            Error al cargar turnos: {error.message}
          </div>
        {/await}
      </div>
    {/if}
  </div>
</div>

<!-- Modal: Detalle de Venta & Recibo Térmico -->
{#if showDetailModal && selectedSale}
  <SaleDetailModal
    sale={selectedSale}
    onclose={() => { showDetailModal = false; selectedSale = null; }}
  />
{/if}

<!-- Modal: Detalle y Comprobante de Cierre de Caja -->
{#if showShiftDetailModal && selectedShiftId}
  <ShiftDetailModal
    shiftId={selectedShiftId}
    onclose={() => { showShiftDetailModal = false; selectedShiftId = null; }}
  />
{/if}

<style>
  .reports-container {
    min-height: 100%;
    width: 100%;
    gap: 16px;
    padding: 6px;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  .flex-column {
    display: flex;
    flex-direction: column;
  }

  .flex-1 {
    flex: 1;
  }

  .reports-header {
    padding: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-radius: var(--radius-md);
    flex-wrap: wrap;
    gap: 12px;
  }

  .header-left h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
  }

  .date-filters {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    flex-wrap: wrap;
  }

  .date-input-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .date-input-group label {
    font-size: 0.72rem;
    color: var(--text-secondary);
    text-transform: uppercase;
  }

  .date-input-group input {
    padding: 8px 12px;
    font-size: 0.85rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
  }

  .error-banner {
    background: var(--color-danger-glow);
    border: 1px solid rgba(190, 18, 60, 0.3);
    color: #991b1b;
    font-weight: 500;
    padding: 10px;
    border-radius: var(--radius-sm);
    font-size: 0.88rem;
  }

  .tab-navigator {
    display: flex;
    padding: 4px;
    background: rgba(255, 255, 255, 0.01);
    border-radius: var(--radius-md);
  }

  .tab-link {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    padding: 10px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
    border-radius: var(--radius-sm);
    outline: none;
  }

  .tab-link:hover {
    background: rgba(255, 255, 255, 0.02);
    color: var(--text-primary);
  }

  .tab-link.active {
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-primary);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  /* KPI Cards */
  .dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
  }

  /* Secondary Row */
  .secondary-dashboard-row {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    align-items: stretch;
  }

  .visual-panel {
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    border-radius: var(--radius-md);
    min-width: 280px;
    box-sizing: border-box;
    overflow: visible;
  }

  .visual-panel h3 {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .payment-methods-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow: visible;
  }

  .alerts-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 195px;
    overflow-y: auto;
  }

  .no-alerts {
    text-align: center;
    font-size: 0.88rem;
    color: var(--text-secondary);
    padding: 10px;
  }

  /* Sales History Panel */
  .sales-history-panel {
    padding: 18px;
    min-height: 280px;
    border-radius: var(--radius-md);
  }

  .panel-top-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .history-subtab-switch {
    display: flex;
    gap: 8px;
    background: rgba(0, 0, 0, 0.2);
    padding: 4px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-glass);
  }

  .subtab-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-size: 0.88rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .subtab-btn:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.05);
  }

  .subtab-btn.active {
    background: var(--color-general);
    color: white;
    font-weight: 600;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    padding: 3px 8px;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .status-open {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .status-closed {
    background: rgba(100, 116, 139, 0.15);
    color: #94a3b8;
    border: 1px solid rgba(100, 116, 139, 0.3);
  }

  .diff-positive {
    color: #10b981;
    font-weight: 600;
  }

  .diff-negative {
    color: #ef4444;
    font-weight: 600;
  }

  .diff-zero {
    color: var(--text-secondary);
  }

  .count-pill {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-glass);
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 0.78rem;
    color: var(--text-secondary);
  }

  .sales-filter-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
    flex-wrap: wrap;
  }

  .search-field {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 240px;
  }

  .search-icon {
    position: absolute;
    left: 10px;
    font-size: 0.85rem;
    color: var(--text-muted);
    pointer-events: none;
  }

  .sales-search-input {
    width: 100%;
    padding: 8px 32px 8px 30px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-size: 0.88rem;
  }

  .sales-search-input:focus {
    outline: none;
    border-color: var(--color-general);
    background: rgba(255, 255, 255, 0.07);
  }

  .btn-clear-search {
    position: absolute;
    right: 8px;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 0.8rem;
  }

  .filter-select-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .filter-select-group label {
    font-size: 0.8rem;
    color: var(--text-secondary);
    white-space: nowrap;
  }

  .filter-select {
    padding: 7px 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-size: 0.85rem;
  }

  .filter-select:focus {
    outline: none;
    border-color: var(--color-general);
  }

  .table-container {
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    overflow-y: auto;
  }

  .text-right {
    text-align: right;
  }

  .text-center {
    text-align: center;
  }
</style>
