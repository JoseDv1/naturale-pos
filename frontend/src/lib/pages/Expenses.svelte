<script lang="ts">
  import { untrack } from 'svelte';
  import { user, products, refreshTrigger, triggerRefresh } from '../store';
  import { getExpenses, createExpense } from '../api/expenses';
  import ExpenseRow from '../components/organisms/ExpenseRow.svelte';

  import Spinner from '../components/atoms/Spinner.svelte';

  let currentSubTab = $state('log'); // 'log' | 'register'
  let expenseType = $state('operating'); // 'operating' | 'supplies'

  // Past expenses log
  let expenses = $state<any[]>([]);
  let searchQuery = $state('');

  // Operating Expense Form
  let opDesc = $state('');
  let opAmount = $state('');
  let opDept = $state('GENERAL'); // 'MARKET' | 'CAFE' | 'GENERAL'
  let opCategory = $state('utilities'); // 'rent', 'utilities', 'services', 'marketing', etc.

  // Supplies Expense Form
  let supDesc = $state('Compra de Mercancía / Suministros');
  let supDept = $state('MARKET'); // 'MARKET' | 'CAFE'
  let addedItems = $state<Array<{ productId: string; name: string; quantity: number; unitCost: number }>>([]);
  let currentProductSelected = $state('');
  let currentQty = $state(1);
  let currentUnitCost = $state(0);

  let expensesPromise = $state<Promise<any[]>>(
    getExpenses().then((data) => {
      expenses = data;
      return data;
    })
  );

  $effect(() => {
    if ($refreshTrigger) {
      loadExpenses();
    }
  });

  function loadExpenses() {
    expensesPromise = getExpenses().then((data) => {
      expenses = data;
      return data;
    });
  }

  // Update current unit cost when product is selected in Supplies Form
  $effect(() => {
    if (currentProductSelected) {
      const prod = $products.find((p) => p.id === currentProductSelected);
      if (prod) {
        currentUnitCost = prod.cost;
      }
    }
  });

  // Add item to supplies list
  function addItemToSupplies() {
    if (!currentProductSelected || currentQty <= 0 || currentUnitCost <= 0) {
      alert('Ingresa una cantidad y costo válidos.');
      return;
    }

    const prod = $products.find((p) => p.id === currentProductSelected);
    if (!prod) return;

    // Check if already added
    const existingIndex = addedItems.findIndex((item) => item.productId === currentProductSelected);
    if (existingIndex > -1) {
      addedItems[existingIndex].quantity += currentQty;
      addedItems[existingIndex].unitCost = currentUnitCost; // update to latest cost
    } else {
      addedItems = [
        ...addedItems,
        {
          productId: currentProductSelected,
          name: prod.name,
          quantity: currentQty,
          unitCost: currentUnitCost,
        },
      ];
    }

    // Reset inputs
    currentProductSelected = '';
    currentQty = 1;
    currentUnitCost = 0;
  }

  function removeItemFromSupplies(index: number) {
    addedItems = addedItems.filter((_, i) => i !== index);
  }

  let suppliesTotalAmount = $derived(addedItems.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0));

  // Submit Operating Expense
  async function submitOperatingExpense() {
    const amt = parseFloat(opAmount);
    if (!opDesc || isNaN(amt) || amt <= 0) {
      alert('Ingresa una descripción y monto válido.');
      return;
    }

    try {
      const payload = {
        description: opDesc,
        amount: amt,
        category: opCategory,
        department: opDept,
        userId: $user?.id,
      };
      await createExpense(payload);
      // Reset form
      opDesc = '';
      opAmount = '';
      currentSubTab = 'log';
      triggerRefresh();
    } catch (e: any) {
      alert(e.message || 'Error al guardar el gasto');
    }
  }

  // Submit Supplies Expense
  async function submitSuppliesExpense() {
    if (!supDesc) {
      alert('Ingresa una descripción para el gasto.');
      return;
    }
    if (addedItems.length === 0) {
      alert('Debes agregar al menos un producto a la compra.');
      return;
    }

    try {
      const payload = {
        description: supDesc,
        amount: suppliesTotalAmount,
        category: 'supplies',
        department: supDept,
        userId: $user?.id,
        items: addedItems,
      };
      await createExpense(payload);
      // Reset form
      supDesc = 'Compra de Mercancía / Suministros';
      addedItems = [];
      currentSubTab = 'log';
      triggerRefresh();
    } catch (e: any) {
      alert(e.message || 'Error al guardar el gasto');
    }
  }

  // Filtered expenses log
  let filteredExpenses = $derived(expenses.filter((e) => {
    return e.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
           e.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
           e.department.toLowerCase().includes(searchQuery.toLowerCase());
  }));
