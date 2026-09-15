<script lang="ts">
  import { user, products, refreshTrigger, triggerRefresh } from '../store';
  import {
    getExpenses,
    createExpense,
    getExpenseCategories,
    createExpenseCategory,
    updateExpenseCategory,
    deleteExpenseCategory
  } from '../api/expenses';
  import ExpenseRow from '../components/organisms/ExpenseRow.svelte';
  import Spinner from '../components/atoms/Spinner.svelte';

  let currentSubTab = $state('log'); // 'log' | 'register' | 'categories'
  let expenseType = $state('operating'); // 'operating' | 'supplies'

  // Past expenses log
  let expenses = $state<any[]>([]);
  let searchQuery = $state('');

  // Operating Expense Form
  let opDesc = $state('');
  let opAmount = $state('');
  let opDept = $state('GENERAL'); // 'MARKET' | 'CAFE' | 'GENERAL'
  let opCategory = $state('utilities');

  // Supplies Expense Form
  let supDesc = $state('Compra de Mercancía / Suministros');
  let supDept = $state('MARKET'); // 'MARKET' | 'CAFE'
  let addedItems = $state<Array<{ productId: string; name: string; quantity: number; unitCost: number }>>([]);
  let currentProductSelected = $state('');
  let currentQty = $state(1);
  let currentUnitCost = $state(0);

  // Expense Categories State
  let expenseCategories = $state<any[]>([]);
  let showCategoryModal = $state(false);
  let categoryModalMode = $state<'add' | 'edit'>('add');
  let currentCategory = $state<{ id?: string; name: string; description?: string }>({ name: '', description: '' });
  let categorySearchQuery = $state('');
  let isSavingCategory = $state(false);

  let expensesPromise = $state<Promise<any[]>>(loadExpensesData());
  let categoriesPromise = $state<Promise<any[]>>(loadCategoriesData());

  function loadExpensesData() {
    return getExpenses().then((data) => {
      expenses = data;
      return data;
    });
  }

  function loadCategoriesData() {
    return getExpenseCategories().then((cats) => {
      expenseCategories = cats;
      return cats;
    });
  }

  $effect(() => {
    if ($refreshTrigger) {
      loadExpenses();
      loadCategories();
    }
  });

  function loadExpenses() {
    expensesPromise = loadExpensesData();
  }

  function loadCategories() {
    categoriesPromise = loadCategoriesData();
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

    const existingIndex = addedItems.findIndex((item) => item.productId === currentProductSelected);
    if (existingIndex > -1) {
      addedItems[existingIndex].quantity += currentQty;
      addedItems[existingIndex].unitCost = currentUnitCost;
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
      supDesc = 'Compra de Mercancía / Suministros';
      addedItems = [];
      currentSubTab = 'log';
      triggerRefresh();
    } catch (e: any) {
      alert(e.message || 'Error al guardar el gasto');
    }
  }

  // Categories CRUD
  function openAddCategory() {
    categoryModalMode = 'add';
    currentCategory = { name: '', description: '' };
    showCategoryModal = true;
  }

  function openEditCategory(cat: any) {
    categoryModalMode = 'edit';
    currentCategory = { id: cat.id, name: cat.name, description: cat.description || '' };
    showCategoryModal = true;
  }

  async function saveCategory() {
    if (!currentCategory.name || !currentCategory.name.trim()) {
      alert('Por favor escribe el nombre de la categoría.');
      return;
    }

    isSavingCategory = true;
    try {
      if (categoryModalMode === 'edit' && currentCategory.id) {
        await updateExpenseCategory(currentCategory.id, {
          name: currentCategory.name.trim(),
          description: currentCategory.description?.trim() || '',
        });
      } else {
        const res = await createExpenseCategory({
          name: currentCategory.name.trim(),
          description: currentCategory.description?.trim() || '',
        });
        if (res.category?.id) {
          opCategory = res.category.id;
        }
      }
      showCategoryModal = false;
      loadCategories();
      triggerRefresh();
    } catch (e: any) {
      alert(e.message || 'Error al guardar la categoría');
    } finally {
      isSavingCategory = false;
    }
  }

  async function deleteCategory(id: string) {
    if (!confirm('¿Estás seguro de eliminar esta categoría de egreso? Los gastos existentes se reasignarán a "Otros Egresos".')) return;
    try {
      await deleteExpenseCategory(id);
      loadCategories();
      triggerRefresh();
    } catch (e: any) {
      alert(e.message || 'Error al eliminar la categoría');
    }
  }

  // Filtered expenses log
  let filteredExpenses = $derived(expenses.filter((e) => {
    return e.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
           e.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
           e.department.toLowerCase().includes(searchQuery.toLowerCase());
  }));

  // Filtered expense categories
  let filteredCategories = $derived(expenseCategories.filter((cat) => {
    const q = categorySearchQuery.toLowerCase().trim();
    if (!q) return true;
    return cat.name.toLowerCase().includes(q) || (cat.description && cat.description.toLowerCase().includes(q));
  }));
