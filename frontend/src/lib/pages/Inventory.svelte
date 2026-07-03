<script lang="ts">
  import { onMount } from 'svelte';
  import { products, categories, refreshTrigger, triggerRefresh } from '../store';

  // Search and Filters
  let searchQuery = $state('');
  let filterCategory = $state('');
  let filterDept = $state('');

  // Add / Edit Product Modal State
  let showProductModal = $state(false);
  let modalMode = $state('add'); // 'add' | 'edit'
  let currentProduct = $state<any>({});

  onMount(() => {
    loadInventory();
  });

  $effect(() => {
    if ($refreshTrigger) {
      loadInventory();
    }
  });

  async function loadInventory() {
    try {
      const prodRes = await fetch('/api/products');
      const catRes = await fetch('/api/categories');
      if (prodRes.ok && catRes.ok) {
        products.set(await prodRes.json());
        categories.set(await catRes.json());
      }
    } catch (e) {
      console.error('Error loading inventory:', e);
    }
  }

  // Filtered Products
  let filteredProducts = $derived($products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.includes(searchQuery);
    const matchesCategory = filterCategory ? p.categoryId === filterCategory : true;
    const matchesDept = filterDept ? p.department === filterDept : true;
    return matchesSearch && matchesCategory && matchesDept;
  }));

  // Open product form (Add)
  function openAddProduct() {
    modalMode = 'add';
    currentProduct = {
      sku: '',
      name: '',
      description: '',
      price: '',
      cost: '',
      stock: 0,
      categoryId: $categories[0]?.id || '',
      department: 'MARKET',
      isRawMaterial: false,
    };
    showProductModal = true;
  }

  // Open product form (Edit)
  function openEditProduct(product: any) {
    modalMode = 'edit';
    currentProduct = { ...product };
    showProductModal = true;
  }

  async function saveProduct() {
    if (!currentProduct.name || currentProduct.price === '' || currentProduct.cost === '') {
      alert('Por favor completa todos los campos requeridos.');
      return;
    }

    try {
      const isEdit = modalMode === 'edit';
      const url = isEdit ? `/api/products/${currentProduct.id}` : '/api/products';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentProduct),
      });

      if (res.ok) {
        showProductModal = false;
        triggerRefresh();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al guardar el producto');
      }
    } catch (e) {
      alert('Error de conexión al guardar el producto');
    }
  }

  async function deleteProduct(productId: string) {
    if (!confirm('¿Estás seguro de que deseas desactivar este producto del catálogo?')) return;

    try {
      const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
      if (res.ok) {
        triggerRefresh();
      } else {
        alert('Error al desactivar el producto');
      }
    } catch (e) {
      alert('Error al conectar con el servidor');
    }
  }
</script>

