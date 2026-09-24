<script lang="ts">
  import { untrack } from 'svelte';
  import { getCategories, createCategory, updateCategory, deleteCategory } from '../api/products';
  import { categories, refreshTrigger, triggerRefresh, user } from '../store';
  import Spinner from '../components/atoms/Spinner.svelte';

  interface CategoryItem {
    id: string;
    name: string;
    description?: string | null;
    _count?: {
      products: number;
    };
    createdAt?: string;
    updatedAt?: string;
  }

  let searchQuery = $state('');
  let categoryList = $state<CategoryItem[]>([]);
  let isLoading = $state(true);
  let errorMessage = $state('');

  // Modal State for Add / Edit
  let showModal = $state(false);
  let modalMode = $state<'add' | 'edit'>('add');
  let selectedCategory = $state<CategoryItem | null>(null);
  let formName = $state('');
  let formDescription = $state('');
  let isSaving = $state(false);
  let modalError = $state('');

  // Modal State for Delete Confirmation
  let showDeleteModal = $state(false);
  let categoryToDelete = $state<CategoryItem | null>(null);
  let isDeleting = $state(false);

  // Load categories from API
  async function loadCategories() {
    isLoading = true;
    errorMessage = '';
    try {
      const data = await getCategories();
      categoryList = data;
      categories.set(data);
    } catch (e: any) {
      console.error('Error loading categories:', e);
      errorMessage = e.message || 'Error al cargar las categorías';
    } finally {
      isLoading = false;
    }
  }

  // React to refreshTrigger or mount
  $effect(() => {
    // Read trigger to track reactivity
    const _ = $refreshTrigger;
    untrack(() => {
      loadCategories();
    });
  });

  // Filtered categories based on search query
  let filteredCategories = $derived.by(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return categoryList;
    return categoryList.filter((cat) => {
      const nameMatch = cat.name.toLowerCase().includes(q);
      const descMatch = (cat.description || '').toLowerCase().includes(q);
      return nameMatch || descMatch;
    });
  });

  function openAddModal() {
    modalMode = 'add';
    selectedCategory = null;
    formName = '';
    formDescription = '';
    modalError = '';
    showModal = true;
  }

  function openEditModal(cat: CategoryItem) {
    if (cat.name === 'Sin categoría') return;
    modalMode = 'edit';
    selectedCategory = cat;
    formName = cat.name;
    formDescription = cat.description || '';
    modalError = '';
    showModal = true;
  }

  function openDeleteConfirm(cat: CategoryItem) {
    if (cat.name === 'Sin categoría') return;
    categoryToDelete = cat;
    showDeleteModal = true;
  }

  async function handleSaveCategory(e: SubmitEvent) {
    e.preventDefault();
    const trimmedName = formName.trim();
    if (!trimmedName) {
      modalError = 'El nombre de la categoría es requerido.';
      return;
    }

    if (trimmedName.toLowerCase() === 'sin categoría' && (!selectedCategory || selectedCategory.name !== 'Sin categoría')) {
      modalError = 'El nombre "Sin categoría" está reservado por el sistema.';
      return;
    }

    isSaving = true;
    modalError = '';

    try {
      if (modalMode === 'add') {
        await createCategory({
          name: trimmedName,
          description: formDescription.trim() || undefined,
        });
      } else if (selectedCategory) {
        await updateCategory(selectedCategory.id, {
          name: trimmedName,
          description: formDescription.trim() || undefined,
        });
      }

      showModal = false;
      triggerRefresh();
      await loadCategories();
    } catch (err: any) {
      console.error('Error saving category:', err);
      modalError = err.message || 'Error al guardar la categoría.';
    } finally {
      isSaving = false;
    }
  }

  async function handleConfirmDelete() {
    if (!categoryToDelete) return;
    isDeleting = true;
    try {
      await deleteCategory(categoryToDelete.id);
      showDeleteModal = false;
      categoryToDelete = null;
      triggerRefresh();
      await loadCategories();
    } catch (err: any) {
      console.error('Error deleting category:', err);
      alert(err.message || 'Error al eliminar la categoría.');
    } finally {
      isDeleting = false;
    }
  }
