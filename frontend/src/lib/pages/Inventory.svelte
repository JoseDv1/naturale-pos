<script lang="ts">
  import { user, products, categories, refreshTrigger, triggerRefresh } from '../store';
  import { getProducts, getCategories, createProduct, updateProduct, deleteProduct as apiDeleteProduct, createCategory, updateCategory, deleteCategory as apiDeleteCategory, uploadProductImage, updateProductStock } from '../api/products';
  import ProductRow from '../components/organisms/ProductRow.svelte';
  import Spinner from '../components/atoms/Spinner.svelte';
  import BarcodeScannerModal from '../components/molecules/BarcodeScannerModal.svelte';
  import { playScanSuccess } from '../services/sound';

  // Sub-tab Navigation
  let currentSubTab = $state('products'); // 'products' | 'categories'

  // Search and Filters
  let searchQuery = $state('');
  let filterCategory = $state('');
  let filterDept = $state('');
  let showFilterScanner = $state(false);

  // Add / Edit Product Modal State
  let showProductModal = $state(false);
  let modalMode = $state('add'); // 'add' | 'edit'
  let currentProduct = $state<any>({});
  let showProductSkuScanner = $state(false);
  let activeVariantSkuIndex = $state<number | null>(null);
  let showVariantSkuScanner = $state(false);

  // Quick Stock Modal State
  let showQuickStockModal = $state(false);
  let quickStockProduct = $state<any>(null);
  let quickStockValue = $state<number>(0);
  let quickStockVariants = $state<Array<{ id: string; name: string; sku?: string; stock: number }>>([]);
  let isSavingQuickStock = $state(false);

  // Image Upload State
  let isUploadingImage = $state(false);
  let imageUploadError = $state('');
  let fileInputRef = $state<HTMLInputElement | null>(null);

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
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.variants && p.variants.some((v: any) =>
        v.name.toLowerCase().includes(q) ||
        (v.sku && v.sku.toLowerCase().includes(q))
      ));
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
    imageUploadError = '';
    currentProduct = {
      sku: '',
      name: '',
      description: '',
      imageUrl: null,
      price: '',
      cost: '',
      stock: 0,
      categoryId: $categories[0]?.id || '',
      department: 'MARKET',
      isRawMaterial: false,
      hasVariants: false,
      variants: [],
    };
    showProductModal = true;
  }

  // Open product form (Edit)
  function openEditProduct(product: any) {
    modalMode = 'edit';
    imageUploadError = '';
    currentProduct = { 
      ...product,
      imageUrl: product.imageUrl || null,
      hasVariants: Boolean(product.variants && product.variants.length > 0),
      variants: (product.variants || []).map((v: any) => ({
        id: v.id,
        name: v.name,
        sku: v.sku || '',
        price: Number(v.price),
        cost: Number(v.cost ?? 0),
        stock: Number(v.stock ?? 0),
      })),
    };
    showProductModal = true;
  }

  function addVariantRow(name = '', price: any = '', cost: any = '', stock = 0, sku = '') {
    if (!currentProduct.variants) {
      currentProduct.variants = [];
    }
    currentProduct.variants.push({
      id: undefined,
      name,
      sku,
      price: price !== '' ? price : (currentProduct.price || ''),
      cost: cost !== '' ? cost : (currentProduct.cost || ''),
      stock: stock || 0,
    });
  }

  function removeVariantRow(index: number) {
    if (currentProduct.variants) {
      currentProduct.variants.splice(index, 1);
    }
  }

  function applyPreset(presetType: 'sizes' | 'flavors' | 'milks') {
    currentProduct.hasVariants = true;
    if (!currentProduct.variants) currentProduct.variants = [];

    const basePrice = currentProduct.price !== '' ? Number(currentProduct.price) : 5000;
    const baseCost = currentProduct.cost !== '' ? Number(currentProduct.cost) : 2000;

    if (presetType === 'sizes') {
      addVariantRow('Pequeño (8oz)', basePrice, baseCost, 10);
      addVariantRow('Mediano (12oz)', basePrice + 2000, baseCost + 800, 10);
      addVariantRow('Grande (16oz)', basePrice + 4000, baseCost + 1500, 10);
    } else if (presetType === 'flavors') {
      addVariantRow('Vainilla', basePrice, baseCost, 10);
      addVariantRow('Chocolate', basePrice, baseCost, 10);
      addVariantRow('Fresa', basePrice, baseCost, 10);
    } else if (presetType === 'milks') {
      addVariantRow('Leche Entera', basePrice, baseCost, 10);
      addVariantRow('Leche Deslactosada', basePrice, baseCost, 10);
      addVariantRow('Leche de Almendras', basePrice + 1500, baseCost + 700, 10);
      addVariantRow('Leche de Avena', basePrice + 1500, baseCost + 700, 10);
    }
  }

  async function handleImageFileSelect(e: Event) {
    const target = e.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;
    const file = target.files[0];
    isUploadingImage = true;
    imageUploadError = '';
    try {
      const res = await uploadProductImage(file);
      currentProduct.imageUrl = res.url;
    } catch (err: any) {
      imageUploadError = err.message || 'Error al subir la imagen';
    } finally {
      isUploadingImage = false;
      target.value = '';
    }
  }

  function handleRemoveImage() {
    currentProduct.imageUrl = null;
    imageUploadError = '';
  }

  async function saveProduct() {
    if (!currentProduct.name || currentProduct.name.trim() === '') {
      alert('Por favor escribe el nombre del producto.');
      return;
    }

    if (currentProduct.hasVariants) {
      if (!currentProduct.variants || currentProduct.variants.length === 0) {
        alert('Has marcado que este producto tiene variantes. Añade al menos una variante o desmarca la casilla.');
        return;
      }
      for (let i = 0; i < currentProduct.variants.length; i++) {
        const v = currentProduct.variants[i];
        if (!v.name || v.name.trim() === '') {
          alert(`La variante #${i + 1} debe tener un nombre (ej. Pequeño, Vainilla).`);
          return;
        }
        if (v.price === '' || isNaN(Number(v.price)) || Number(v.price) < 0) {
          alert(`La variante "${v.name}" debe tener un precio válido mayor o igual a cero.`);
          return;
        }
      }

      // Automatically sync base price, cost, and stock
      if (currentProduct.price === '' || isNaN(Number(currentProduct.price))) {
        currentProduct.price = currentProduct.variants[0].price;
      }
      if (currentProduct.cost === '' || isNaN(Number(currentProduct.cost))) {
        currentProduct.cost = currentProduct.variants[0].cost || 0;
      }
      currentProduct.stock = currentProduct.variants.reduce((acc: number, v: any) => acc + (Number(v.stock) || 0), 0);
    } else {
      if (currentProduct.price === '' || currentProduct.cost === '') {
        alert('Por favor completa los campos de precio y costo requeridos.');
        return;
      }
      currentProduct.stock = Math.max(0, parseInt(currentProduct.stock) || 0);
    }

    try {
      const isEdit = modalMode === 'edit';
      const payload = {
        ...currentProduct,
        variants: currentProduct.hasVariants ? currentProduct.variants : [],
      };

      if (isEdit) {
        await updateProduct(currentProduct.id, payload);
      } else {
        await createProduct(payload);
      }
      showProductModal = false;
      triggerRefresh();
    } catch (e: any) {
      alert(e.message || 'Error al guardar el producto');
    }
  }

  function openQuickStockModal(product: any) {
    quickStockProduct = product;
    const activeVariants = (product.variants || []).filter((v: any) => v.active !== false);
    if (activeVariants.length > 0) {
      quickStockVariants = activeVariants.map((v: any) => ({
        id: v.id,
        name: v.name,
        sku: v.sku || '',
        stock: Number(v.stock ?? 0),
      }));
      quickStockValue = quickStockVariants.reduce((sum, v) => sum + v.stock, 0);
    } else {
      quickStockVariants = [];
      quickStockValue = Number(product.stock ?? 0);
    }
    showQuickStockModal = true;
  }

  async function saveQuickStock() {
    if (!quickStockProduct) return;
    isSavingQuickStock = true;
    try {
      if (quickStockVariants.length > 0) {
        await updateProductStock(quickStockProduct.id, {
          variants: quickStockVariants.map(v => ({ id: v.id, stock: Math.max(0, parseInt(String(v.stock), 10) || 0) }))
        });
      } else {
        await updateProductStock(quickStockProduct.id, {
          stock: Math.max(0, parseInt(String(quickStockValue), 10) || 0)
        });
      }
      showQuickStockModal = false;
      triggerRefresh();
    } catch (e: any) {
      alert(e.message || 'Error al actualizar el stock');
    } finally {
      isSavingQuickStock = false;
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
        {#if $user?.role === 'ADMIN'}
          <button class="btn btn-general" onclick={openAddProduct}>
            ➕ Registrar Producto
          </button>
        {/if}
      {:else}
        {#if $user?.role === 'ADMIN'}
          <button class="btn btn-general" onclick={openAddCategory}>
            ➕ Registrar Categoría
          </button>
        {/if}
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
        <div class="filter-search-box">
          <input type="text" placeholder="Buscar por SKU o Nombre..." bind:value={searchQuery} class="filter-input" />
          <button
            class="btn-filter-scan"
            onclick={() => showFilterScanner = true}
            type="button"
            title="Escanear código de barras para filtrar"
            aria-label="Escanear código de barras para filtrar"
          >
            📷
          </button>
        </div>
        
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
              <ProductRow
                product={p}
                onedit={$user?.role === 'ADMIN' ? openEditProduct : undefined}
                ondelete={$user?.role === 'ADMIN' ? deleteProduct : undefined}
                onquickstock={$user?.role === 'ADMIN' ? openQuickStockModal : undefined}
              />
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
        <button class="close-modal-btn" onclick={() => showProductModal = false} aria-label="Cerrar modal">✕</button>
      </div>

      <div class="product-form-body">
        <div class="form-row">
          <div class="form-group flex-1">
            <label for="p-sku">Código / SKU (Opcional)</label>
            <div class="input-with-action">
              <input type="text" id="p-sku" bind:value={currentProduct.sku} placeholder="Autogenerado si se deja vacío" disabled={modalMode === 'edit'} />
              {#if modalMode === 'add'}
                <button
                  class="btn-inline-scan"
                  onclick={() => showProductSkuScanner = true}
                  type="button"
                  title="Escanear código de barras con la cámara"
                  aria-label="Escanear código de barras con la cámara"
                >
                  📷
                </button>
              {/if}
            </div>
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

        <!-- Product Image Section -->
        <div class="form-group image-upload-group">
          <label for="product-image-input">Fotografía del Producto (Opcional)</label>
          <div class="image-uploader-card">
            {#if currentProduct.imageUrl}
              <div class="image-preview-wrapper">
                <img src={currentProduct.imageUrl} alt="Vista previa del producto" class="image-preview" />
                <div class="image-preview-actions">
                  <button
                    type="button"
                    class="btn btn-secondary btn-sm"
                    onclick={() => fileInputRef?.click()}
                    disabled={isUploadingImage}
                  >
                    🔄 Cambiar Foto
                  </button>
                  <button
                    type="button"
                    class="btn btn-danger btn-sm"
                    onclick={handleRemoveImage}
                    disabled={isUploadingImage}
                  >
                    🗑️ Quitar Foto
                  </button>
                </div>
              </div>
            {:else}
              <div
                class="upload-dropzone"
                onclick={() => fileInputRef?.click()}
                role="button"
                tabindex="0"
                aria-label="Seleccionar o tomar fotografía del producto"
                onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef?.click(); }}
              >
                {#if isUploadingImage}
                  <Spinner size="26px" />
                  <span class="upload-text">Subiendo imagen...</span>
                {:else}
                  <span class="upload-icon">📷</span>
                  <span class="upload-title">Seleccionar o tomar fotografía</span>
                  <span class="upload-subtitle">Formatos: PNG, JPG, WebP hasta 5MB</span>
                {/if}
              </div>
            {/if}

            <input
              id="product-image-input"
              type="file"
              accept="image/*"
              bind:this={fileInputRef}
              onchange={handleImageFileSelect}
              style="display: none;"
            />

            {#if imageUploadError}
              <p class="upload-error-msg">{imageUploadError}</p>
            {/if}
          </div>
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
            <label for="p-stock">
              {currentProduct.hasVariants ? 'Stock Total (Variantes)' : (modalMode === 'edit' ? 'Cantidad en Stock *' : 'Stock Inicial *')}
            </label>
            <input
              type="number"
              id="p-stock"
              bind:value={currentProduct.stock}
              placeholder="0"
              min="0"
              disabled={currentProduct.hasVariants}
            />
            {#if currentProduct.hasVariants}
              <span class="stock-helper-text">Calculado sumando las variantes abajo</span>
            {/if}
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

        <!-- Product Variants Section -->
        <div class="variants-config-card">
          <div class="variants-toggle-header">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={currentProduct.hasVariants} />
              <strong class="toggle-title">¿Este producto tiene variantes? (ej. tamaños, sabores)</strong>
            </label>
            <span class="variants-help-hint">Crea opciones con diferentes tamaños (8oz, 12oz, 16oz), sabores o presentaciones con precios y stock propios.</span>
          </div>

          {#if currentProduct.hasVariants}
            <div class="variants-workspace animate-fade-in">
              <div class="presets-toolbar">
                <span class="presets-label">Plantillas rápidas:</span>
                <button type="button" class="btn-preset" onclick={() => applyPreset('sizes')}>☕ Tamaños</button>
                <button type="button" class="btn-preset" onclick={() => applyPreset('flavors')}>🍓 Sabores</button>
                <button type="button" class="btn-preset" onclick={() => applyPreset('milks')}>🥛 Tipos de Leche</button>
              </div>

              {#if currentProduct.variants && currentProduct.variants.length > 0}
                <div class="variants-table-wrapper">
                  <table class="variants-edit-table">
                    <thead>
                      <tr>
                        <th>Nombre de Variante *</th>
                        <th>Código / SKU</th>
                        <th>Precio Venta ($) *</th>
                        <th>Costo Compra ($)</th>
                        <th>Stock</th>
                        <th class="text-center"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each currentProduct.variants as variant, idx}
                        <tr>
                          <td>
                            <input
                              type="text"
                              bind:value={variant.name}
                              placeholder="Ej: Pequeño, Vainilla..."
                              required
                              class="var-input-name"
                            />
                          </td>
                          <td>
                            <div class="var-sku-field">
                              <input
                                type="text"
                                bind:value={variant.sku}
                                placeholder="Autogenerado o escanear"
                                class="var-input-sku"
                              />
                              <button
                                type="button"
                                class="btn-var-scan"
                                onclick={() => {
                                  activeVariantSkuIndex = idx;
                                  showVariantSkuScanner = true;
                                }}
                                title="Escanear código de barras para esta variante"
                              >
                                📷
                              </button>
                            </div>
                          </td>
                          <td>
                            <input
                              type="number"
                              bind:value={variant.price}
                              placeholder="0"
                              min="0"
                              step="any"
                              required
                              class="var-input-num"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              bind:value={variant.cost}
                              placeholder="0"
                              min="0"
                              step="any"
                              class="var-input-num"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              bind:value={variant.stock}
                              placeholder="0"
                              min="0"
                              class="var-input-num"
                            />
                          </td>
                          <td class="text-center">
                            <button
                              type="button"
                              class="btn-var-remove"
                              onclick={() => removeVariantRow(idx)}
                              title="Eliminar variante"
                              aria-label="Eliminar variante"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {:else}
                <div class="no-variants-prompt flex-center">
                  <span>No has añadido variantes aún. Usa una plantilla arriba o haz clic en "Agregar Variante".</span>
                </div>
              {/if}

              <div class="variants-actions-bar">
                <button type="button" class="btn btn-secondary btn-sm" onclick={() => addVariantRow()}>
                  ➕ Agregar Variante
                </button>
              </div>
            </div>
          {/if}
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
     QUICK STOCK ADJUSTMENT MODAL
     ========================================== -->
{#if showQuickStockModal && quickStockProduct}
  <div class="modal-overlay flex-center animate-fade-in">
    <div class="modal-container glass-panel animate-scale-up" style="max-width: 480px;">
      <div class="modal-header">
        <div>
          <h2>Ajustar Stock de Producto 📦</h2>
          <p class="quick-stock-subtitle">{quickStockProduct.name} &bull; <code>{quickStockProduct.sku}</code></p>
        </div>
        <button class="close-modal-btn" onclick={() => showQuickStockModal = false} aria-label="Cerrar modal">✕</button>
      </div>

      <div class="product-form-body">
        {#if quickStockVariants.length > 0}
          <div class="quick-stock-variants-box">
            <p class="quick-stock-info-note">
              Este producto tiene <strong>{quickStockVariants.length} variantes</strong>. Edita el stock para cada una y el total se sincronizará automáticamente:
            </p>
            <div class="quick-stock-variants-list">
              {#each quickStockVariants as v}
                <div class="quick-variant-item">
                  <div class="quick-variant-info">
                    <strong class="quick-variant-name">{v.name}</strong>
                    {#if v.sku}<span class="quick-variant-sku"><code>{v.sku}</code></span>{/if}
                  </div>
                  <div class="quick-stepper">
                    <button type="button" class="btn-step" onclick={() => { v.stock = Math.max(0, (Number(v.stock) || 0) - 1); }} aria-label="Disminuir stock">-</button>
                    <input type="number" class="step-input" bind:value={v.stock} min="0" aria-label="Stock de variante {v.name}" />
                    <button type="button" class="btn-step" onclick={() => { v.stock = (Number(v.stock) || 0) + 1; }} aria-label="Aumentar stock">+</button>
                  </div>
                </div>
              {/each}
            </div>
            <div class="quick-variants-total-bar">
              <span>Stock total sumado:</span>
              <strong>{quickStockVariants.reduce((s, v) => s + (Number(v.stock) || 0), 0)} unidades</strong>
            </div>
          </div>
        {:else}
          <div class="quick-stock-simple-box">
            <label for="quick-stock-input" class="quick-stock-label">Cantidad actual en inventario:</label>
            <div class="quick-stock-input-row">
              <div class="quick-stepper large">
                <button type="button" class="btn-step large" onclick={() => { quickStockValue = Math.max(0, (Number(quickStockValue) || 0) - 1); }} aria-label="Disminuir en 1">-1</button>
                <input id="quick-stock-input" type="number" class="step-input large" bind:value={quickStockValue} min="0" />
                <button type="button" class="btn-step large" onclick={() => { quickStockValue = (Number(quickStockValue) || 0) + 1; }} aria-label="Aumentar en 1">+1</button>
              </div>
            </div>
            <div class="quick-add-chips">
              <span class="chips-label">Ajuste rápido:</span>
              <button type="button" class="btn-chip" onclick={() => { quickStockValue = (Number(quickStockValue) || 0) + 5; }}>+5</button>
              <button type="button" class="btn-chip" onclick={() => { quickStockValue = (Number(quickStockValue) || 0) + 10; }}>+10</button>
              <button type="button" class="btn-chip" onclick={() => { quickStockValue = (Number(quickStockValue) || 0) + 25; }}>+25</button>
              <button type="button" class="btn-chip" onclick={() => { quickStockValue = Math.max(0, (Number(quickStockValue) || 0) - 5); }}>-5</button>
              <button type="button" class="btn-chip chip-zero" onclick={() => { quickStockValue = 0; }}>0</button>
            </div>
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" onclick={() => showQuickStockModal = false} disabled={isSavingQuickStock}>Cancelar</button>
        <button class="btn btn-general" onclick={saveQuickStock} disabled={isSavingQuickStock}>
          {#if isSavingQuickStock}
            <Spinner size="18px" /> Guardando...
          {:else}
            💾 Actualizar Stock
          {/if}
        </button>
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
        <button class="close-modal-btn" onclick={() => showCategoryModal = false} aria-label="Cerrar modal">✕</button>
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

<!-- Scanner Modal for Product SKU Input -->
{#if showProductSkuScanner}
  <BarcodeScannerModal
    title="Escanear Código / SKU del Producto"
    mode="single"
    onscan={(code) => {
      currentProduct.sku = code;
      playScanSuccess();
      showProductSkuScanner = false;
    }}
    onclose={() => showProductSkuScanner = false}
  />
{/if}

<!-- Scanner Modal for Inventory Filter -->
{#if showFilterScanner}
  <BarcodeScannerModal
    title="Escanear para Buscar en Inventario"
    mode="single"
    onscan={(code) => {
      searchQuery = code;
      playScanSuccess();
      showFilterScanner = false;
    }}
    onclose={() => showFilterScanner = false}
  />
{/if}

<!-- Scanner Modal for Variant SKU -->
{#if showVariantSkuScanner && activeVariantSkuIndex !== null && currentProduct.variants?.[activeVariantSkuIndex]}
  <BarcodeScannerModal
    title={`Escanear Código para ${currentProduct.variants[activeVariantSkuIndex].name || 'Variante'}`}
    mode="single"
    onscan={(code) => {
      if (activeVariantSkuIndex !== null && currentProduct.variants?.[activeVariantSkuIndex]) {
        currentProduct.variants[activeVariantSkuIndex].sku = code;
      }
      playScanSuccess();
      showVariantSkuScanner = false;
      activeVariantSkuIndex = null;
    }}
    onclose={() => {
      showVariantSkuScanner = false;
      activeVariantSkuIndex = null;
    }}
  />
{/if}

<style>
  .flex-column {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    gap: 16px;
    padding: 6px;
    min-height: 0;
    overflow: hidden;
  }

  .flex-1 {
    flex: 1;
    min-height: 0;
  }

  .inventory-header {
    padding: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  }

  .header-left h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 4px;
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
    flex-shrink: 0;
  }

  .filter-search-box {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
  }

  .filter-input {
    width: 100%;
    padding-right: 36px;
  }

  .btn-filter-scan {
    position: absolute;
    right: 8px;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 1.05rem;
    padding: 4px;
    border-radius: 4px;
    color: var(--text-secondary);
  }
  .btn-filter-scan:hover {
    color: var(--text-primary);
  }

  .filter-select {
    width: 200px;
  }

  .input-with-action {
    display: flex;
    position: relative;
    align-items: center;
    width: 100%;
  }

  .input-with-action input {
    width: 100%;
    padding-right: 36px;
  }

  .btn-inline-scan {
    position: absolute;
    right: 8px;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 1.05rem;
    padding: 4px;
    border-radius: 4px;
    color: var(--text-secondary);
  }
  .btn-inline-scan:hover {
    color: var(--text-primary);
  }

  .table-card {
    border-radius: var(--radius-sm);
    overflow: auto;
    min-height: 0;
    flex: 1;
  }

  .table-card table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
  }

  .table-card :global(.pos-table thead th) {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--bg-glass);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--border-glass);
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
    max-width: 680px;
    max-height: 90vh;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow: hidden;
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
    flex: 1;
    min-height: 0;
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

  /* Image Uploader & Preview Styles */
  .image-uploader-card {
    background: rgba(0, 0, 0, 0.2);
    border: 1px dashed var(--border-glass);
    border-radius: var(--radius-md, 10px);
    padding: 14px;
    transition: var(--transition-fast);
  }

  .image-uploader-card:hover {
    border-color: var(--color-general);
  }

  .upload-dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px 16px;
    cursor: pointer;
    border-radius: var(--radius-sm, 8px);
    transition: background var(--transition-fast);
    outline: none;
    text-align: center;
  }

  .upload-dropzone:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .upload-icon {
    font-size: 2rem;
    margin-bottom: 6px;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
  }

  .upload-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 2px;
  }

  .upload-subtitle {
    font-size: 0.78rem;
    color: var(--text-muted);
  }

  .upload-text {
    font-size: 0.88rem;
    color: var(--text-secondary);
    margin-top: 8px;
  }

  .image-preview-wrapper {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .image-preview {
    width: 90px;
    height: 90px;
    border-radius: var(--radius-sm, 8px);
    object-fit: cover;
    border: 1px solid var(--border-glass);
    background: rgba(0, 0, 0, 0.3);
  }

  .image-preview-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .btn-sm {
    padding: 6px 12px;
    font-size: 0.82rem;
  }

  .upload-error-msg {
    color: var(--color-danger);
    font-size: 0.8rem;
    margin-top: 8px;
  }

  /* Variants Configuration Section */
  .variants-config-card {
    background: rgba(0, 0, 0, 0.02);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .variants-toggle-header {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .toggle-title {
    font-size: 0.92rem;
    color: var(--text-primary);
  }

  .variants-help-hint {
    font-size: 0.78rem;
    color: var(--text-secondary);
    padding-left: 28px;
  }

  .variants-workspace {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 4px;
    padding-top: 10px;
    border-top: 1px dashed var(--border-glass);
  }

  .presets-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .presets-label {
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .btn-preset {
    background: rgba(255, 255, 255, 0.8);
    border: 1px solid var(--border-glass);
    border-radius: 4px;
    padding: 4px 10px;
    font-size: 0.8rem;
    cursor: pointer;
    color: var(--text-primary);
    transition: var(--transition-fast);
  }

  .btn-preset:hover {
    background: #ffffff;
    border-color: var(--color-general);
    transform: translateY(-1px);
  }

  .variants-table-wrapper {
    overflow-x: auto;
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    background: rgba(255, 255, 255, 0.4);
  }

  .variants-edit-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  .variants-edit-table th {
    padding: 8px 10px;
    background: rgba(0, 0, 0, 0.03);
    color: var(--text-secondary);
    font-weight: 500;
    border-bottom: 1px solid var(--border-glass);
    text-align: left;
    white-space: nowrap;
  }

  .variants-edit-table td {
    padding: 8px 10px;
    border-bottom: 1px solid rgba(16, 185, 129, 0.08);
  }

  .variants-edit-table tr:last-child td {
    border-bottom: none;
  }

  .var-input-name {
    min-width: 130px;
  }

  .var-sku-field {
    display: flex;
    align-items: center;
    position: relative;
    min-width: 120px;
  }

  .var-input-sku {
    padding-right: 28px !important;
  }

  .btn-var-scan {
    position: absolute;
    right: 4px;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 0.9rem;
    color: var(--text-secondary);
    padding: 2px;
  }

  .btn-var-scan:hover {
    color: var(--text-primary);
  }

  .var-input-num {
    width: 85px !important;
    min-width: 85px;
    text-align: right;
  }

  .btn-var-remove {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    padding: 4px;
    border-radius: 4px;
    transition: var(--transition-fast);
  }

  .btn-var-remove:hover {
    background: rgba(244, 63, 94, 0.15);
  }

  .no-variants-prompt {
    padding: 16px;
    font-size: 0.85rem;
    color: var(--text-muted);
    font-style: italic;
    text-align: center;
  }

  .variants-actions-bar {
    display: flex;
    justify-content: flex-start;
  }

  /* Quick Stock Modal Styles */
  .quick-stock-subtitle {
    font-size: 0.82rem;
    color: var(--text-muted);
    margin-top: 2px;
    display: block;
  }

  .quick-stock-info-note {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-bottom: 12px;
    line-height: 1.4;
  }

  .quick-stock-variants-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 280px;
    overflow-y: auto;
    padding-right: 4px;
  }

  .quick-variant-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-radius: var(--radius-sm, 6px);
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-glass);
    gap: 12px;
  }

  .quick-variant-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .quick-variant-name {
    font-size: 0.9rem;
    color: var(--text-primary);
  }

  .quick-variant-sku {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .quick-variants-total-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    margin-top: 10px;
    border-radius: var(--radius-sm, 6px);
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.2);
    font-size: 0.9rem;
    color: var(--color-general);
  }

  .quick-stock-simple-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px 8px;
    gap: 16px;
  }

  .quick-stock-label {
    font-size: 0.92rem;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .quick-stock-input-row {
    display: flex;
    justify-content: center;
    width: 100%;
  }

  .quick-stepper {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm, 6px);
    overflow: hidden;
    background: rgba(0, 0, 0, 0.2);
  }

  .quick-stepper.large {
    border-radius: var(--radius-md, 8px);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .btn-step {
    background: rgba(255, 255, 255, 0.06);
    border: none;
    color: var(--text-primary);
    padding: 6px 12px;
    cursor: pointer;
    font-size: 1.05rem;
    font-weight: 700;
    transition: var(--transition-fast);
    outline: none;
  }

  .btn-step.large {
    padding: 10px 18px;
    font-size: 1.15rem;
  }

  .btn-step:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .step-input {
    width: 65px;
    border: none;
    background: transparent;
    text-align: center;
    color: var(--text-primary);
    font-size: 0.95rem;
    font-weight: 600;
    padding: 6px 4px;
    outline: none;
  }

  .step-input.large {
    width: 90px;
    font-size: 1.3rem;
    padding: 10px 4px;
    font-weight: 700;
    color: var(--color-general);
  }

  .quick-add-chips {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .chips-label {
    font-size: 0.78rem;
    color: var(--text-muted);
  }

  .btn-chip {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--border-glass);
    color: var(--text-secondary);
    border-radius: 16px;
    padding: 4px 10px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .btn-chip:hover {
    background: var(--color-general-glow);
    border-color: var(--color-general);
    color: var(--color-general);
  }

  .btn-chip.chip-zero:hover {
    background: rgba(244, 63, 94, 0.15);
    border-color: var(--color-danger);
    color: var(--color-danger);
  }

  .stock-helper-text {
    display: block;
    font-size: 0.72rem;
    color: var(--text-muted);
    margin-top: 3px;
  }
</style>
