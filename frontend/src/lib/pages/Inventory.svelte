<script lang="ts">
  import { products, categories, refreshTrigger, triggerRefresh } from '../store';
  import { getProducts, getCategories, createProduct, updateProduct, deleteProduct as apiDeleteProduct, createCategory, updateCategory, deleteCategory as apiDeleteCategory } from '../api/products';
  import ProductRow from '../components/organisms/ProductRow.svelte';
  import Spinner from '../components/atoms/Spinner.svelte';

  // Sub-tab Navigation
  let currentSubTab = $state('products'); // 'products' | 'categories'

  // Search and Filters
  let searchQuery = $state('');
  let filterCategory = $state('');
  let filterDept = $state('');

  // Add / Edit Product Modal State
  let showProductModal = $state(false);
  let modalMode = $state('add'); // 'add' | 'edit'
  let currentProduct = $state<any>({});

  // Add / Edit Category Modal State
  let showCategoryModal = $state(false);
  let categoryModalMode = $state('add'); // 'add' | 'edit'
  let currentCategory = $state<any>({});
  let categorySearchQuery = $state('');

  let inventoryPromise = $state<Promise<any>>(
    Promise.all([getProducts(), getCategories()]).then(([prods, cats]) => {
      products.set(prods);
      categories.set(cats);
    })
  );

  $effect(() => {
    if ($refreshTrigger) {
      loadInventory();
    }
  });

  function loadInventory() {
    inventoryPromise = Promise.all([getProducts(), getCategories()]).then(([prods, cats]) => {
      products.set(prods);
      categories.set(cats);
    });
  }

  // Filtered Products
  let filteredProducts = $derived($products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.includes(searchQuery);
    const matchesCategory = filterCategory ? p.categoryId === filterCategory : true;
    const matchesDept = filterDept ? p.department === filterDept : true;
    return matchesSearch && matchesCategory && matchesDept;
  }));

  // Filtered Categories
  let filteredCategories = $derived($categories.filter((cat) => {
    return cat.name.toLowerCase().includes(categorySearchQuery.toLowerCase()) ||
           (cat.description && cat.description.toLowerCase().includes(categorySearchQuery.toLowerCase()));
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
      if (isEdit) {
        await updateProduct(currentProduct.id, currentProduct);
      } else {
        await createProduct(currentProduct);
      }
      showProductModal = false;
      triggerRefresh();
    } catch (e: any) {
      alert(e.message || 'Error al guardar el producto');
    }
  }

  async function deleteProduct(productId: string) {
    if (!confirm('¿Estás seguro de que deseas desactivar este producto del catálogo?')) return;

    try {
      await apiDeleteProduct(productId);
      triggerRefresh();
    } catch (e: any) {
      alert(e.message || 'Error al desactivar el producto');
    }
  }

  // Open Category form (Add)
  function openAddCategory() {
    categoryModalMode = 'add';
    currentCategory = {
      name: '',
      description: '',
    };
    showCategoryModal = true;
  }

  // Open Category form (Edit)
  function openEditCategory(cat: any) {
    categoryModalMode = 'edit';
    currentCategory = { ...cat };
    showCategoryModal = true;
  }

  async function saveCategory() {
    if (!currentCategory.name) {
      alert('Por favor escribe el nombre de la categoría.');
      return;
    }

    try {
      const isEdit = categoryModalMode === 'edit';
      if (isEdit) {
        await updateCategory(currentCategory.id, currentCategory);
      } else {
        await createCategory(currentCategory);
      }
      showCategoryModal = false;
      triggerRefresh();
    } catch (e: any) {
      alert(e.message || 'Error al guardar la categoría');
    }
  }

  async function deleteCategory(categoryId: string) {
    if (!confirm('¿Estás seguro de que deseas eliminar esta categoría?')) return;

    try {
      await apiDeleteCategory(categoryId);
      triggerRefresh();
    } catch (e: any) {
      alert(e.message || 'Error al eliminar la categoría');
    }
  }
</script>

<div class="inventory-view-container flex-column animate-fade-in">
  <!-- Navigation Header -->
  <div class="inventory-header glass-panel">
    <div class="header-left">
      <h2>Catálogo de Productos e Inventario 📦</h2>
      <div class="sub-tabs" style="margin-top: 8px;">
        <button class="sub-tab" class:active={currentSubTab === 'products'} onclick={() => currentSubTab = 'products'}>
          📦 Productos
        </button>
        <button class="sub-tab" class:active={currentSubTab === 'categories'} onclick={() => currentSubTab = 'categories'}>
          🏷️ Categorías
        </button>
      </div>
    </div>

    <div class="header-actions">
      {#if currentSubTab === 'products'}
        <button class="btn btn-general" onclick={openAddProduct}>
          ➕ Registrar Producto
        </button>
      {:else}
        <button class="btn btn-general" onclick={openAddCategory}>
          ➕ Registrar Categoría
        </button>
      {/if}
      <button class="btn btn-secondary" onclick={loadInventory}>
        🔄 Actualizar
      </button>
    </div>
  </div>

  {#await inventoryPromise}
    <div style="flex: 1; display: flex; align-items: center; justify-content: center; min-height: 400px; width: 100%;">
      <Spinner size="40px" />
    </div>
  {:then}
    {#if currentSubTab === 'products'}
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
              <ProductRow product={p} onedit={openEditProduct} ondelete={deleteProduct} />
            {:else}
              <tr>
                <td colspan="9" class="text-center text-muted italic">No hay productos que coincidan con la búsqueda.</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <!-- CATEGORIES WORKSPACE -->
      <div class="catalog-filters glass-panel animate-fade-in">
        <input type="text" placeholder="Buscar categoría por nombre..." bind:value={categorySearchQuery} class="filter-input" style="max-width: 320px;" />
      </div>

      <div class="table-card glass-panel flex-1 scroll-y animate-scale-up">
        <table class="pos-table">
          <thead>
            <tr>
              <th>Nombre de la Categoría</th>
              <th>Descripción</th>
              <th class="text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredCategories as cat}
              <tr>
                <td><strong>{cat.name}</strong></td>
                <td>{cat.description || '—'}</td>
                <td class="text-center" style="width: 120px;">
                  <div class="row-actions flex-center" style="gap: 8px;">
                    {#if cat.name !== 'Sin categoría'}
                      <button class="btn btn-secondary btn-icon" onclick={() => openEditCategory(cat)} title="Editar">
                        ✏️
                      </button>
                      <button class="btn btn-danger btn-icon" onclick={() => deleteCategory(cat.id)} title="Eliminar">
                        🗑️
                      </button>
                    {:else}
                      <span class="text-muted italic" style="font-size: 0.85rem;">Sistema</span>
                    {/if}
                  </div>
                </td>
              </tr>
            {:else}
              <tr>
                <td colspan="3" class="text-center text-muted italic">No hay categorías registradas.</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {:catch error}
    <div class="error-banner animate-fade-in" style="margin: 20px;">
      Error al cargar catálogo de productos: {error.message}
    </div>
  {/await}
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

<!-- ==========================================
     CATEGORY ADD/EDIT MODAL
     ========================================== -->
{#if showCategoryModal}
  <div class="modal-overlay flex-center animate-fade-in">
    <div class="modal-container glass-panel animate-scale-up" style="max-width: 480px;">
      <div class="modal-header">
        <h2>{categoryModalMode === 'add' ? 'Registrar Nueva Categoría' : 'Editar Categoría'}</h2>
        <button class="close-modal-btn" onclick={() => showCategoryModal = false}>✕</button>
      </div>

      <div class="product-form-body">
        <div class="form-group">
          <label for="c-name">Nombre de la Categoría *</label>
          <input type="text" id="c-name" bind:value={currentCategory.name} placeholder="Ej: Bebidas Frías, Snacks" />
        </div>

        <div class="form-group">
          <label for="c-desc">Descripción (Opcional)</label>
          <textarea id="c-desc" bind:value={currentCategory.description} placeholder="Notas o detalles de esta categoría..." rows="3"></textarea>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" onclick={() => showCategoryModal = false}>Cancelar</button>
        <button class="btn btn-general" onclick={saveCategory}>Guardar Categoría</button>
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

  .product-form-body input:not([type="checkbox"]),
  .product-form-body select,
  .product-form-body textarea {
    width: 100%;
    min-width: 0;
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
</style>
