<script lang="ts">
  import { untrack } from 'svelte';
  import { getDashboardData, getInventoryAlerts } from '../api/reports';
  import { user, activeTab, refreshTrigger } from '../store';
  import KpiCard from '../components/molecules/KpiCard.svelte';
  import DeptCard from '../components/organisms/DeptCard.svelte';
  import TodoItem from '../components/molecules/TodoItem.svelte';
  import Button from '../components/atoms/Button.svelte';

  let dashboardPromise = $state<Promise<[any, any[]]>>(Promise.all([getDashboardData(), getInventoryAlerts()]));

  function loadDashboardData() {
    dashboardPromise = Promise.all([getDashboardData(), getInventoryAlerts()]);
  }

  $effect(() => {
    untrack(() => {
      // Load todos from localStorage
      try {
        const saved = localStorage.getItem('naturale_dashboard_todos');
        if (saved) {
          todos = JSON.parse(saved);
        }
      } catch (e) {
        console.error('Failed to load todos from localStorage', e);
      }
    });
  });

  $effect(() => {
    if ($refreshTrigger) {
      loadDashboardData();
    }
  });

  // Quick navigation helpers
  function navigateTo(tab: string) {
    activeTab.set(tab);
    window.location.hash = `#${tab}`;
  }

  // --- TODO List Logic ---
  interface TodoItem {
    id: string;
    text: string;
    completed: boolean;
  }

  let todos = $state<TodoItem[]>([]);
  let newTodoText = $state('');

  // Sync todos to localStorage
  $effect(() => {
    try {
      localStorage.setItem('naturale_dashboard_todos', JSON.stringify(todos));
    } catch (e) {
      console.error('Failed to save todos to localStorage', e);
    }
  });

  function addTodo() {
    if (newTodoText.trim() === '') return;
    todos = [...todos, {
      id: crypto.randomUUID(),
      text: newTodoText,
      completed: false
    }];
    newTodoText = '';
  }

  function toggleTodo(id: string) {
    todos = todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
  }

  function deleteTodo(id: string) {
    todos = todos.filter(t => t.id !== id);
  }

  // --- Calculator Logic ---
  let calcDisplay = $state('0');
  let calcEquation = $state('');
  let isResetOnNext = $state(false);

  function pressKey(val: string) {
    if (calcDisplay === '0' || isResetOnNext) {
      calcDisplay = val;
      isResetOnNext = false;
    } else {
      calcDisplay += val;
    }
  }

  function pressOperator(op: string) {
    calcEquation = calcDisplay + ' ' + op + ' ';
    isResetOnNext = true;
  }

  function clearCalc() {
    calcDisplay = '0';
    calcEquation = '';
    isResetOnNext = false;
  }

  function calculateResult() {
    try {
      const fullExpression = calcEquation + calcDisplay;
      const cleanExpr = fullExpression.replace(/\s+/g, '');
      if (!/^[0-9.+\-*/]+$/.test(cleanExpr)) {
        throw new Error('Invalid expression');
      }
      const result = new Function(`return ${cleanExpr}`)();
      calcDisplay = String(Number(result.toFixed(8))); // trim floating points
      calcEquation = '';
      isResetOnNext = true;
    } catch (e) {
      calcDisplay = 'Error';
      calcEquation = '';
      isResetOnNext = true;
    }
  }
</script>