<div class="inventory-container flex-column animate-fade-in">
  <!-- Navigation Header -->
  <div class="inventory-header glass-panel">
    <div class="header-left">
      <h2>Catálogo de Productos 📦</h2>
      <p class="subtitle">Administra los productos de Mercado y Café, define precios y controla el stock.</p>
    </div>

    <div class="header-actions">
      <button class="btn btn-general" onclick={openAddProduct}>
        ➕ Nuevo Producto
      </button>
    </div>
  </div>

  <!-- CATALOG WORKSPACE -->
  <div class="catalog-filters glass-panel animate-fade-in">
    <input type="text" placeholder="Buscar por SKU o Nombre..." bind:value={searchQuery} class="filter-input" />
    
    <select bind:value={filterCategory} class="filter-select">
      <option value="">Todas las Categorías</option>
      {#each $categories as cat}
        <option value={cat.id}>{cat.name}</option>
      {/each}
    </select>

    <select bind:value={filterDept} class="filter-select">
      <option value="">Todos los Departamentos</option>
      <option value="MARKET">🍏 Mercado Saludable</option>
      <option value="CAFE">☕ Café</option>
    </select>
  </div>

  <div class="table-card glass-panel flex-1 scroll-y animate-scale-up">
    <table class="pos-table">
      <thead>
        <tr>
          <th>SKU / Código</th>
          <th>Nombre</th>
          <th>Categoría</th>
          <th>Departamento</th>
          <th>Tipo</th>
          <th class="text-right">Costo</th>
          <th class="text-right">Precio Público</th>
          <th class="text-center">Stock</th>
          <th class="text-center">Acciones</th>
        </tr>
      </thead>
      <tbody>
        {#each filteredProducts as p}
          <tr>
            <td><code>{p.sku}</code></td>
            <td>
              <strong class="product-name-txt">{p.name}</strong>
              {#if p.description}
                <span class="product-desc-txt">{p.description}</span>
              {/if}
            </td>
            <td>{p.category.name}</td>
            <td>
              <span class="badge" class:badge-market={p.department === 'MARKET'} class:badge-cafe={p.department === 'CAFE'}>
                {p.department === 'MARKET' ? 'Mercado' : 'Café'}
              </span>
            </td>
            <td>
              {#if p.isRawMaterial}
                <span class="text-general">Insumo / M. Prima</span>
              {:else}
                <span class="text-secondary">Venta Directa</span>
              {/if}
            </td>
            <td class="text-right">${p.cost.toLocaleString()}</td>
            <td class="text-right">${p.price.toLocaleString()}</td>
            <td class="text-center">
              <span class="stock-badge" class:low-stock={p.stock <= 3 && !(p.department === 'CAFE' && p.stock >= 900)}>
                {p.department === 'CAFE' && p.stock >= 900 ? 'Ilimitado' : p.stock}
              </span>
            </td>
            <td class="text-center actions-cell">
              <button class="action-edit-btn" onclick={() => openEditProduct(p)} title="Editar">✏️</button>
              <button class="action-delete-btn" onclick={() => deleteProduct(p.id)} title="Eliminar">🗑️</button>
            </td>
          </tr>
        {:else}
          <tr>
            <td colspan="9" class="text-center text-muted italic">No hay productos que coincidan con la búsqueda.</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<!-- ==========================================
     PRODUCT ADD/EDIT MODAL
     ========================================== -->
{#if showProductModal}
  <div class="modal-overlay flex-center animate-fade-in">
    <div class="modal-container glass-panel animate-scale-up">
      <div class="modal-header">
        <h2>{modalMode === 'add' ? 'Registrar Nuevo Producto' : 'Editar Producto'}</h2>
        <button class="close-modal-btn" onclick={() => showProductModal = false}>✕</button>
      </div>

      <div class="product-form-body">
        <div class="form-row">
          <div class="form-group flex-1">
            <label for="p-sku">Código / SKU (Opcional)</label>
            <input type="text" id="p-sku" bind:value={currentProduct.sku} placeholder="Autogenerado si se deja vacío" disabled={modalMode === 'edit'} />
          </div>
          <div class="form-group flex-1">
            <label for="p-name">Nombre Comercial *</label>
            <input type="text" id="p-name" bind:value={currentProduct.name} placeholder="Nombre del producto" />
          </div>
        </div>

        <div class="form-group">
          <label for="p-desc">Descripción (Opcional)</label>
          <textarea id="p-desc" bind:value={currentProduct.description} placeholder="Notas o detalles adicionales..." rows="2"></textarea>
        </div>

        <div class="form-row">
          <div class="form-group flex-1">
            <label for="p-price">Precio de Venta *</label>
            <input type="number" id="p-price" bind:value={currentProduct.price} placeholder="Ej: 95000" min="0" step="any" />
          </div>
          <div class="form-group flex-1">
            <label for="p-cost">Costo de Compra *</label>
            <input type="number" id="p-cost" bind:value={currentProduct.cost} placeholder="Ej: 60000" min="0" step="any" />
          </div>
          <div class="form-group flex-1">
            <label for="p-stock">Stock Inicial</label>
            <input type="number" id="p-stock" bind:value={currentProduct.stock} placeholder="0" min="0" disabled={modalMode === 'edit'} />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group flex-1">
            <label for="p-category">Categoría *</label>
            <select id="p-category" bind:value={currentProduct.categoryId}>
              {#each $categories as cat}
                <option value={cat.id}>{cat.name}</option>
              {/each}
            </select>
          </div>
          <div class="form-group flex-1">
            <label for="p-dept">Departamento *</label>
            <select id="p-dept" bind:value={currentProduct.department}>
              <option value="MARKET">🍏 Mercado Saludable</option>
              <option value="CAFE">☕ Café</option>
            </select>
          </div>
        </div>

        <div class="form-group checkbox-group">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={currentProduct.isRawMaterial} />
            <span>¿Es materia prima / insumo interno? (Se usa para traslados y recetas en café)</span>
          </label>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" onclick={() => showProductModal = false}>Cancelar</button>
        <button class="btn btn-general" onclick={saveProduct}>Guardar Producto</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .inventory-container {
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

  .inventory-header {
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

  .header-actions {
    display: flex;
    gap: 10px;
  }

  .catalog-filters {
    padding: 12px 16px;
    display: flex;
    gap: 14px;
    align-items: center;
  }

  .filter-input {
    flex: 1;
  }

  .filter-select {
    width: 200px;
  }

  .table-card {
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .product-name-txt {
    display: block;
    font-size: 0.92rem;
    color: var(--text-primary);
  }

  .product-desc-txt {
    display: block;
    font-size: 0.76rem;
    color: var(--text-secondary);
    margin-top: 2px;
  }

  .text-right {
    text-align: right;
  }
  .text-center {
    text-align: center;
  }

  .badge {
    font-size: 0.72rem;
    padding: 3px 8px;
    border-radius: 4px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .badge-market {
    background: var(--color-market-glow);
    color: var(--color-market);
  }

  .badge-cafe {
    background: var(--color-cafe-glow);
    color: var(--color-cafe);
  }

  .stock-badge {
    background: rgba(16, 185, 129, 0.05);
    border: 1px solid var(--border-glass);
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .stock-badge.low-stock {
    background: var(--color-danger-glow);
    border-color: rgba(225, 29, 72, 0.2);
    color: var(--color-danger);
  }

  .actions-cell {
    display: flex;
    justify-content: center;
    gap: 8px;
    border-bottom: none !important;
  }

  .action-edit-btn, .action-delete-btn {
    background: rgba(255, 255, 255, 0.8);
    border: 1px solid var(--border-glass);
    border-radius: 6px;
    padding: 6px;
    cursor: pointer;
    transition: var(--transition-fast);
    outline: none;
    font-size: 0.85rem;
  }

  .action-edit-btn:hover {
    background: #ffffff;
    border-color: var(--color-general);
  }

  .action-delete-btn:hover {
    background: var(--color-danger-glow);
    border-color: var(--color-danger);
  }

  /* Modal forms */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(3, 7, 18, 0.4);
    backdrop-filter: blur(8px);
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

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
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
    outline: none;
  }

  .product-form-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
    padding-right: 4px;
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

  textarea {
    resize: none;
  }

  .checkbox-group {
    margin-top: 6px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    font-size: 0.88rem !important;
    color: var(--text-primary) !important;
  }

  .checkbox-label input {
    cursor: pointer;
    width: 18px;
    height: 18px;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }
</style>
