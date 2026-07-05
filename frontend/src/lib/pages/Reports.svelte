<script lang="ts">
  import { untrack } from 'svelte';
  import { refreshTrigger, triggerRefresh } from '../store';
  import { getDashboardData, getInventoryAlerts } from '../api/reports';
  import { getSales, cancelSale as apiCancelSale } from '../api/sales';
  import KpiCard from '../components/molecules/KpiCard.svelte';
  import PayMethodBar from '../components/molecules/PayMethodBar.svelte';
  import AlertItem from '../components/molecules/AlertItem.svelte';
  import SaleRow from '../components/organisms/SaleRow.svelte';

  import Spinner from '../components/atoms/Spinner.svelte';

  // Filters
  let startDate = $state('');
  let endDate = $state('');
  let activeTab = $state('CONSOLIDATED'); // 'CONSOLIDATED' | 'MARKET' | 'CAFE'

  let reportsPromise = $state<Promise<any>>(getDashboardData());
  let lowStockPromise = $state<Promise<any[]>>(getInventoryAlerts());
  let salesPromise = $state<Promise<any[]>>(getSales());

  $effect(() => {
    if ($refreshTrigger) {
      loadReports();
      loadLowStock();
      loadSalesHistory();
    }
  });

  function loadReports() {
    reportsPromise = getDashboardData(startDate, endDate);
  }

  function loadLowStock() {
    lowStockPromise = getInventoryAlerts();
  }

  function loadSalesHistory() {
    salesPromise = getSales();
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
      <h2>Estadísticas y Reportes Financieros</h2>
    </div>

    <div class="date-filters">
      <div class="date-input-group">
        <label for="start-d">Desde</label>
        <input type="date" id="start-d" bind:value={startDate} onchange={loadReports} />
      </div>
      <div class="date-input-group">
        <label for="end-d">Hasta</label>
        <input type="date" id="end-d" bind:value={endDate} onchange={loadReports} />
      </div>
      <button class="btn btn-secondary" onclick={() => { startDate = ''; endDate = ''; loadReports(); }} title="Limpiar Fechas">
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
      <button class="tab-link" class:active={activeTab === 'CONSOLIDATED'} onclick={() => activeTab = 'CONSOLIDATED'}>
        🏛️ Consolidado General
      </button>
      <button class="tab-link" class:active={activeTab === 'MARKET'} onclick={() => activeTab = 'MARKET'}>
        🍏 Mercado Saludable
      </button>
      <button class="tab-link" class:active={activeTab === 'CAFE'} onclick={() => activeTab = 'CAFE'}>
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

  <!-- Sales History Log -->
  <div class="sales-history-panel glass-panel flex-1 flex-column animate-scale-up">
    <h3>Historial de Ventas</h3>
    <div class="table-container scroll-y flex-1">
      {#await salesPromise}
        <div class="loading-state flex-center" style="padding: 40px 0;">
          <Spinner size="40px" />
          <p style="margin-top: 12px; color: var(--text-secondary);">Cargando historial...</p>
        </div>
      {:then resolvedSales}
        <table class="pos-table">
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
            {#each resolvedSales as sale}
              <SaleRow {sale} oncancel={cancelSale} />
            {:else}
              <tr>
                <td colspan="8" class="text-center text-muted italic">No se han registrado transacciones aún.</td>
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
  </div>
</div>

<style>
  .reports-container {
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

  .reports-header {
    padding: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-left h2 {
    font-size: 1.25rem;
    font-weight: 600;
  }

  .date-filters {
    display: flex;
    align-items: flex-end;
    gap: 12px;
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
  }

  .error-banner {
    background: var(--color-danger-glow);
    border: 1px solid rgba(244, 63, 94, 0.2);
    color: #fda4af;
    padding: 10px;
    border-radius: var(--radius-sm);
    font-size: 0.88rem;
  }

  .tab-navigator {
    display: flex;
    padding: 4px;
    background: rgba(255, 255, 255, 0.01);
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
  }

  .visual-panel {
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 240px;
  }

  .visual-panel h3 {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .payment-methods-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }



  .alerts-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
  }



  .no-alerts {
    text-align: center;
    font-size: 0.88rem;
    color: var(--text-secondary);
    padding: 10px;
  }

  /* Sales History */
  .sales-history-panel {
    padding: 18px;
    min-height: 260px;
  }

  .sales-history-panel h3 {
    font-size: 0.95rem;
    font-weight: 600;
    margin-bottom: 12px;
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