<!-- Main View -->
<div class="dashboard-container flex-column animate-fade-in">
  <div class="dashboard-header glass-panel">
    <div class="header-left">
      <h2>Inicio y Resumen General 📈</h2>
      <p class="subtitle">Bienvenido, {$user?.name || 'Usuario'}. Aquí tienes el resumen operacional del local para el día de hoy.</p>
    </div>
    <button class="btn btn-secondary" onclick={loadDashboardData}>
      🔄 Actualizar Datos
    </button>
  </div>

  {#await dashboardPromise}
    <div class="loading-state flex-center glass-panel">
      <div class="spinner"></div>
      <p>Cargando resumen operacional...</p>
    </div>
  {:then [data, alerts]}
    <!-- Main Dashboard Grid -->
    <div class="dashboard-grid">
      <!-- 1. KPI Panel (Row of 4 Cards) -->
      <div class="kpis-row">
        <KpiCard icon="💰" title="Ingresos Brutos" value={"$" + data.CONSOLIDATED.revenue.toLocaleString()} desc="Total ventas no anuladas" textClass="text-general" />
        <KpiCard icon="💸" title="Egresos Totales" value={"$" + data.CONSOLIDATED.expenses.toLocaleString()} desc="Operacionales e insumos" textClass="text-danger" />
        <KpiCard icon="🌿" title="Utilidad Neta" value={"$" + data.CONSOLIDATED.netProfit.toLocaleString()} desc="Ingresos - Costos - Gastos" textClass={data.CONSOLIDATED.netProfit >= 0 ? 'text-general' : 'text-danger'} />
        <KpiCard icon="📊" title="Margen Neto" value={(data.CONSOLIDATED.revenue > 0 ? (data.CONSOLIDATED.netProfit / data.CONSOLIDATED.revenue) * 100 : 0).toFixed(1) + "%"} desc="Retorno por cada peso vendido" textClass="text-general" />
      </div>
      
      <!-- 2. Middle Row: Departments & Payments -->
      <div class="dashboard-row">
        <!-- Department breakdown -->
        <div class="dashboard-col glass-panel flex-column animate-scale-up">
          <h3>Desglose por Departamento</h3>
          <div class="dept-comparison">
            <DeptCard name="🍏 Mercado Saludable" profit={data.MARKET.netProfit} revenue={data.MARKET.revenue} expenses={data.MARKET.expenses} progressWidth={data.CONSOLIDATED.revenue > 0 ? (data.MARKET.revenue / data.CONSOLIDATED.revenue) * 100 : 0} colorClass="bg-market" textClass="text-market" />
            <DeptCard name="☕ Barra de Café" profit={data.CAFE.netProfit} revenue={data.CAFE.revenue} expenses={data.CAFE.expenses} progressWidth={data.CONSOLIDATED.revenue > 0 ? (data.CAFE.revenue / data.CONSOLIDATED.revenue) * 100 : 0} colorClass="bg-cafe" textClass="text-cafe" />
          </div>
        </div>

        <!-- Payments breakdown -->
        <div class="dashboard-col glass-panel flex-column animate-scale-up">
          <h3>Distribución de Métodos de Pago</h3>
          <div class="payment-distribution">
            {#each Object.entries(data.paymentMethods) as [method, val]}
              {@const amount = val as number}
              {#if amount > 0 || true}
                <div class="payment-row">
                  <div class="payment-label">
                    <span>
                      {#if method === 'CASH'}💵 Efectivo
                      {:else if method === 'CARD'}💳 Tarjeta
                      {:else if method === 'TRANSFER'}📲 Transferencia
                      {:else}🔄 Interno
                      {/if}
                    </span>
                    <strong>${amount.toLocaleString()}</strong>
                  </div>
                  <div class="progress-bar-container">
                    <div class="progress-bar bg-general" style="width: {data.CONSOLIDATED.revenue > 0 ? (amount / data.CONSOLIDATED.revenue) * 100 : 0}%"></div>
                  </div>
                </div>
              {/if}
            {/each}
          </div>
        </div>
      </div>

      <!-- 3. Bottom Row: Alerts & Actions -->
      <div class="dashboard-row">
        <!-- Low Stock Alerts -->
        <div class="dashboard-col glass-panel flex-column flex-1 animate-scale-up" style="max-height: 250px;">
          <h3>Alertas de Inventario Crítico ⚠️</h3>
          <div class="alerts-list scroll-y">
            {#each alerts as item}
              <div class="alert-item animate-fade-in">
                <div class="alert-info">
                  <strong class="product-name">{item.name}</strong>
                  <span class="product-sku">SKU: {item.sku} | Cat: {item.category.name}</span>
                </div>
                <div class="alert-badge" class:badge-zero={item.stock === 0} class:badge-low={item.stock > 0}>
                  {item.stock === 0 ? 'Sin Stock' : `${item.stock} unidades`}
                </div>
              </div>
            {:else}
              <div class="empty-alerts flex-center">
                ✨ ¡Todo al día! No hay productos con bajo inventario.
              </div>
            {/each}
          </div>
        </div>

        <!-- Quick Actions Grid -->
        <div class="dashboard-col glass-panel flex-column flex-1 animate-scale-up">
          <h3>Atajos Operacionales Rápidos</h3>
          <div class="shortcuts-grid">
            <button class="shortcut-btn" onclick={() => navigateTo('checkout')}>
              <span class="shortcut-icon">🛒</span>
              <strong>Terminal Venta</strong>
              <span>Procesar pagos y comandas</span>
            </button>
            <button class="shortcut-btn" onclick={() => navigateTo('tables')}>
              <span class="shortcut-icon">🪑</span>
              <strong>Mapa de Mesas</strong>
              <span>Gestionar mesas y salón</span>
            </button>
            <button class="shortcut-btn" onclick={() => navigateTo('expenses')}>
              <span class="shortcut-icon">💸</span>
              <strong>Registrar Gasto</strong>
              <span>Gastos fijos o suministros</span>
            </button>
            <button class="shortcut-btn" onclick={() => navigateTo('transfers')}>
              <span class="shortcut-icon">🔄</span>
              <strong>Trasladar Stock</strong>
              <span>Mover del Mercado al Café</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 4. Fourth Row: TODOs & Calculator -->
      <div class="dashboard-row">
        <!-- TODO List Panel -->
        <div class="dashboard-col glass-panel flex-column flex-1 animate-scale-up" style="min-height: 380px;">
          <h3>Tareas Pendientes (Todo's) 📝</h3>
          <div class="todo-input-row">
            <input type="text" bind:value={newTodoText} placeholder="Agregar una nueva tarea..." onkeydown={(e) => e.key === 'Enter' && addTodo()} />
            <button class="btn btn-general add-todo-btn" onclick={addTodo}>➕</button>
          </div>
          <div class="todos-list scroll-y">
            {#each todos as todo (todo.id)}
              <TodoItem {todo} ontoggle={toggleTodo} ondelete={deleteTodo} />
            {:else}
              <div class="empty-todos flex-center">
                ✨ ¡No hay tareas pendientes! Disfruta tu día.
              </div>
            {/each}
          </div>
        </div>

        <!-- Calculator Panel -->
        <div class="dashboard-col glass-panel flex-column flex-1 animate-scale-up" style="min-height: 380px;">
          <h3>Calculadora Rápida 🧮</h3>
          <div class="calculator-box">
            <div class="calc-screen">
              <span class="calc-eq">{calcEquation || ''}</span>
              <span class="calc-val">{calcDisplay}</span>
            </div>
            <div class="calc-keyboard">
              <Button label="C" variant="calc-clear" onclick={clearCalc} />
              <Button label="&amp;divide;" variant="calc-op" onclick={() => pressOperator('/')} />
              <Button label="&amp;times;" variant="calc-op" onclick={() => pressOperator('*')} />
              <Button label="&amp;minus;" variant="calc-op" onclick={() => pressOperator('-')} />

              <Button label="7" variant="calc-num" onclick={() => pressKey('7')} />
              <Button label="8" variant="calc-num" onclick={() => pressKey('8')} />
              <Button label="9" variant="calc-num" onclick={() => pressKey('9')} />
              <Button label="+" variant="calc-op" onclick={() => pressOperator('+')} />

              <Button label="4" variant="calc-num" onclick={() => pressKey('4')} />
              <Button label="5" variant="calc-num" onclick={() => pressKey('5')} />
              <Button label="6" variant="calc-num" onclick={() => pressKey('6')} />
              <Button label="=" variant="calc-equal" onclick={calculateResult} />

              <Button label="1" variant="calc-num" onclick={() => pressKey('1')} />
              <Button label="2" variant="calc-num" onclick={() => pressKey('2')} />
              <Button label="3" variant="calc-num" onclick={() => pressKey('3')} />
              <Button label="0" variant="calc-num-zero" onclick={() => pressKey('0')} />

              <Button label="." variant="calc-num" onclick={() => pressKey('.')} />
            </div>
          </div>
        </div>
      </div>

    </div>
  {/await}
</div>

<style>
  .dashboard-container {
    height: 100%;
    width: 100%;
    gap: 16px;
    padding: 6px;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }

  .dashboard-header {
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

  /* Grid structure */
  .dashboard-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding-bottom: 24px;
  }

  .kpis-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
  }



  .dashboard-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
    gap: 16px;
  }

  .dashboard-col {
    padding: 20px;
    gap: 14px;
    box-sizing: border-box;
  }

  .dashboard-col h3 {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-primary);
    border-bottom: 1px solid var(--border-glass);
    padding-bottom: 8px;
    margin-bottom: 4px;
  }



  /* Payment distribution */
  .payment-distribution {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .payment-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .payment-label {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  /* Alerts list */
  .alerts-list {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .alert-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    padding: 8px 12px;
  }

  .alert-info {
    display: flex;
    flex-direction: column;
  }

  .product-name {
    font-size: 0.85rem;
    color: var(--text-primary);
  }

  .product-sku {
    font-size: 0.72rem;
    color: var(--text-muted);
  }

  .alert-badge {
    font-size: 0.72rem;
    padding: 3px 8px;
    border-radius: 4px;
    font-weight: 600;
  }

  .badge-zero {
    background: rgba(244, 63, 94, 0.12);
    color: var(--color-danger);
    border: 1px solid rgba(244, 63, 94, 0.2);
  }

  .badge-low {
    background: rgba(245, 158, 11, 0.12);
    color: var(--color-cafe);
    border: 1px solid rgba(245, 158, 11, 0.2);
  }

  .empty-alerts {
    height: 120px;
    font-size: 0.82rem;
    color: var(--text-muted);
    font-style: italic;
  }

  /* Shortcuts grid */
  .shortcuts-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    flex: 1;
  }

  .shortcut-btn {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    padding: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    cursor: pointer;
    transition: var(--transition-normal);
    outline: none;
    text-align: center;
  }

  .shortcut-btn:hover {
    background: var(--color-general-glow);
    border-color: var(--color-general);
    transform: translateY(-2px);
  }

  .shortcut-icon {
    font-size: 1.5rem;
    margin-bottom: 2px;
  }

  .shortcut-btn strong {
    font-size: 0.85rem;
    color: var(--text-primary);
  }

  .shortcut-btn span {
    font-size: 0.7rem;
    color: var(--text-secondary);
  }

  /* TODO's styling */
  .todo-input-row {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .todo-input-row input {
    flex: 1;
    height: 40px;
    box-sizing: border-box;
  }

  .add-todo-btn {
    width: 44px;
    height: 40px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .todos-list {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }



  .empty-todos {
    height: 120px;
    font-size: 0.82rem;
    color: var(--text-muted);
    font-style: italic;
  }

  /* Calculator styling */
  .calculator-box {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
    justify-content: space-between;
  }

  .calc-screen {
    background: rgba(3, 7, 18, 0.25);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: center;
    gap: 4px;
    min-height: 64px;
    text-align: right;
    box-sizing: border-box;
  }

  .calc-eq {
    font-size: 0.72rem;
    color: var(--text-secondary);
    height: 14px;
  }

  .calc-val {
    font-size: 1.55rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .calc-keyboard {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }


</style>
