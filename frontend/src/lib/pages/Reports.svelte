<script lang="ts">
  import { onMount } from 'svelte';
  import { refreshTrigger, triggerRefresh } from '../store';

  // Filters
  let startDate = $state('');
  let endDate = $state('');
  let activeTab = $state('CONSOLIDATED'); // 'CONSOLIDATED' | 'MARKET' | 'CAFE'

  // Dashboard Data
  let reportsData = $state<any>(null);
  let lowStockAlerts = $state<any[]>([]);
  let salesHistory = $state<any[]>([]);
  let errorMsg = $state('');

  onMount(() => {
    loadReports();
    loadLowStock();
    loadSalesHistory();
  });

  $effect(() => {
    if ($refreshTrigger) {
      loadReports();
      loadLowStock();
      loadSalesHistory();
    }
  });

  async function loadReports() {
    try {
      errorMsg = '';
      let url = '/api/reports/dashboard';
      const params = new URLSearchParams();
      if (startDate) params.append('start', startDate);
      if (endDate) params.append('end', endDate);

      const queryString = params.toString();
      if (queryString) url += `?${queryString}`;

      const res = await fetch(url);
      if (res.ok) {
        reportsData = await res.json();
      } else {
        errorMsg = 'Error al cargar datos financieros';
      }
    } catch (e) {
      console.error('Error loading reports:', e);
      errorMsg = 'Error de conexión';
    }
  }

  async function loadLowStock() {
    try {
      const res = await fetch('/api/reports/inventory-alerts');
      if (res.ok) {
        lowStockAlerts = await res.json();
      }
    } catch (e) {
      console.error('Error loading low stock alerts:', e);
    }
  }

  async function loadSalesHistory() {
    try {
      const res = await fetch('/api/sales');
      if (res.ok) {
        salesHistory = await res.json();
      }
    } catch (e) {
      console.error('Error loading sales history:', e);
    }
  }

  async function cancelSale(saleId: string) {
    if (!confirm('¿Estás seguro de que deseas ANULAR esta venta? Esto reintegrará el stock y cancelará los ingresos.')) return;

    try {
      const res = await fetch(`/api/sales/${saleId}/cancel`, { method: 'POST' });
      if (res.ok) {
        triggerRefresh();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al cancelar la venta');
      }
    } catch (e) {
      alert('Error de conexión al cancelar la venta');
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

  {#if errorMsg}
    <div class="error-banner">{errorMsg}</div>
  {/if}

  {#if reportsData}
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
        <div class="kpi-card glass-panel border-general">
          <span class="kpi-label">Ingresos Totales (Ventas)</span>
          <strong class="kpi-value text-general">
            ${(reportsData[activeTab]?.revenue || 0).toLocaleString()}
          </strong>
          <span class="kpi-subtext">Ventas registradas en el período</span>
        </div>
      {/if}

      <!-- Costo de Ventas -->
      {#if activeTab !== 'GENERAL'}
        <div class="kpi-card glass-panel border-cafe">
          <span class="kpi-label">Costo de Ventas (COGS)</span>
          <strong class="kpi-value text-cafe">
            ${(reportsData[activeTab]?.costOfSales || 0).toLocaleString()}
          </strong>
          <span class="kpi-subtext">Costo de compra de los artículos vendidos</span>
        </div>
      {/if}

      <!-- Utilidad Bruta -->
      {#if activeTab !== 'GENERAL'}
        <div class="kpi-card glass-panel border-market">
          <span class="kpi-label">Utilidad Bruta</span>
          <strong class="kpi-value text-market">
            ${(reportsData[activeTab]?.grossProfit || 0).toLocaleString()}
          </strong>
          <span class="kpi-subtext">Margen antes de gastos fijos/operativos</span>
        </div>
      {/if}

      <!-- Gastos Operativos -->
      <div class="kpi-card glass-panel border-danger">
        <span class="kpi-label">Gastos / Compras</span>
        <strong class="kpi-value text-danger">
          ${(reportsData[activeTab]?.expenses || 0).toLocaleString()}
        </strong>
        {#if activeTab === 'CONSOLIDATED'}
          <span class="kpi-subtext">Incluye Gastos Generales: ${reportsData.GENERAL.expenses.toLocaleString()}</span>
        {:else}
          <span class="kpi-subtext">Gastos asignados a este departamento</span>
        {/if}
      </div>

      <!-- Utilidad Neta -->
      {#if activeTab !== 'GENERAL'}
        <div class="kpi-card glass-panel border-net" class:negative={(reportsData[activeTab]?.netProfit || 0) < 0}>
          <span class="kpi-label">Utilidad Neta</span>
          <strong class="kpi-value">
            ${(reportsData[activeTab]?.netProfit || 0).toLocaleString()}
          </strong>
          <span class="kpi-subtext">Rendimiento neto real (Utilidad Bruta - Gastos)</span>
        </div>
      {/if}
    </div>

    <!-- Split Visual: Payments Methods & Inventory Alerts -->
    <div class="secondary-dashboard-row">
      <!-- Payment Methods -->
      <div class="visual-panel glass-panel flex-1 animate-scale-up">
        <h3>Distribución de Medios de Pago</h3>
        <div class="payment-methods-grid">
          <div class="pay-method-bar">
            <span>💵 Efectivo:</span>
            <strong>${reportsData.paymentMethods.CASH.toLocaleString()}</strong>
          </div>
          <div class="pay-method-bar">
            <span>💳 Tarjeta:</span>
            <strong>${reportsData.paymentMethods.CARD.toLocaleString()}</strong>
          </div>
          <div class="pay-method-bar">
            <span>📲 Transferencia:</span>
            <strong>${reportsData.paymentMethods.TRANSFER.toLocaleString()}</strong>
          </div>
          <div class="pay-method-bar">
            <span>🔄 Traslado Interno (Virtual):</span>
            <strong>${reportsData.paymentMethods.INTERNAL.toLocaleString()}</strong>
          </div>
        </div>
      </div>

      <!-- Low Stock Alerts -->
      <div class="visual-panel glass-panel flex-1 animate-scale-up">
        <h3>⚠️ Alertas de Inventario Bajo</h3>
        <div class="alerts-list scroll-y">
          {#each lowStockAlerts as item}
            <div class="alert-item animate-fade-in">
              <div class="alert-info">
                <strong>{item.name}</strong>
                <span>SKU: {item.sku} | Depto: {item.department}</span>
              </div>
              <span class="alert-stock">Stock: {item.stock}</span>
            </div>
          {:else}
            <div class="no-alerts">
              ✅ Todos los productos tienen stock suficiente.
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  <!-- Sales History Log -->
  <div class="sales-history-panel glass-panel flex-1 flex-column animate-scale-up">
    <h3>Historial de Ventas</h3>
    <div class="table-container scroll-y flex-1">
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
          {#each salesHistory as sale}
            <tr class="animate-fade-in" class:cancelled-row={sale.status === 'CANCELLED'}>
              <td><code>{sale.id.slice(0, 8).toUpperCase()}</code></td>
              <td>{new Date(sale.createdAt).toLocaleString()}</td>
              <td>{sale.user.name}</td>
              <td>
                <div class="exp-items-cell">
                  {#each sale.items as item}
                    <span>• {item.product.name} (x{item.quantity}) @ ${item.price.toLocaleString()}</span>
                  {/each}
                </div>
              </td>
              <td>
                <div class="exp-items-cell">
                  {#each sale.payments as pay}
                    <span>
                      {#if pay.method === 'CASH'}💵 Efectivo
                      {:else if pay.method === 'CARD'}💳 Tarjeta
                      {:else if pay.method === 'TRANSFER'}📲 Transferencia
                      {:else if pay.method === 'INTERNAL'}🔄 Interno
                      {/if}
                      : ${pay.amount.toLocaleString()}
                    </span>
                  {/each}
                </div>
              </td>
              <td class="text-right"><strong>${sale.total.toLocaleString()}</strong></td>
              <td class="text-center">
                {#if sale.status === 'COMPLETED'}
                  <span class="status-badge status-completed">COMPLETADO</span>
                {:else if sale.status === 'TRANSFER_OUT'}
                  <span class="status-badge status-transfer">TRASLADO OUT</span>
                {:else if sale.status === 'CANCELLED'}
                  <span class="status-badge status-cancelled">ANULADO</span>
                {/if}
              </td>
              <td class="text-center">
                {#if sale.status !== 'CANCELLED'}
                  <button class="btn-cancel-sale" onclick={() => cancelSale(sale.id)} title="Anular venta">
                    Anular ✕
                  </button>
                {:else}
                  <span class="text-muted italic">Anulado</span>
                {/if}
              </td>
            </tr>
          {:else}
            <tr>
              <td colspan="8" class="text-center text-muted italic">No se han registrado transacciones aún.</td>
            </tr>
          {/each}
        </tbody>
      </table>
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

  .kpi-card {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: var(--bg-glass);
  }

  .kpi-label {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .kpi-value {
    font-size: 1.6rem;
    font-weight: 700;
  }

  .kpi-subtext {
    font-size: 0.72rem;
    color: var(--text-muted);
  }

  /* Borders for KPIs */
  .border-general { border-left: 4px solid var(--color-general); }
  .border-cafe { border-left: 4px solid var(--color-cafe); }
  .border-market { border-left: 4px solid var(--color-market); }
  .border-danger { border-left: 4px solid var(--color-danger); }
  .border-net { 
    border-left: 4px solid #3b82f6; 
  }
  .border-net .kpi-value {
    color: #60a5fa;
  }
  .border-net.negative {
    border-left-color: var(--color-danger);
  }
  .border-net.negative .kpi-value {
    color: var(--color-danger);
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

  .pay-method-bar {
    display: flex;
    justify-content: space-between;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    font-size: 0.88rem;
  }

  .alerts-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
  }

  .alert-item {
    background: var(--color-danger-glow);
    border: 1px solid rgba(244, 63, 94, 0.15);
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .alert-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .alert-info strong {
    font-size: 0.85rem;
    color: #fecdd3;
  }

  .alert-info span {
    font-size: 0.72rem;
    color: #fda4af;
  }

  .alert-stock {
    font-size: 0.85rem;
    font-weight: 700;
    color: #fda4af;
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

  .pos-table tr.cancelled-row td {
    color: var(--text-muted);
    background: rgba(244, 63, 94, 0.01);
  }

  .pos-table tr.cancelled-row td strong,
  .pos-table tr.cancelled-row td code {
    color: var(--text-muted);
  }

  .exp-items-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.78rem;
    color: var(--text-secondary);
  }

  .status-badge {
    font-size: 0.68rem;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .status-completed {
    background: var(--color-market-glow);
    color: var(--color-market);
  }

  .status-transfer {
    background: var(--color-general-glow);
    color: #a5b4fc;
  }

  .status-cancelled {
    background: var(--color-danger-glow);
    color: var(--color-danger);
  }

  .btn-cancel-sale {
    background: transparent;
    border: 1px solid rgba(244, 63, 94, 0.3);
    color: #fca5a5;
    padding: 4px 8px;
    font-size: 0.75rem;
    border-radius: 4px;
    cursor: pointer;
    transition: var(--transition-fast);
    outline: none;
  }

  .btn-cancel-sale:hover {
    background: var(--color-danger-glow);
    border-color: var(--color-danger);
  }

  .text-right {
    text-align: right;
  }
  .text-center {
    text-align: center;
  }
</style>