</script>

<div class="categories-page-container">
  <!-- Top Header -->
  <header class="page-header glass-panel">
    <div class="header-titles">
      <div class="title-row">
        <span class="page-icon">🏷️</span>
        <h1>Gestión de Categorías</h1>
      </div>
      <p class="subtitle">Organiza los productos de tu catálogo, supervisa existencias y administra clasificaciones comerciales.</p>
    </div>

    <div class="header-actions">
      {#if $user?.role === 'ADMIN'}
        <button type="button" class="btn btn-primary" onclick={openAddModal}>
          <span>+</span> Nueva Categoría
        </button>
      {/if}
    </div>
  </header>

  <!-- Filter & Search Toolbar -->
  <section class="toolbar glass-panel">
    <div class="search-box">
      <span class="search-icon">🔍</span>
      <input
        type="search"
        placeholder="Buscar categoría por nombre o descripción..."
        bind:value={searchQuery}
        class="search-input"
        aria-label="Buscar categoría"
      />
      {#if searchQuery}
        <button type="button" class="clear-search-btn" onclick={() => (searchQuery = '')} aria-label="Limpiar búsqueda">✕</button>
      {/if}
    </div>

    <div class="category-summary-stats">
      <span class="stat-pill">
        Total: <strong>{categoryList.length}</strong> categorías
      </span>
    </div>
  </section>

  <!-- Content Table Card -->
  <main class="table-card glass-panel">
    {#if isLoading}
      <div class="loading-state flex-center">
        <Spinner size="36px" />
        <span>Cargando categorías...</span>
      </div>
    {:else if errorMessage}
      <div class="error-banner">
        <span>⚠️ {errorMessage}</span>
        <button type="button" class="btn btn-secondary btn-sm" onclick={loadCategories}>Reintentar</button>
      </div>
    {:else}
      <div class="pos-table-container">
        <table class="pos-table" aria-label="Tabla de categorías">
          <thead>
            <tr>
              <th>Nombre de la Categoría</th>
              <th>Descripción</th>
              <th class="text-center">Productos Asociados</th>
              <th class="text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredCategories as cat (cat.id)}
              <tr class="category-row">
                <td class="category-name-cell">
                  <div class="name-wrapper">
                    <strong>{cat.name}</strong>
                    {#if cat.name === 'Sin categoría'}
                      <span class="system-badge">Predeterminada</span>
                    {/if}
                  </div>
                </td>
                <td class="category-desc-cell">
                  <span class="desc-text">{cat.description || '—'}</span>
                </td>
                <td class="text-center">
                  <span class="product-count-badge" class:has-products={(cat._count?.products || 0) > 0}>
                    📦 {cat._count?.products || 0}
                  </span>
                </td>
                <td class="text-center actions-cell">
                  {#if cat.name !== 'Sin categoría'}
                    <div class="row-actions flex-center">
                      <button
                        type="button"
                        class="btn-action btn-edit"
                        onclick={() => openEditModal(cat)}
                        title="Editar categoría"
                        aria-label={`Editar categoría ${cat.name}`}
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        class="btn-action btn-delete"
                        onclick={() => openDeleteConfirm(cat)}
                        title="Eliminar categoría"
                        aria-label={`Eliminar categoría ${cat.name}`}
                      >
                        🗑️
                      </button>
                    </div>
                  {:else}
                    <span class="system-lock" title="Categoría del sistema protegida">🔒 Bloqueada</span>
                  {/if}
                </td>
              </tr>
            {:else}
              <tr>
                <td colspan="4" class="empty-state-cell">
                  <div class="empty-state">
                    <span class="empty-icon">📂</span>
                    <p>No se encontraron categorías que coincidan con "<strong>{searchQuery}</strong>".</p>
                    {#if searchQuery}
                      <button type="button" class="btn btn-secondary btn-sm" onclick={() => (searchQuery = '')}>
                        Restablecer búsqueda
                      </button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </main>
</div>

<!-- Modal: Crear / Editar Categoría -->
{#if showModal}
  <div class="modal-overlay animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="cat-modal-title">
    <div class="modal-container glass-panel animate-scale-up" style="max-width: 480px;">
      <header class="modal-header">
        <h2 id="cat-modal-title">
          {modalMode === 'add' ? '✨ Nueva Categoría' : '✏️ Editar Categoría'}
        </h2>
        <button
          type="button"
          class="close-modal-btn"
          onclick={() => (showModal = false)}
          aria-label="Cerrar modal"
        >✕</button>
      </header>

      <form onsubmit={handleSaveCategory}>
        <div class="modal-body">
          {#if modalError}
            <div class="modal-error-banner" role="alert">
              ⚠️ {modalError}
            </div>
          {/if}

          <div class="form-group">
            <label for="cat-name-input">Nombre de la Categoría <span class="required">*</span></label>
            <input
              id="cat-name-input"
              type="text"
              class="form-control"
              placeholder="Ej: Cafetería, Bebidas Frías, Pastelería..."
              bind:value={formName}
              required
            />
          </div>

          <div class="form-group">
            <label for="cat-desc-input">Descripción (Opcional)</label>
            <textarea
              id="cat-desc-input"
              class="form-control"
              placeholder="Breve reseña sobre los productos incluidos..."
              rows="3"
              bind:value={formDescription}
            ></textarea>
          </div>
        </div>

        <footer class="modal-footer">
          <button
            type="button"
            class="btn btn-secondary"
            onclick={() => (showModal = false)}
            disabled={isSaving}
          >
            Cancelar
          </button>
          <button type="submit" class="btn btn-primary" disabled={isSaving}>
            {#if isSaving}
              <Spinner size="16px" /> Guardando...
            {:else}
              {modalMode === 'add' ? 'Crear Categoría' : 'Guardar Cambios'}
            {/if}
          </button>
        </footer>
      </form>
    </div>
  </div>
{/if}

<!-- Modal: Confirmación de Eliminación -->
{#if showDeleteModal && categoryToDelete}
  <div class="modal-overlay animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="delete-cat-title">
    <div class="modal-container glass-panel animate-scale-up" style="max-width: 440px;">
      <header class="modal-header">
        <h2 id="delete-cat-title">🗑️ Eliminar Categoría</h2>
        <button
          type="button"
          class="close-modal-btn"
          onclick={() => (showDeleteModal = false)}
          aria-label="Cerrar modal"
        >✕</button>
      </header>

      <div class="modal-body">
        <p style="margin-bottom: 12px; font-size: 1rem;">
          ¿Estás seguro de que deseas eliminar la categoría <strong>"{categoryToDelete.name}"</strong>?
        </p>

        <div class="warning-reassign-card">
          <span class="warning-icon">🛡️</span>
          <div>
            <strong>Reasignación Automática de Productos:</strong>
            <p>
              Los productos asociados a esta categoría (<strong>{categoryToDelete._count?.products || 0}</strong> en total)
              no serán eliminados. El sistema los reasignará automáticamente a la categoría <em>"Sin categoría"</em>.
            </p>
          </div>
        </div>
      </div>

      <footer class="modal-footer">
        <button
          type="button"
          class="btn btn-secondary"
          onclick={() => (showDeleteModal = false)}
          disabled={isDeleting}
        >
          Cancelar
        </button>
        <button
          type="button"
          class="btn btn-danger"
          onclick={handleConfirmDelete}
          disabled={isDeleting}
        >
          {#if isDeleting}
            <Spinner size="16px" /> Eliminando...
          {:else}
            Sí, Eliminar y Reasignar
          {/if}
        </button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .categories-page-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-height: 100%;
    width: 100%;
    padding: 6px;
    overflow-y: auto;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-radius: var(--radius-md);
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .page-icon {
    font-size: 1.6rem;
  }

  .header-titles h1 {
    font-size: 1.4rem;
    font-weight: 700;
    margin: 0;
    color: var(--text-primary);
  }

  .subtitle {
    margin: 4px 0 0 0;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    gap: 16px;
    border-radius: var(--radius-md);
    flex-wrap: wrap;
  }

  .search-box {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
    max-width: 420px;
  }

  .search-icon {
    position: absolute;
    left: 12px;
    font-size: 0.9rem;
    color: var(--text-muted);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 10px 36px 10px 36px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-size: 0.9rem;
    transition: border-color 0.2s, background-color 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--color-general);
    background: rgba(255, 255, 255, 0.08);
  }

  .clear-search-btn {
    position: absolute;
    right: 10px;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 0.85rem;
    padding: 4px;
  }

  .stat-pill {
    font-size: 0.85rem;
    color: var(--text-secondary);
    background: rgba(255, 255, 255, 0.03);
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-glass);
  }

  .table-card {
    border-radius: var(--radius-md);
    padding: 0;
    display: flex;
    flex-direction: column;
    min-height: 280px;
  }

  .category-name-cell {
    width: 250px;
  }

  .name-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .system-badge {
    background: rgba(46, 204, 113, 0.15);
    color: #2ecc71;
    font-size: 0.72rem;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid rgba(46, 204, 113, 0.3);
  }

  .desc-text {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .product-count-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 0.85rem;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.03);
    color: var(--text-muted);
    border: 1px solid var(--border-glass);
  }

  .product-count-badge.has-products {
    background: rgba(52, 152, 219, 0.12);
    color: #3498db;
    border-color: rgba(52, 152, 219, 0.3);
  }

  .system-lock {
    font-size: 0.8rem;
    color: var(--text-muted);
    font-style: italic;
  }

  .btn-action {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    padding: 6px 10px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background 0.15s, transform 0.1s;
  }

  .btn-action:hover {
    background: rgba(255, 255, 255, 0.12);
    transform: translateY(-1px);
  }

  .btn-delete:hover {
    background: rgba(231, 76, 60, 0.2);
    border-color: rgba(231, 76, 60, 0.4);
  }

  .empty-state {
    padding: 40px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    color: var(--text-secondary);
  }

  .empty-icon {
    font-size: 2.2rem;
  }

  .loading-state {
    padding: 60px 20px;
    gap: 12px;
    flex-direction: column;
    color: var(--text-secondary);
  }

  .error-banner {
    margin: 20px;
    padding: 14px;
    background: rgba(231, 76, 60, 0.15);
    border: 1px solid rgba(231, 76, 60, 0.3);
    border-radius: var(--radius-sm);
    color: #e74c3c;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  /* Modal Form Styles */
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 18px 20px;
    border-bottom: 1px solid var(--border-glass);
  }

  .modal-header h2 {
    font-size: 1.2rem;
    margin: 0;
    color: var(--text-primary);
  }

  .close-modal-btn {
    background: none;
    border: none;
    font-size: 1.1rem;
    color: var(--text-muted);
    cursor: pointer;
  }

  .close-modal-btn:hover {
    color: var(--text-primary);
  }

  .modal-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .modal-error-banner {
    padding: 10px 14px;
    background: rgba(231, 76, 60, 0.15);
    border: 1px solid rgba(231, 76, 60, 0.3);
    border-radius: var(--radius-sm);
    color: #e74c3c;
    font-size: 0.88rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-group label {
    font-size: 0.88rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .required {
    color: #e74c3c;
  }

  .form-control {
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-size: 0.95rem;
    transition: border-color 0.2s;
  }

  .form-control:focus {
    outline: none;
    border-color: var(--color-general);
    background: rgba(255, 255, 255, 0.08);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid var(--border-glass);
  }

  .warning-reassign-card {
    display: flex;
    gap: 12px;
    padding: 14px;
    background: rgba(243, 156, 18, 0.12);
    border: 1px solid rgba(243, 156, 18, 0.3);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-size: 0.88rem;
  }

  .warning-icon {
    font-size: 1.4rem;
  }

  .warning-reassign-card p {
    margin: 4px 0 0 0;
    color: var(--text-secondary);
    font-size: 0.84rem;
  }
</style>