</script>

<div class="expenses-container flex-column animate-fade-in">
  <div class="expenses-header glass-panel">
    <div class="header-left">
      <h2>Gastos y Suministros 💸</h2>
      <div class="sub-tabs">
        <button class="sub-tab" class:active={currentSubTab === 'log'} onclick={() => currentSubTab = 'log'}>
          📋 Registro de Egresos
        </button>
        <button class="sub-tab" class:active={currentSubTab === 'register'} onclick={() => currentSubTab = 'register'}>
          💸 Registrar Egreso / Compra
        </button>
        <button class="sub-tab" class:active={currentSubTab === 'categories'} onclick={() => currentSubTab = 'categories'}>
          🏷️ Categorías de Egresos
        </button>
      </div>
    </div>

    <div class="header-actions">
      {#if currentSubTab === 'categories'}
        {#if $user?.role === 'ADMIN'}
          <button class="btn btn-general" onclick={openAddCategory}>
            ➕ Registrar Categoría de Egreso
          </button>
        {/if}
      {:else if currentSubTab === 'log'}
        <button class="btn btn-general" onclick={() => currentSubTab = 'register'}>
          ➕ Registrar Egreso
        </button>
      {/if}
      <button class="btn btn-secondary" onclick={() => { loadExpenses(); loadCategories(); }}>
        🔄 Actualizar
      </button>
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
  {:else if currentSubTab === 'register'}
    <!-- REGISTER WORKSPACE -->
    <div class="register-workspace animate-scale-up">
      <div class="type-selector glass-panel">
        <h3>Tipo de Registro:</h3>
        <div class="type-buttons">
          <button class="type-btn" class:active={expenseType === 'operating'} onclick={() => expenseType = 'operating'}>
            ⚡ Gasto Operativo (Servicios, Nómina, Alquiler, etc.)
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
                <input type="text" id="op-desc" bind:value={opDesc} placeholder="Ej: Pago de energía eléctrica, nómina quincenal, arriendo..." />
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
                <span style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 500; margin-bottom: 6px;">Departamento *</span>
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
                <div class="label-with-action">
                  <label for="op-cat">Categoría *</label>
                  {#if $user?.role === 'ADMIN'}
                    <button
                      type="button"
                      class="btn-text-action"
                      onclick={openAddCategory}
                      title="Registrar nueva categoría de egreso"
                      aria-label="Registrar nueva categoría de egreso"
                    >
                      ➕ Nueva
                    </button>
                  {/if}
                </div>
                <select id="op-cat" bind:value={opCategory}>
                  {#each expenseCategories as cat}
                    <option value={cat.id}>
                      {cat.name} {cat.isSystem ? '' : '(Personalizada)'}
                    </option>
                  {:else}
                    <option value="utilities">Servicios Públicos</option>
                    <option value="rent">Arriendo / Local</option>
                    <option value="supplies">Papelería / Suministros</option>
                    <option value="payroll">Nómina / Sueldos</option>
                    <option value="maintenance">Mantenimiento / Aseo</option>
                    <option value="marketing">Publicidad</option>
                    <option value="other">Otros Egresos</option>
                  {/each}
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
                    <label for="current-product-select">Producto *</label>
                    <select id="current-product-select" bind:value={currentProductSelected}>
                      <option value="">-- Selecciona un Producto --</option>
                      {#each $products as prod}
                        <option value={prod.id}>{prod.name} (Stock: {prod.stock})</option>
                      {/each}
                    </select>
                  </div>
                  <div class="form-group" style="width: 100px;">
                    <label for="current-qty-input">Cantidad *</label>
                    <input type="number" id="current-qty-input" bind:value={currentQty} min="1" />
                  </div>
                  <div class="form-group" style="width: 130px;">
                    <label for="current-cost-input">Costo Unitario ($) *</label>
                    <input type="number" id="current-cost-input" bind:value={currentUnitCost} min="0.01" step="any" />
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
                        <button type="button" class="remove-item-btn" onclick={() => removeItemFromSupplies(idx)} aria-label="Eliminar producto">✕</button>
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
  {:else if currentSubTab === 'categories'}
    <!-- EXPENSE CATEGORIES WORKSPACE -->
    <div class="catalog-filters glass-panel animate-fade-in">
      <input
        type="text"
        placeholder="Buscar categoría de egreso por nombre..."
        bind:value={categorySearchQuery}
        class="filter-input"
        style="max-width: 320px;"
      />
    </div>

    <div class="table-card glass-panel flex-1 scroll-y animate-scale-up">
      {#await categoriesPromise}
        <div class="loading-state flex-center" style="padding: 40px 0;">
          <Spinner size="40px" />
          <p style="margin-top: 12px; color: var(--text-secondary);">Cargando categorías...</p>
        </div>
      {:then}
        <table class="pos-table">
          <thead>
            <tr>
              <th>Nombre de la Categoría</th>
              <th>Descripción</th>
              <th>Tipo</th>
              <th class="text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredCategories as cat}
              <tr>
                <td><strong>{cat.name}</strong></td>
                <td>{cat.description || '—'}</td>
                <td>
                  {#if cat.isSystem}
                    <span class="badge-system">Estándar del Sistema</span>
                  {:else}
                    <span class="badge-custom">Personalizada</span>
                  {/if}
                </td>
                <td class="text-center" style="width: 120px;">
                  {#if !cat.isSystem}
                    {#if $user?.role === 'ADMIN'}
                      <div class="row-actions flex-center" style="gap: 8px;">
                        <button class="btn btn-secondary btn-icon" onclick={() => openEditCategory(cat)} title="Editar" aria-label="Editar categoría {cat.name}">
                          ✏️
                        </button>
                        <button class="btn btn-danger btn-icon" onclick={() => deleteCategory(cat.id)} title="Eliminar" aria-label="Eliminar categoría {cat.name}">
                          🗑️
                        </button>
                      </div>
                    {:else}
                      <span class="text-muted italic" style="font-size: 0.82rem;">Solo Admin</span>
                    {/if}
                  {:else}
                    <span class="text-muted italic" style="font-size: 0.82rem;">Protegida</span>
                  {/if}
                </td>
              </tr>
            {:else}
              <tr>
                <td colspan="4" class="text-center text-muted italic">No hay categorías que coincidan con la búsqueda.</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:catch error}
        <div class="error-banner animate-fade-in" style="margin: 20px;">
          Error al cargar categorías: {error.message}
        </div>
      {/await}
    </div>
  {/if}
</div>

<!-- ==========================================
     EXPENSE CATEGORY ADD/EDIT MODAL
     ========================================== -->
{#if showCategoryModal}
  <div class="modal-overlay flex-center animate-fade-in">
    <div class="modal-container glass-panel animate-scale-up" style="max-width: 480px;">
      <div class="modal-header">
        <h2>{categoryModalMode === 'add' ? 'Registrar Nueva Categoría de Egreso' : 'Editar Categoría de Egreso'}</h2>
        <button class="close-modal-btn" onclick={() => showCategoryModal = false} aria-label="Cerrar modal">✕</button>
      </div>

      <div class="product-form-body">
        <div class="form-group">
          <label for="ec-name">Nombre de la Categoría *</label>
          <input type="text" id="ec-name" bind:value={currentCategory.name} placeholder="Ej: Seguros, Eventos, Domicilios..." />
        </div>

        <div class="form-group">
          <label for="ec-desc">Descripción (Opcional)</label>
          <textarea id="ec-desc" bind:value={currentCategory.description} placeholder="Detalles o notas de los gastos aplicables a esta categoría..." rows="3"></textarea>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" onclick={() => showCategoryModal = false} disabled={isSavingCategory}>Cancelar</button>
        <button class="btn btn-general" onclick={saveCategory} disabled={isSavingCategory}>
          {#if isSavingCategory}
            <Spinner size="18px" /> Guardando...
          {:else}
            Guardar Categoría
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

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

  .flex-center {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .scroll-y {
    overflow-y: auto;
  }

  .expenses-header {
    padding: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }

  .header-left h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 8px;
  }

  .header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
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
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-primary);
    font-weight: 600;
  }

  .catalog-filters {
    padding: 12px 16px;
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .filter-input {
    flex: 1;
    max-width: 400px;
  }

  .table-card {
    padding: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .pos-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
  }

  .pos-table th {
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid var(--border-glass);
    color: var(--text-secondary);
    font-weight: 600;
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .pos-table td {
    padding: 14px 16px;
    border-bottom: 1px solid var(--border-glass);
    font-size: 0.9rem;
  }

  .pos-table tr:hover {
    background: rgba(255, 255, 255, 0.015);
  }

  .text-right {
    text-align: right;
  }

  .text-center {
    text-align: center;
  }

  .text-muted {
    color: var(--text-muted);
  }

  .italic {
    font-style: italic;
  }

  .badge-system {
    font-size: 0.75rem;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgba(59, 130, 246, 0.12);
    color: #3b82f6;
    border: 1px solid rgba(59, 130, 246, 0.25);
    font-weight: 500;
  }

  .badge-custom {
    font-size: 0.75rem;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgba(16, 185, 129, 0.12);
    color: var(--color-general);
    border: 1px solid rgba(16, 185, 129, 0.25);
    font-weight: 600;
  }

  .btn-icon {
    padding: 4px 8px;
    font-size: 0.95rem;
  }

  .register-workspace {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
  }

  .type-selector {
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .type-selector h3 {
    font-size: 1rem;
    font-weight: 500;
  }

  .type-buttons {
    display: flex;
    gap: 10px;
  }

  .type-btn {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-glass);
    color: var(--text-secondary);
    padding: 10px 18px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;
    font-size: 0.9rem;
    transition: var(--transition-fast);
  }

  .type-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: var(--text-primary);
  }

  .type-btn.active {
    background: var(--color-danger);
    color: #ffffff;
    border-color: var(--color-danger);
    font-weight: 600;
  }

  .form-container {
    padding: 24px;
    max-width: 800px;
    width: 100%;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .form-container h3 {
    font-size: 1.15rem;
    font-weight: 600;
    border-bottom: 1px solid var(--border-glass);
    padding-bottom: 12px;
  }

  .form-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-row {
    display: flex;
    gap: 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .label-with-action {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .btn-text-action {
    background: transparent;
    border: none;
    color: var(--color-general);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    transition: var(--transition-fast);
  }

  .btn-text-action:hover {
    text-decoration: underline;
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

  .segmented-control {
    display: flex;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    padding: 3px;
    gap: 4px;
    width: 100%;
    box-sizing: border-box;
    height: 40px;
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

  .register-btn {
    margin-top: 8px;
    padding: 12px;
    font-size: 1rem;
    font-weight: 600;
  }

  /* Supplies Layout */
  .supplies-layout {
    display: flex;
    gap: 16px;
    overflow: hidden;
  }

  .builder-side {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow: hidden;
  }

  .adder-box {
    padding: 16px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.015);
    border: 1px solid var(--border-glass);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .adder-box h4 {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--color-general);
  }

  .adder-row {
    display: flex;
    gap: 12px;
    align-items: flex-end;
  }

  .add-item-btn {
    height: 40px;
    white-space: nowrap;
  }

  .added-items-table {
    flex: 1;
    border: 1px solid var(--border-glass);
    border-radius: 8px;
  }

  .added-items-table table {
    width: 100%;
    border-collapse: collapse;
  }

  .added-items-table th {
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid var(--border-glass);
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .added-items-table td {
    padding: 10px 14px;
    border-bottom: 1px solid var(--border-glass);
    font-size: 0.88rem;
  }

  .remove-item-btn {
    background: rgba(244, 63, 94, 0.1);
    border: 1px solid rgba(244, 63, 94, 0.2);
    color: var(--color-danger);
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 0.85rem;
    transition: var(--transition-fast);
  }

  .remove-item-btn:hover {
    background: var(--color-danger);
    color: #ffffff;
  }

  .summary-side {
    width: 320px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .summary-side h3 {
    font-size: 1.1rem;
    font-weight: 600;
    border-bottom: 1px solid var(--border-glass);
    padding-bottom: 12px;
  }

  .summary-details {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin: 20px 0;
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.95rem;
  }

  .total-egreso {
    font-size: 1.4rem;
  }

  .text-danger {
    color: var(--color-danger);
  }

  .info-note {
    background: rgba(99, 102, 241, 0.08);
    border: 1px solid rgba(99, 102, 241, 0.25);
    border-radius: var(--radius-sm);
    padding: 12px;
    font-size: 0.78rem;
    color: #a5b4fc;
    line-height: 1.4;
    margin-top: 10px;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(6px);
    z-index: 1000;
    padding: 20px;
  }

  .modal-container {
    width: 100%;
    border-radius: var(--radius-lg, 12px);
    border: 1px solid var(--border-glass);
    box-shadow: var(--shadow-lg);
    background: var(--bg-glass);
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-glass);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .modal-header h2 {
    font-size: 1.15rem;
    font-weight: 600;
  }

  .close-modal-btn {
    background: transparent;
    border: none;
    font-size: 1.2rem;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .close-modal-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-primary);
  }

  .product-form-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .modal-footer {
    padding: 16px 20px;
    border-top: 1px solid var(--border-glass);
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
</style>