</script>

<div class="expenses-container flex-column animate-fade-in">
  <div class="expenses-header glass-panel">
    <div class="header-left">
      <h2>Gastos y Suministros</h2>
      <div class="sub-tabs">
        <button class="sub-tab" class:active={currentSubTab === 'log'} onclick={() => currentSubTab = 'log'}>
          📋 Registro de Egresos
        </button>
        <button class="sub-tab" class:active={currentSubTab === 'register'} onclick={() => currentSubTab = 'register'}>
          💸 Registrar Egreso / Compra
        </button>
      </div>
    </div>
  </div>

  {#if currentSubTab === 'log'}
    <!-- EXPENSES LIST WORKSPACE -->
    <div class="catalog-filters glass-panel animate-fade-in">
      <input type="text" placeholder="Buscar gasto por descripción, categoría..." bind:value={searchQuery} class="filter-input" />
    </div>

    <div class="table-card glass-panel flex-1 scroll-y animate-scale-up">
      {#await expensesPromise}
        <div class="loading-state flex-center" style="padding: 40px 0;">
          <Spinner size="40px" />
          <p style="margin-top: 12px; color: var(--text-secondary);">Cargando egresos...</p>
        </div>
      {:then}
        <table class="pos-table">
          <thead>
            <tr>
              <th>Fecha y Hora</th>
              <th>Descripción</th>
              <th>Categoría</th>
              <th>Departamento</th>
              <th>Productos Comprados</th>
              <th class="text-right">Monto</th>
              <th>Registrado Por</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredExpenses as exp}
              <ExpenseRow expense={exp} />
            {:else}
              <tr>
                <td colspan="7" class="text-center text-muted italic">No se han registrado egresos o compras de suministros aún.</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:catch error}
        <div class="error-banner animate-fade-in" style="margin: 20px;">
          Error al cargar egresos: {error.message}
        </div>
      {/await}
    </div>
  {:else}
    <!-- REGISTER WORKSPACE -->
    <div class="register-workspace animate-scale-up">
      <div class="type-selector glass-panel">
        <h3>Tipo de Registro:</h3>
        <div class="type-buttons">
          <button class="type-btn" class:active={expenseType === 'operating'} onclick={() => expenseType = 'operating'}>
            ⚡ Gasto Operativo (Servicios, Alquiler, etc.)
          </button>
          <button class="type-btn" class:active={expenseType === 'supplies'} onclick={() => expenseType = 'supplies'}>
            📦 Compra de Suministros (Ingresa al Inventario)
          </button>
        </div>
      </div>

      {#if expenseType === 'operating'}
        <!-- OPERATING EXPENSE FORM -->
        <div class="form-container glass-panel animate-scale-up">
          <h3>Gasto Operativo o Administrativo</h3>
          <div class="form-body">
            <div class="form-row">
              <div class="form-group flex-1">
                <label for="op-desc">Descripción del Gasto *</label>
                <input type="text" id="op-desc" bind:value={opDesc} placeholder="Ej: Pago servicio energía eléctrica" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group flex-1">
                <label for="op-amount">Monto *</label>
                <div class="input-with-prefix">
                  <span class="prefix-symbol">$</span>
                  <input type="number" id="op-amount" bind:value={opAmount} placeholder="Ej: 150000" min="1" step="any" />
                </div>
              </div>
              <div class="form-group flex-1">
                <label>Departamento *</label>
                <div class="segmented-control">
                  <button type="button" class="segment-btn" class:active={opDept === 'GENERAL'} onclick={() => opDept = 'GENERAL'}>
                    🏢 General
                  </button>
                  <button type="button" class="segment-btn" class:active={opDept === 'MARKET'} onclick={() => opDept = 'MARKET'}>
                    🍏 Mercado
                  </button>
                  <button type="button" class="segment-btn" class:active={opDept === 'CAFE'} onclick={() => opDept = 'CAFE'}>
                    ☕ Café
                  </button>
                </div>
              </div>
              <div class="form-group flex-1">
                <label for="op-cat">Categoría *</label>
                <select id="op-cat" bind:value={opCategory}>
                  <option value="utilities">Servicios Públicos</option>
                  <option value="rent">Arriendo / Local</option>
                  <option value="maintenance">Mantenimiento / Aseo</option>
                  <option value="supplies">Papelería / Limpieza</option>
                  <option value="marketing">Publicidad</option>
                  <option value="other">Otros Egresos</option>
                </select>
              </div>
            </div>
            
            <button class="btn btn-danger register-btn" onclick={submitOperatingExpense}>
              Registrar Gasto Operativo 💸
            </button>
          </div>
        </div>
      {:else}
        <!-- SUPPLIES EXPENSE FORM (STOCKS INCREMENT) -->
        <div class="supplies-layout flex-1">
          <!-- Item Builder (Left) -->
          <div class="builder-side glass-panel flex-1">
            <h3>Compra de Mercancía / Suministros</h3>
            <div class="form-body">
              <div class="form-row">
                <div class="form-group flex-1">
                  <label for="sup-desc">Descripción General *</label>
                  <input type="text" id="sup-desc" bind:value={supDesc} placeholder="Ej: Compra proveedor de proteínas" />
                </div>
                <div class="form-group" style="width: 180px;">
                  <label for="sup-dept">Departamento *</label>
                  <select id="sup-dept" bind:value={supDept}>
                    <option value="MARKET">🍏 Mercado Saludable</option>
                    <option value="CAFE">☕ Café</option>
                  </select>
                </div>
              </div>

              <!-- Product Item Adder -->
              <div class="adder-box glass-card">
                <h4>Agregar Producto a la Compra</h4>
                <div class="adder-row">
                  <div class="form-group flex-1">
                    <label>Producto *</label>
                    <select bind:value={currentProductSelected}>
                      <option value="">-- Selecciona un Producto --</option>
                      {#each $products as prod}
                        <option value={prod.id}>{prod.name} (Stock: {prod.stock})</option>
                      {/each}
                    </select>
                  </div>
                  <div class="form-group" style="width: 100px;">
                    <label>Cantidad *</label>
                    <input type="number" bind:value={currentQty} min="1" />
                  </div>
                  <div class="form-group" style="width: 130px;">
                    <label>Costo Unitario ($) *</label>
                    <input type="number" bind:value={currentUnitCost} min="0.01" step="any" />
                  </div>
                  <button class="btn btn-general add-item-btn" onclick={addItemToSupplies}>
                    Agregar ➕
                  </button>
                </div>
              </div>
            </div>

            <!-- List of items to purchase -->
            <div class="added-items-table scroll-y">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th class="text-center">Cantidad</th>
                    <th class="text-right">Costo Unitario</th>
                    <th class="text-right">Subtotal</th>
                    <th class="text-center">Eliminar</th>
                  </tr>
                </thead>
                <tbody>
                  {#each addedItems as item, idx}
                    <tr>
                      <td>{item.name}</td>
                      <td class="text-center">x{item.quantity}</td>
                      <td class="text-right">${item.unitCost.toLocaleString()}</td>
                      <td class="text-right">${(item.quantity * item.unitCost).toLocaleString()}</td>
                      <td class="text-center">
                        <button class="remove-item-btn" onclick={() => removeItemFromSupplies(idx)}>✕</button>
                      </td>
                    </tr>
                  {:else}
                    <tr>
                      <td colspan="5" class="text-center text-muted italic">No se han agregado productos a la compra aún.</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Checkout Cart (Right) -->
          <div class="summary-side glass-panel">
            <h3>Resumen de Compra</h3>
            <div class="summary-details">
              <div class="summary-row">
                <span>Productos Diferentes:</span>
                <span>{addedItems.length}</span>
              </div>
              <div class="summary-row">
                <span>Monto Total Egreso:</span>
                <strong class="total-egreso text-danger">${suppliesTotalAmount.toLocaleString()}</strong>
              </div>
              
              <div class="info-note">
                💡 Al guardar esta compra, el stock de cada producto se incrementará automáticamente en el inventario y se actualizará su costo según el valor unitario ingresado.
              </div>
            </div>

            <button class="btn btn-danger register-btn" onclick={submitSuppliesExpense} disabled={addedItems.length === 0}>
              Registrar Compra y Restablecer Stock ✔
            </button>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .expenses-container {
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

  .expenses-header {
    padding: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-left h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 12px;
  }

  .sub-tabs {
    display: flex;
    gap: 8px;
  }

  .sub-tab {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.88rem;
    font-weight: 500;
    transition: var(--transition-fast);
    outline: none;
  }
  .sub-tab:hover {
    background: rgba(255, 255, 255, 0.03);
    color: var(--text-primary);
  }
  .sub-tab.active {
    background: rgba(255, 255, 255, 0.07);
    color: var(--text-primary);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .catalog-filters {
    padding: 12px 16px;
    display: flex;
  }

  .filter-input {
    flex: 1;
  }

  .table-card {
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .scroll-y {
    overflow-y: auto;
  }



  .text-right {
    text-align: right;
  }
  .text-center {
    text-align: center;
  }

  /* Register Workspace styles */
  .register-workspace {
    display: flex;
    flex-direction: column;
    gap: 16px;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .type-selector {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .type-selector h3 {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .type-buttons {
    display: flex;
    gap: 12px;
  }

  .type-btn {
    flex: 1;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border-glass);
    color: var(--text-secondary);
    padding: 12px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-weight: 500;
    transition: var(--transition-fast);
    outline: none;
  }

  .type-btn:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .type-btn.active {
    background: var(--color-danger-glow);
    color: #fca5a5;
    border-color: var(--color-danger);
  }

  .form-container {
    padding: 24px;
    overflow-y: auto;
  }

  .form-container h3 {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 20px;
    color: var(--text-primary);
  }

  .form-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-row {
    display: flex;
    gap: 12px;
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

  .register-btn {
    height: 44px;
    width: 100%;
    font-size: 0.95rem;
    margin-top: 10px;
  }

  /* Supplies Layout */
  .supplies-layout {
    display: flex;
    gap: 16px;
    overflow: hidden;
    flex: 1;
    min-height: 0;
  }

  .builder-side {
    display: flex;
    flex-direction: column;
    padding: 20px;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    gap: 16px;
  }

  .builder-side h3 {
    font-size: 1rem;
    font-weight: 600;
  }

  .adder-box {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .adder-box h4 {
    font-size: 0.88rem;
    color: var(--text-primary);
  }

  .adder-row {
    display: flex;
    gap: 12px;
    align-items: flex-end;
    flex-wrap: wrap;
  }

  .add-item-btn {
    height: 40px;
  }

  .added-items-table {
    flex: 1;
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    overflow-y: auto;
  }

  .added-items-table table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }

  .added-items-table th {
    background: rgba(255, 255, 255, 0.02);
    color: var(--text-secondary);
    font-weight: 500;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border-glass);
    text-align: left;
  }

  .added-items-table td {
    padding: 10px 14px;
    border-bottom: 1px solid var(--border-glass);
  }

  .remove-item-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-weight: 600;
  }
  .remove-item-btn:hover {
    color: var(--color-danger);
  }

  .summary-side {
    width: 320px;
    display: flex;
    flex-direction: column;
    padding: 20px;
    flex-shrink: 0;
    height: 100%;
    box-sizing: border-box;
  }

  .summary-side h3 {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 20px;
  }

  .summary-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .total-egreso {
    font-size: 1.4rem;
    font-weight: 700;
  }

  .info-note {
    background: rgba(99, 102, 241, 0.05);
    border: 1px solid rgba(99, 102, 241, 0.15);
    border-radius: var(--radius-sm);
    padding: 12px;
    font-size: 0.78rem;
    color: #a5b4fc;
    line-height: 1.4;
    margin-top: 10px;
  }

  .input-with-prefix {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
  }

  .prefix-symbol {
    position: absolute;
    left: 14px;
    color: var(--text-secondary);
    font-size: 0.95rem;
    font-weight: 500;
    pointer-events: none;
  }

  .input-with-prefix input {
    padding-left: 30px !important;
    width: 100%;
  }

  /* Segmented control for department */
  .segmented-control {
    display: flex;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    padding: 3px;
    gap: 4px;
    width: 100%;
    box-sizing: border-box;
    height: 40px; /* match input height */
  }

  .segment-btn {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 0.82rem;
    font-weight: 500;
    cursor: pointer;
    border-radius: calc(var(--radius-sm) - 2px);
    transition: var(--transition-fast);
    outline: none;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .segment-btn:hover {
    background: rgba(255, 255, 255, 0.03);
    color: var(--text-primary);
  }

  .segment-btn.active {
    background: var(--color-general-glow);
    color: var(--color-general);
    border: 1px solid rgba(16, 185, 129, 0.2);
    font-weight: 600;
  }
</style>
