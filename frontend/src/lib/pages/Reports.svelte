<script lang="ts">
  import { refreshTrigger, triggerRefresh } from '../store';
  import { getDashboardData, getInventoryAlerts } from '../api/reports';
  import { getSales, cancelSale as apiCancelSale } from '../api/sales';
  import { getShifts } from '../api/shifts';
  import {
    getTodayLocalDate,
    getYesterdayLocalDate,
    getWeekStartLocalDate,
    getMonthStartLocalDate,
    toLocalStartOfDayISO,
    toLocalEndOfDayISO,
  } from '../utils/date';
  import KpiCard from '../components/molecules/KpiCard.svelte';
  import PayMethodBar from '../components/molecules/PayMethodBar.svelte';
  import AlertItem from '../components/molecules/AlertItem.svelte';
  import SaleRow from '../components/organisms/SaleRow.svelte';
  import SaleDetailModal from '../components/organisms/SaleDetailModal.svelte';
  import EditPaymentModal from '../components/organisms/EditPaymentModal.svelte';
  import ShiftDetailModal from '../components/organisms/ShiftDetailModal.svelte';
  import Spinner from '../components/atoms/Spinner.svelte';

  // Filters - default to today's local date
  const today = getTodayLocalDate();
  let startDate = $state(today);
  let endDate = $state(today);
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
  let selectedShiftId = $state<string | null>(null);
  let showShiftDetailModal = $state(false);

  // Modal State for Sale Ticket Details
  let showDetailModal = $state(false);
  let selectedSale = $state<any | null>(null);

  // Modal State for Editing Sale Payments
  let showEditPaymentModal = $state(false);
  let saleToEdit = $state<any | null>(null);

  function getRangeISOBounds() {
    const startISO = startDate ? toLocalStartOfDayISO(startDate) : undefined;
    const endISO = endDate ? toLocalEndOfDayISO(endDate) : undefined;
    return { startISO, endISO };
  }

  function fetchSalesHistory(): Promise<any[]> {
    const { startISO, endISO } = getRangeISOBounds();
    return getSales({
      q: searchQuery.trim() || undefined,
      status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
      paymentMethod: selectedPayment !== 'ALL' ? selectedPayment : undefined,
      start: startISO,
      end: endISO,
    }).then((data) => {
      salesList = data;
      return data;
    });
  }

  function fetchShifts(): Promise<any[]> {
    const { startISO, endISO } = getRangeISOBounds();
    return getShifts(startISO, endISO).then((data) => {
      shiftsList = data;
      return data;
    });
  }

  function loadReports() {
    const { startISO, endISO } = getRangeISOBounds();
    reportsPromise = getDashboardData(startISO, endISO);
  }

  function loadLowStock() {
    lowStockPromise = getInventoryAlerts();
  }

  function loadSalesHistory() {
    salesPromise = fetchSalesHistory();
  }

  function loadShifts() {
    shiftsPromise = fetchShifts();
  }

  const initialBounds = getRangeISOBounds();
  let reportsPromise = $state<Promise<any>>(getDashboardData(initialBounds.startISO, initialBounds.endISO));
  let lowStockPromise = $state<Promise<any[]>>(getInventoryAlerts());
  let salesPromise = $state<Promise<any[]>>(fetchSalesHistory());
  let shiftsPromise = $state<Promise<any[]>>(fetchShifts());

  $effect(() => {
    if ($refreshTrigger) {
      loadReports();
      loadLowStock();
      loadSalesHistory();
      loadShifts();
    }
  });

  function handleDateChange() {
    loadReports();
    loadSalesHistory();
    loadShifts();
  }

  function setQuickRange(type: 'today' | 'yesterday' | 'week' | 'month' | 'all') {
    if (type === 'today') {
      startDate = getTodayLocalDate();
      endDate = getTodayLocalDate();
    } else if (type === 'yesterday') {
      const y = getYesterdayLocalDate();
      startDate = y;
      endDate = y;
    } else if (type === 'week') {
      startDate = getWeekStartLocalDate();
      endDate = getTodayLocalDate();
    } else if (type === 'month') {
      startDate = getMonthStartLocalDate();
      endDate = getTodayLocalDate();
    } else if (type === 'all') {
      startDate = '';
      endDate = '';
    }
    handleDateChange();
  }

  function resetDateFilters() {
    startDate = getTodayLocalDate();
    endDate = getTodayLocalDate();
    searchQuery = '';
    selectedStatus = 'ALL';
    selectedPayment = 'ALL';
    handleDateChange();
  }

  // Derived totals for shifts in the selected period
  let shiftsTotals = $derived.by(() => {
    let initialCash = 0;
    let totalSales = 0;
    let cashSales = 0;
    let cardSales = 0;
    let transferSales = 0;
    let expenses = 0;
    let expectedCash = 0;
    let actualCash = 0;
    let difference = 0;
    let closedCount = 0;

    for (const s of shiftsList) {
      initialCash += Number(s.initialCash || 0);
      totalSales += Number(s.totalSales || 0);
      cashSales += Number(s.cashSales || 0);
      cardSales += Number(s.cardSales || 0);
      transferSales += Number(s.transferSales || 0);
      expenses += Number(s.totalExpenses || s.expenses || 0);
      expectedCash += Number(s.expectedCash || 0);
      if (s.actualCash !== null && s.actualCash !== undefined) {
        actualCash += Number(s.actualCash);
        difference += Number(s.difference || 0);
        closedCount++;
      }
    }

    return {
      count: shiftsList.length,
      closedCount,
      initialCash,
      totalSales,
      cashSales,
      cardSales,
      transferSales,
      expenses,
      expectedCash,
      actualCash,
      difference,
    };
  });

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

  function openEditPayment(sale: any) {
    saleToEdit = sale;
    showEditPaymentModal = true;
  }

  function handlePaymentEdited(updatedSale: any) {
    if (selectedSale && selectedSale.id === updatedSale.id) {
      selectedSale = updatedSale;
    }
    triggerRefresh();
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

{#snippet loadingState(message: string, isGlass = false)}
  <div class="loading-state flex-center" class:glass-panel={isGlass} style="padding: 40px 0;">
    <Spinner size="40px" />
    <p style="margin-top: 12px; color: var(--text-secondary);">{message}</p>
  </div>
{/snippet}

{#snippet errorBanner(prefix: string, message: string)}
  <div class="error-banner animate-fade-in" style="margin: 20px;">
    {prefix}: {message}
  </div>
{/snippet}

<div class="reports-container flex-column animate-fade-in">
  <!-- Top Filter Bar -->
  <div class="reports-header glass-panel">
    <div class="header-left">
      <h2>Estadísticas y Reportes Financieros 📊</h2>
    </div>

    <div class="date-filters">
      <div class="quick-ranges" role="toolbar" aria-label="Filtros rápidos de fecha">
        <button
          type="button"
          class="btn-range"
          class:active={startDate === getTodayLocalDate() && endDate === getTodayLocalDate()}
          onclick={() => setQuickRange('today')}
        >
          Hoy
        </button>
        <button
          type="button"
          class="btn-range"
          class:active={startDate === getYesterdayLocalDate() && endDate === getYesterdayLocalDate()}
          onclick={() => setQuickRange('yesterday')}
        >
          Ayer
        </button>
        <button
          type="button"
          class="btn-range"
          class:active={startDate === getWeekStartLocalDate() && endDate === getTodayLocalDate()}
          onclick={() => setQuickRange('week')}
        >
          Esta Semana
        </button>
        <button
          type="button"
          class="btn-range"
          class:active={startDate === getMonthStartLocalDate() && endDate === getTodayLocalDate()}
          onclick={() => setQuickRange('month')}
        >
          Este Mes
        </button>
        <button
          type="button"
          class="btn-range"
          class:active={!startDate && !endDate}
          onclick={() => setQuickRange('all')}
        >
          Todo
        </button>
      </div>

      <div class="date-inputs-wrapper">
        <div class="date-input-group">
          <label for="start-d">Desde</label>
          <input type="date" id="start-d" bind:value={startDate} onchange={handleDateChange} />
        </div>
        <div class="date-input-group">
          <label for="end-d">Hasta</label>
          <input type="date" id="end-d" bind:value={endDate} onchange={handleDateChange} />
        </div>
      </div>

      <button
        type="button"
        class="btn btn-secondary btn-reset-today"
        onclick={resetDateFilters}
        title="Restablecer a Hoy"
        aria-label="Restablecer filtros a hoy"
      >
        🔄 Hoy
      </button>
    </div>
  </div>

  {#await Promise.all([reportsPromise, lowStockPromise])}
    {@render loadingState('Cargando estadísticas...', true)}
  {:then [data, alerts]}
    <!-- Tab Selector (Consolidated, Market, Cafe) -->
    <div class="tab-navigator glass-panel" role="tablist" aria-label="Filtro por departamento">
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'CONSOLIDATED'}
        class="tab-link"
        class:active={activeTab === 'CONSOLIDATED'}
        onclick={() => (activeTab = 'CONSOLIDATED')}
      >
        🏛️ Consolidado General
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'MARKET'}
        class="tab-link"
        class:active={activeTab === 'MARKET'}
        onclick={() => (activeTab = 'MARKET')}
      >
        🍏 Mercado Saludable
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'CAFE'}
        class="tab-link"
        class:active={activeTab === 'CAFE'}
        onclick={() => (activeTab = 'CAFE')}
      >
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

    <!-- Cash Drawer Arqueo & Reconciliation Panel -->
    {#if data.cashReconciliation}
      <div class="cash-reconciliation-panel glass-panel animate-scale-up">
        <div class="reconciliation-header">
          <div class="header-info">
            <h3 class="panel-title">
              💵 Resumen y Arqueo de Caja {startDate === endDate && startDate ? '(Cierre del Día)' : '(Período Seleccionado)'}
            </h3>
            <span class="sub-info">
              {#if data.cashReconciliation.shiftsCount === 0}
                No se registraron turnos en este rango de fechas.
              {:else if data.cashReconciliation.shiftsCount === 1}
                1 turno registrado {data.cashReconciliation.openShiftsCount > 0 ? '(🟢 En curso)' : '(🔒 Cerrado)'}
              {:else}
                {data.cashReconciliation.shiftsCount} turnos registrados ({data.cashReconciliation.closedShiftsCount} cerrados{data.cashReconciliation.openShiftsCount > 0 ? `, ${data.cashReconciliation.openShiftsCount} en curso` : ''})
              {/if}
            </span>
          </div>
          <div class="header-badge">
            {#if data.cashReconciliation.shiftsCount > 0}
              {#if data.cashReconciliation.openShiftsCount > 0}
                <span class="badge badge-warning">🟢 Turno en Curso</span>
              {:else if Math.abs(data.cashReconciliation.difference) < 0.01}
                <span class="badge badge-success">✅ Caja Cuadrada ($0)</span>
              {:else if data.cashReconciliation.difference > 0}
                <span class="badge badge-info">⬆️ Sobrante: +${Number(data.cashReconciliation.difference).toLocaleString()}</span>
              {:else}
                <span class="badge badge-danger">⚠️ Faltante: -${Math.abs(Number(data.cashReconciliation.difference)).toLocaleString()}</span>
              {/if}
            {/if}
          </div>
        </div>

        <!-- Visual Mathematical Equation Flow: Base + Cash Sales - Expenses = Expected vs Actual -->
        <div class="reconciliation-flow-grid">
          <div class="flow-card">
            <span class="flow-label">Base(s) Inicial(es)</span>
            <span class="flow-value font-mono">${Number(data.cashReconciliation.initialCash || 0).toLocaleString()}</span>
            <span class="flow-caption">Efectivo inicial en caja</span>
          </div>

          <div class="flow-operator" aria-hidden="true">+</div>

          <div class="flow-card flow-positive">
            <span class="flow-label">Ventas Efectivo</span>
            <span class="flow-value font-mono">+${Number(data.cashReconciliation.cashSales || 0).toLocaleString()}</span>
            <span class="flow-caption">Total ingresado por ventas</span>
          </div>

          <div class="flow-operator" aria-hidden="true">-</div>

          <div class="flow-card flow-negative">
            <span class="flow-label">Egresos / Gastos</span>
            <span class="flow-value font-mono">-${Number(data.cashReconciliation.expenses || 0).toLocaleString()}</span>
            <span class="flow-caption">Salidas pagadas en efectivo</span>
          </div>

          <div class="flow-operator" aria-hidden="true">=</div>

          <div class="flow-card flow-expected">
            <span class="flow-label">Efectivo Esperado</span>
            <span class="flow-value font-mono">${Number(data.cashReconciliation.expectedCash || 0).toLocaleString()}</span>
            <span class="flow-caption">Debe haber en cajón</span>
          </div>

          <div class="flow-operator vs" aria-hidden="true">vs</div>

          <div class="flow-card flow-actual">
            <span class="flow-label">Efectivo Real (Contado)</span>
            <span class="flow-value font-mono">
              {#if data.cashReconciliation.closedShiftsCount > 0}
                ${Number(data.cashReconciliation.actualCash || 0).toLocaleString()}
              {:else}
                <span class="text-muted" style="font-size: 0.95rem;">En curso</span>
              {/if}
            </span>
            <span class="flow-caption">Arqueo físico declarado</span>
          </div>

          <div class="flow-operator" aria-hidden="true">=</div>

          <div class="flow-card flow-diff" class:diff-ok={Math.abs(data.cashReconciliation.difference || 0) < 0.01} class:diff-warn={(data.cashReconciliation.difference || 0) !== 0}>
            <span class="flow-label">Diferencia (Arqueo)</span>
            <span class="flow-value font-mono">
              {#if data.cashReconciliation.closedShiftsCount > 0}
                {(data.cashReconciliation.difference || 0) > 0 ? '+' : ''}${Number(data.cashReconciliation.difference || 0).toLocaleString()}
              {:else}
                <span class="text-muted">-</span>
              {/if}
            </span>
            <span class="flow-caption">
              {Math.abs(data.cashReconciliation.difference || 0) < 0.01 ? 'Caja balanceada exacta' : (data.cashReconciliation.difference || 0) > 0 ? 'Sobrante en caja' : 'Faltante en caja'}
            </span>
          </div>
        </div>

        {#if data.cashReconciliation.shiftsCount > 0}
          <div class="reconciliation-footer">
            <button
              type="button"
              class="btn-link-shifts"
              onclick={() => { historySubTab = 'shifts'; loadShifts(); }}
            >
              📑 Ver los {data.cashReconciliation.shiftsCount} {data.cashReconciliation.shiftsCount === 1 ? 'turno detallado' : 'turnos detallados'} de este período ➔
            </button>
          </div>
        {/if}
      </div>
    {/if}

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
    {@render errorBanner('Error al cargar estadísticas', error.message)}
  {/await}

  <!-- ==========================================
       SALES HISTORY & MULTI-FACET FILTERS
       ========================================== -->
  <div class="sales-history-panel glass-panel flex-1 flex-column animate-scale-up">
    <div class="panel-top-row">
      <div class="history-subtab-switch" role="tablist" aria-label="Subpestañas de historial">
        <button
          type="button"
          role="tab"
          aria-selected={historySubTab === 'sales'}
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
          role="tab"
          aria-selected={historySubTab === 'shifts'}
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
            <button
              type="button"
              class="btn-clear-search"
              onclick={() => (searchQuery = '')}
              aria-label="Limpiar búsqueda"
            >
              ✕
            </button>
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
          {@render loadingState('Cargando historial...')}
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
                <SaleRow
                  {sale}
                  oncancel={cancelSale}
                  onview={openSaleDetail}
                  oneditpayment={openEditPayment}
                />
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
          {@render errorBanner('Error al cargar historial', error.message)}
        {/await}
      </div>
    {:else}
      <!-- Shifts and Cash Closures Table -->
      <div class="table-container scroll-y flex-1">
        {#await shiftsPromise}
          {@render loadingState('Cargando turnos y cierres de caja...')}
        {:then}
          <table class="pos-table shifts-table" aria-label="Turnos y Cierres de Caja">
            <thead>
              <tr>
                <th>ID Turno</th>
                <th>Apertura</th>
                <th>Cajero</th>
                <th>Cierre</th>
                <th>Estado</th>
                <th class="text-right">Base</th>
                <th class="text-right">Ventas Totales</th>
                <th class="text-right">Efectivo</th>
                <th class="text-right">Tarjeta</th>
                <th class="text-right">Transfer.</th>
                <th class="text-right">Gastos</th>
                <th class="text-right">Esperado</th>
                <th class="text-right">Real Contado</th>
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
                      <span style="color: #10b981; font-weight: 500;">🟢 En curso</span>
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
                  <td class="text-right font-mono" style="font-weight: 600;">
                    ${Number(shift.totalSales || 0).toLocaleString()}
                  </td>
                  <td class="text-right font-mono" style="color: #10b981;">
                    ${Number(shift.cashSales || 0).toLocaleString()}
                  </td>
                  <td class="text-right font-mono">
                    ${Number(shift.cardSales || 0).toLocaleString()}
                  </td>
                  <td class="text-right font-mono">
                    ${Number(shift.transferSales || 0).toLocaleString()}
                  </td>
                  <td class="text-right font-mono" style="color: #ef4444;">
                    -${Number(shift.totalExpenses || shift.expenses || 0).toLocaleString()}
                  </td>
                  <td class="text-right font-mono font-bold">
                    ${Number(shift.expectedCash || 0).toLocaleString()}
                  </td>
                  <td class="text-right font-mono font-bold">
                    {#if shift.actualCash !== null && shift.actualCash !== undefined}
                      ${Number(shift.actualCash).toLocaleString()}
                    {:else}
                      <span class="text-muted">-</span>
                    {/if}
                  </td>
                  <td class="text-right font-mono font-bold">
                    {#if shift.difference !== null && shift.difference !== undefined}
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
                  <td colspan="15" class="text-center text-muted italic" style="padding: 30px;">
                    No se han registrado turnos de caja en este período.
                  </td>
                </tr>
              {/each}
            </tbody>
            {#if shiftsList.length > 0}
              <tfoot>
                <tr class="shifts-totals-row">
                  <td colspan="5" style="font-weight: 700;">
                    TOTALES DEL PERÍODO ({shiftsList.length} {shiftsList.length === 1 ? 'Turno' : 'Turnos'})
                  </td>
                  <td class="text-right font-mono font-bold">
                    ${shiftsTotals.initialCash.toLocaleString()}
                  </td>
                  <td class="text-right font-mono font-bold">
                    ${shiftsTotals.totalSales.toLocaleString()}
                  </td>
                  <td class="text-right font-mono font-bold" style="color: #10b981;">
                    ${shiftsTotals.cashSales.toLocaleString()}
                  </td>
                  <td class="text-right font-mono font-bold">
                    ${shiftsTotals.cardSales.toLocaleString()}
                  </td>
                  <td class="text-right font-mono font-bold">
                    ${shiftsTotals.transferSales.toLocaleString()}
                  </td>
                  <td class="text-right font-mono font-bold" style="color: #ef4444;">
                    -${shiftsTotals.expenses.toLocaleString()}
                  </td>
                  <td class="text-right font-mono font-bold">
                    ${shiftsTotals.expectedCash.toLocaleString()}
                  </td>
                  <td class="text-right font-mono font-bold">
                    ${shiftsTotals.actualCash.toLocaleString()}
                  </td>
                  <td class="text-right font-mono font-bold">
                    <span class={shiftsTotals.difference > 0 ? 'diff-positive' : shiftsTotals.difference < 0 ? 'diff-negative' : 'diff-zero'}>
                      {shiftsTotals.difference > 0 ? '+' : ''}${shiftsTotals.difference.toLocaleString()}
                    </span>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            {/if}
          </table>
        {:catch error}
          {@render errorBanner('Error al cargar turnos', error.message)}
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
    oneditpayment={(sale) => openEditPayment(sale)}
  />
{/if}

<!-- Modal: Editar Métodos de Pago -->
{#if showEditPaymentModal && saleToEdit}
  <EditPaymentModal
    sale={saleToEdit}
    onclose={() => { showEditPaymentModal = false; saleToEdit = null; }}
    onsave={handlePaymentEdited}
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

  /* Quick Range Buttons */
  .quick-ranges {
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(255, 255, 255, 0.03);
    padding: 3px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-glass);
  }

  .btn-range {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    padding: 6px 10px;
    font-size: 0.78rem;
    font-weight: 500;
    cursor: pointer;
    border-radius: 4px;
    transition: var(--transition-fast);
  }

  .btn-range:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.05);
  }

  .btn-range.active {
    background: var(--color-general);
    color: #ffffff;
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  }

  .date-inputs-wrapper {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }

  .btn-reset-today {
    padding: 8px 12px;
    font-size: 0.85rem;
    white-space: nowrap;
  }

  /* Cash Drawer Arqueo & Reconciliation Panel */
  .cash-reconciliation-panel {
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-glass);
  }

  .reconciliation-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }

  .panel-title {
    font-size: 1.05rem;
    font-weight: 700;
    margin: 0;
    color: var(--text-primary);
  }

  .sub-info {
    font-size: 0.82rem;
    color: var(--text-secondary);
    display: block;
    margin-top: 2px;
  }

  .header-badge .badge {
    padding: 5px 12px;
    font-size: 0.82rem;
    font-weight: 600;
    border-radius: 20px;
    display: inline-block;
  }

  .badge-success {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .badge-warning {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .badge-info {
    background: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  .badge-danger {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  /* Mathematical Equation Flow Grid */
  .reconciliation-flow-grid {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    padding: 12px 14px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: var(--radius-sm);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .flow-card {
    flex: 1;
    min-width: 130px;
    display: flex;
    flex-direction: column;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    transition: var(--transition-fast);
  }

  .flow-card:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .flow-label {
    font-size: 0.72rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .flow-value {
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .flow-caption {
    font-size: 0.7rem;
    color: var(--text-muted);
    margin-top: 2px;
  }

  .flow-operator {
    font-size: 1.2rem;
    font-weight: 800;
    color: var(--text-muted);
    padding: 0 4px;
    user-select: none;
  }

  .flow-operator.vs {
    font-size: 0.85rem;
    font-weight: 700;
    text-transform: uppercase;
    background: rgba(255, 255, 255, 0.06);
    padding: 3px 8px;
    border-radius: 12px;
  }

  .flow-positive .flow-value {
    color: #10b981;
  }

  .flow-negative .flow-value {
    color: #ef4444;
  }

  .flow-expected {
    border-color: rgba(59, 130, 246, 0.4);
    background: rgba(59, 130, 246, 0.05);
  }

  .flow-expected .flow-value {
    color: #60a5fa;
  }

  .flow-actual {
    border-color: rgba(16, 185, 129, 0.4);
    background: rgba(16, 185, 129, 0.05);
  }

  .flow-actual .flow-value {
    color: #34d399;
  }

  .flow-diff.diff-ok {
    border-color: rgba(16, 185, 129, 0.5);
    background: rgba(16, 185, 129, 0.08);
  }

  .flow-diff.diff-ok .flow-value {
    color: #10b981;
  }

  .flow-diff.diff-warn {
    border-color: rgba(245, 158, 11, 0.5);
    background: rgba(245, 158, 11, 0.08);
  }

  .flow-diff.diff-warn .flow-value {
    color: #f59e0b;
  }

  .reconciliation-footer {
    display: flex;
    justify-content: flex-end;
  }

  .btn-link-shifts {
    background: transparent;
    border: none;
    color: var(--color-general);
    font-size: 0.84rem;
    font-weight: 600;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: var(--transition-fast);
  }

  .btn-link-shifts:hover {
    text-decoration: underline;
    background: rgba(255, 255, 255, 0.04);
  }

  /* Shifts Table Styling */
  .shifts-table th,
  .shifts-table td {
    padding: 8px 10px;
    font-size: 0.82rem;
  }

  .shifts-totals-row td {
    background: rgba(255, 255, 255, 0.06);
    border-top: 2px solid var(--border-glass);
    padding: 10px;
    font-size: 0.85rem;
  }
</style>
