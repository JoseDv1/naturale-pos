<script lang="ts">
  import { onMount } from 'svelte';
  import { user, activeTab, refreshTrigger } from '../store';

  let dashboardData = $state<any>(null);
  let lowStockAlerts = $state<any[]>([]);
  let isLoading = $state(true);
  let errorMsg = $state('');

  onMount(() => {
    loadDashboardData();
  });

  $effect(() => {
    if ($refreshTrigger) {
      loadDashboardData();
    }
  });

  async function loadDashboardData() {
    isLoading = true;
    errorMsg = '';
    try {
      const res = await fetch('/api/reports/dashboard');
      const alertRes = await fetch('/api/reports/inventory-alerts');
      if (res.ok && alertRes.ok) {
        dashboardData = await res.json();
        lowStockAlerts = await alertRes.json();
      } else {
        errorMsg = 'Error al cargar los datos del panel';
      }
    } catch (e) {
      errorMsg = 'Error de conexión con el servidor';
    } finally {
      isLoading = false;
    }
  }

  // Quick navigation helpers
  function navigateTo(tab: string) {
    activeTab.set(tab);
    window.location.hash = `#${tab}`;
  }

  // Derived KPIs
  let margin = $derived(
    dashboardData && dashboardData.CONSOLIDATED.revenue > 0
      ? (dashboardData.CONSOLIDATED.netProfit / dashboardData.CONSOLIDATED.revenue) * 100
      : 0
  );

  // --- TODO List Logic ---
  interface TodoItem {
    id: string;
    text: string;
    completed: boolean;
  }

  let todos = $state<TodoItem[]>([]);
  let newTodoText = $state('');

  onMount(() => {
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
      text: newTodoText.trim(),
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

  function pressKey(key: string) {
    if (isResetOnNext) {
      calcDisplay = '';
      isResetOnNext = false;
    }

    if (calcDisplay === '0' && key !== '.') {
      calcDisplay = key;
    } else {
      if (key === '.' && calcDisplay.includes('.')) return;
      calcDisplay += key;
    }
  }

  function pressOperator(op: string) {
    if (isResetOnNext) {
      isResetOnNext = false;
    }
    calcEquation += calcDisplay + ' ' + op + ' ';
    calcDisplay = '0';
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

<!-- Snippets for structuring layout elements -->
{#snippet headerSection()}
  <div class="dashboard-header glass-panel">
    <div class="header-left">
      <h2>Inicio y Resumen General 📈</h2>
      <p class="subtitle">Bienvenido, {$user?.name || 'Usuario'}. Aquí tienes el resumen operacional del local para el día de hoy.</p>
    </div>
    <button class="btn btn-secondary" onclick={loadDashboardData} disabled={isLoading}>
      🔄 Actualizar Datos
    </button>
  </div>
{/snippet}

{#snippet loadingState()}
  <div class="loading-state flex-center glass-panel">
    <div class="spinner"></div>
    <p>Cargando resumen operacional...</p>
  </div>
{/snippet}

{#snippet kpiCard(title: string, value: string | number, desc: string, icon: string, textClass: string)}
  <div class="kpi-card glass-panel animate-scale-up">
    <div class="kpi-icon">{icon}</div>
    <div class="kpi-content">
      <span class="kpi-title">{title}</span>
      <strong class="kpi-value {textClass}">{value}</strong>
      <span class="kpi-desc">{desc}</span>
    </div>
  </div>
{/snippet}

{#snippet deptCard(name: string, netProfit: number, revenue: number, expenses: number, nameClass: string, bgClass: string, widthPercent: number)}
  <div class="dept-card">
    <div class="dept-title-row">
      <span class="dept-name {nameClass}">{name}</span>
      <strong class="dept-net-profit">${netProfit.toLocaleString()}</strong>
    </div>
    <div class="progress-bar-container">
      <div class="progress-bar {bgClass}" style="width: {widthPercent}%"></div>
    </div>
    <div class="dept-details">
      <span>Ventas: ${revenue.toLocaleString()}</span>
      <span>Gastos: ${expenses.toLocaleString()}</span>
    </div>
  </div>
{/snippet}

{#snippet paymentRow(method: string, amount: number)}
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
      <div class="progress-bar bg-general" style="width: {dashboardData.CONSOLIDATED.revenue > 0 ? (amount / dashboardData.CONSOLIDATED.revenue) * 100 : 0}%"></div>
    </div>
  </div>
{/snippet}

{#snippet alertItemRow(item: any)}
  <div class="alert-item animate-fade-in">
    <div class="alert-info">
      <strong class="product-name">{item.name}</strong>
      <span class="product-sku">SKU: {item.sku} | Cat: {item.category.name}</span>
    </div>
    <div class="alert-badge" class:badge-zero={item.stock === 0} class:badge-low={item.stock > 0}>
      {item.stock === 0 ? 'Sin Stock' : `${item.stock} unidades`}
    </div>
  </div>
{/snippet}

{#snippet todoItemRow(todo: any)}
  <div class="todo-item" class:completed={todo.completed}>
    <label class="todo-label">
      <input type="checkbox" checked={todo.completed} onchange={() => toggleTodo(todo.id)} />
      <span class="todo-text">{todo.text}</span>
    </label>
    <button class="remove-todo-btn" onclick={() => deleteTodo(todo.id)}>✕</button>
  </div>
{/snippet}

<!-- Main View -->
<div class="dashboard-container flex-column animate-fade-in">
  {@render headerSection()}

  {#if errorMsg}
    <div class="error-banner">{errorMsg}</div>
  {/if}

  {#if isLoading && !dashboardData}
    {@render loadingState()}
  {:else if dashboardData}
    <!-- Main Dashboard Grid -->
    <div class="dashboard-grid">
      
      <!-- 1. KPI Panel (Row of 4 Cards) -->
      <div class="kpis-row">
        {@render kpiCard('Ingresos Brutos', `$${dashboardData.CONSOLIDATED.revenue.toLocaleString()}`, 'Total ventas no anuladas', '💰', 'text-general')}
        {@render kpiCard('Egresos Totales', `$${dashboardData.CONSOLIDATED.expenses.toLocaleString()}`, 'Operacionales e insumos', '💸', 'text-danger')}
        {@render kpiCard(
          'Utilidad Neta', 
          `$${dashboardData.CONSOLIDATED.netProfit.toLocaleString()}`, 
          'Ingresos - Costos - Gastos', 
          '🌿', 
          dashboardData.CONSOLIDATED.netProfit >= 0 ? 'text-general' : 'text-danger'
        )}
        {@render kpiCard('Margen Neto', `${margin.toFixed(1)}%`, 'Retorno por cada peso vendido', '📊', 'text-general')}
      </div>

      <!-- 2. Middle Row: Departments & Payments -->
      <div class="dashboard-row">
        <!-- Department breakdown -->
        <div class="dashboard-col glass-panel flex-column animate-scale-up">
          <h3>Desglose por Departamento</h3>
          <div class="dept-comparison">
            {@render deptCard(
              '🍏 Mercado Saludable', 
              dashboardData.MARKET.netProfit, 
              dashboardData.MARKET.revenue, 
              dashboardData.MARKET.expenses, 
              'text-market', 
              'bg-market', 
              dashboardData.CONSOLIDATED.revenue > 0 ? (dashboardData.MARKET.revenue / dashboardData.CONSOLIDATED.revenue) * 100 : 0
            )}
            {@render deptCard(
              '☕ Barra de Café', 
              dashboardData.CAFE.netProfit, 
              dashboardData.CAFE.revenue, 
              dashboardData.CAFE.expenses, 
              'text-cafe', 
              'bg-cafe', 
              dashboardData.CONSOLIDATED.revenue > 0 ? (dashboardData.CAFE.revenue / dashboardData.CONSOLIDATED.revenue) * 100 : 0
            )}
          </div>
        </div>

        <!-- Payments breakdown -->
        <div class="dashboard-col glass-panel flex-column animate-scale-up">
          <h3>Distribución de Métodos de Pago</h3>
          <div class="payment-distribution">
            {#each Object.entries(dashboardData.paymentMethods) as [method, amount]}
              {@render paymentRow(method, amount as number)}
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
            {#each lowStockAlerts as item}
              {@render alertItemRow(item)}
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
              {@render todoItemRow(todo)}
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
              <button class="calc-btn op-clear" onclick={clearCalc}>C</button>
              <button class="calc-btn op" onclick={() => pressOperator('/')}>&divide;</button>
              <button class="calc-btn op" onclick={() => pressOperator('*')}>&times;</button>
              <button class="calc-btn op" onclick={() => pressOperator('-')}>&minus;</button>

              <button class="calc-btn num" onclick={() => pressKey('7')}>7</button>
              <button class="calc-btn num" onclick={() => pressKey('8')}>8</button>
              <button class="calc-btn num" onclick={() => pressKey('9')}>9</button>
              <button class="calc-btn op" onclick={() => pressOperator('+')}>+</button>

              <button class="calc-btn num" onclick={() => pressKey('4')}>4</button>
              <button class="calc-btn num" onclick={() => pressKey('5')}>5</button>
              <button class="calc-btn num" onclick={() => pressKey('6')}>6</button>
              <button class="calc-btn op-equal" onclick={calculateResult}>=</button>

              <button class="calc-btn num" onclick={() => pressKey('1')}>1</button>
              <button class="calc-btn num" onclick={() => pressKey('2')}>2</button>
              <button class="calc-btn num" onclick={() => pressKey('3')}>3</button>
              <button class="calc-btn num-zero" onclick={() => pressKey('0')}>0</button>

              <button class="calc-btn num" onclick={() => pressKey('.')}>.</button>
            </div>
          </div>
        </div>
      </div>

    </div>
  {/if}
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

  .kpi-card {
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .kpi-icon {
    font-size: 2.2rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    padding: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border-glass);
  }

  .kpi-content {
    display: flex;
    flex-direction: column;
  }

  .kpi-title {
    font-size: 0.8rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
  }

  .kpi-value {
    font-size: 1.45rem;
    font-weight: 700;
  }

  .kpi-desc {
    font-size: 0.72rem;
    color: var(--text-muted);
    margin-top: 2px;
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

  /* Dept cards */
  .dept-comparison {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .dept-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .dept-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .dept-name {
    font-size: 0.88rem;
    font-weight: 500;
  }

  .dept-net-profit {
    font-size: 0.95rem;
    font-weight: 600;
  }

  .progress-bar-container {
    height: 8px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    overflow: hidden;
    width: 100%;
  }

  .progress-bar {
    height: 100%;
    border-radius: 4px;
  }

  .bg-market {
    background: var(--color-market);
  }

  .bg-cafe {
    background: var(--color-cafe);
  }

  .dept-details {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--text-secondary);
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

  .todo-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(255, 255, 255, 0.01);
    border: 1px solid var(--border-glass);
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    transition: var(--transition-fast);
  }

  .todo-item:hover {
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .todo-item.completed {
    opacity: 0.5;
  }

  .todo-item.completed .todo-text {
    text-decoration: line-through;
    color: var(--text-muted);
  }

  .todo-label {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    flex: 1;
  }

  .todo-label input {
    cursor: pointer;
    width: 16px;
    height: 16px;
  }

  .todo-text {
    font-size: 0.85rem;
    color: var(--text-primary);
  }

  .remove-todo-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: bold;
    padding: 2px 6px;
    transition: var(--transition-fast);
  }

  .remove-todo-btn:hover {
    color: var(--color-danger);
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

  .calc-btn {
    height: 42px;
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 0.95rem;
    font-weight: 600;
    transition: var(--transition-fast);
    outline: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .calc-btn:active {
    transform: scale(0.95);
  }

  .calc-btn.num {
    background: rgba(255, 255, 255, 0.02);
    color: var(--text-primary);
  }

  .calc-btn.num:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .calc-btn.num-zero {
    grid-column: span 2;
    background: rgba(255, 255, 255, 0.02);
    color: var(--text-primary);
  }

  .calc-btn.num-zero:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .calc-btn.op-clear {
    grid-column: span 3;
    background: rgba(244, 63, 94, 0.08);
    border-color: rgba(244, 63, 94, 0.2);
    color: var(--color-danger);
  }

  .calc-btn.op-clear:hover {
    background: var(--color-danger-glow);
    border-color: var(--color-danger);
  }

  .calc-btn.op {
    background: rgba(255, 255, 255, 0.04);
    color: var(--color-general);
  }

  .calc-btn.op:hover {
    background: var(--color-general-glow);
  }

  .calc-btn.op-equal {
    background: var(--color-general);
    color: #fff;
    border-color: var(--color-general);
  }

  .calc-btn.op-equal:hover {
    background: var(--color-general-hover);
    transform: scale(1.02);
  }
</style>
