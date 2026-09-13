<script lang="ts">
  interface Props {
    sourceTable: any;
    tables: any[];
    onmerge: (sourceId: string, targetTableId: string) => Promise<void>;
    onclose: () => void;
  }

  let { sourceTable, tables = [], onmerge, onclose }: Props = $props();

  let selectedTargetId = $state<string | null>(null);
  let filterMode = $state<'ALL' | 'OCCUPIED' | 'AVAILABLE'>('ALL');
  let isLoading = $state(false);
  let errorMsg = $state('');

  // Exclude source table from possible targets
  const candidateTables = $derived(
    tables.filter(t => t.id !== sourceTable.id)
  );

  const filteredTables = $derived(
    candidateTables.filter(t => {
      if (filterMode === 'OCCUPIED') return t.status === 'OCCUPIED';
      if (filterMode === 'AVAILABLE') return t.status === 'AVAILABLE';
      return true;
    })
  );

  const selectedTarget = $derived(
    candidateTables.find(t => t.id === selectedTargetId) || null
  );

  async function handleConfirm() {
    if (!selectedTargetId) return;
    isLoading = true;
    errorMsg = '';
    try {
      await onmerge(sourceTable.id, selectedTargetId);
      onclose();
    } catch (e: any) {
      errorMsg = e.message || 'Error al fusionar las mesas';
    } finally {
      isLoading = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-overlay flex-center animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="merge-modal-title">
  <div class="modal-container glass-panel animate-scale-up">
    <div class="modal-header">
      <div class="header-titles">
        <h2 id="merge-modal-title">Fusionar / Mover Mesa</h2>
        <span class="source-badge">Origen: <strong>{sourceTable.name}</strong> (${parseFloat(sourceTable.currentSale?.total || 0).toLocaleString()})</span>
      </div>
      <button class="close-modal-btn" onclick={onclose} aria-label="Cerrar ventana">✕</button>
    </div>

    {#if errorMsg}
      <div class="error-banner animate-fade-in" role="alert">
        <span>⚠️ {errorMsg}</span>
      </div>
    {/if}

{#snippet targetTableCard(target: any)}
  <button
    type="button"
    class="target-card"
    class:selected={selectedTargetId === target.id}
    class:occupied={target.status === 'OCCUPIED'}
    onclick={() => selectedTargetId = target.id}
  >
    <div class="card-header-mini">
      <span class="table-name">{target.name}</span>
      <span class="status-pill" class:occupied={target.status === 'OCCUPIED'}>
        {target.status === 'OCCUPIED' ? 'Ocupada' : 'Libre'}
      </span>
    </div>

    {#if target.status === 'OCCUPIED' && target.currentSale}
      <div class="card-sale-info">
        <span class="items-count">📦 {target.currentSale.items?.length || 0} ítems</span>
        <span class="sale-total">${parseFloat(target.currentSale.total).toLocaleString()}</span>
      </div>
    {:else}
      <div class="card-available-info">
        <span>Mesa libre para traslado</span>
      </div>
    {/if}
  </button>
{/snippet}

    <!-- Filter tabs -->
    <div class="filter-tabs">
      <button
        type="button"
        class="tab-btn"
        class:active={filterMode === 'ALL'}
        onclick={() => filterMode = 'ALL'}
      >
        Todas ({candidateTables.length})
      </button>
      <button
        type="button"
        class="tab-btn"
        class:active={filterMode === 'OCCUPIED'}
        onclick={() => filterMode = 'OCCUPIED'}
      >
        Ocupadas (Unir) ({candidateTables.filter(t => t.status === 'OCCUPIED').length})
      </button>
      <button
        type="button"
        class="tab-btn"
        class:active={filterMode === 'AVAILABLE'}
        onclick={() => filterMode = 'AVAILABLE'}
      >
        Libres (Mover) ({candidateTables.filter(t => t.status === 'AVAILABLE').length})
      </button>
    </div>

    <!-- Target Tables Grid -->
    <div class="tables-selection-grid">
      {#each filteredTables as target}
        {@render targetTableCard(target)}
      {:else}
        <div class="empty-state">
          <p>No se encontraron mesas disponibles para esta opción.</p>
        </div>
      {/each}
    </div>

    <!-- Impact summary banner -->
    {#if selectedTarget}
      <div class="impact-notice animate-fade-in">
        {#if selectedTarget.status === 'OCCUPIED'}
          <span class="impact-icon">🔀</span>
          <div>
            <strong>Unificación de Cuentas:</strong>
            <p>Los productos de <em>{sourceTable.name}</em> se añadirán a <em>{selectedTarget.name}</em> (consolidando productos idénticos). <strong>{sourceTable.name}</strong> quedará libre y disponible.</p>
          </div>
        {:else}
          <span class="impact-icon">🚚</span>
          <div>
            <strong>Traslado de Mesa:</strong>
            <p>La comanda completa de <em>{sourceTable.name}</em> se trasladará a <em>{selectedTarget.name}</em>. <strong>{sourceTable.name}</strong> quedará libre.</p>
          </div>
        {/if}
      </div>
    {/if}

    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" onclick={onclose} disabled={isLoading}>
        Cancelar
      </button>
      <button
        type="button"
        class="btn btn-cafe"
        onclick={handleConfirm}
        disabled={!selectedTargetId || isLoading}
      >
        {#if isLoading}
          Procesando...
        {:else if selectedTarget?.status === 'OCCUPIED'}
          Unificar Cuentas ✔
        {:else}
          Mover a Mesa Libre ✔
        {/if}
      </button>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(3, 7, 18, 0.45);
    backdrop-filter: blur(8px);
    z-index: 1000;
  }

  .modal-container {
    width: 90%;
    max-width: 580px;
    background: #ffffff;
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-lg, 16px);
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: 0 20px 40px rgba(11, 38, 20, 0.15);
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .header-titles h2 {
    margin: 0 0 4px 0;
    font-size: 1.35rem;
    color: var(--text-primary);
  }

  .source-badge {
    font-size: 0.85rem;
    color: var(--color-cafe);
    font-weight: 500;
  }

  .close-modal-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 1.25rem;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: var(--transition-fast, all 0.2s);
  }

  .close-modal-btn:hover {
    color: var(--color-danger);
  }

  .error-banner {
    background: var(--color-danger-glow);
    border: 1px solid rgba(190, 18, 60, 0.3);
    color: #991b1b;
    font-weight: 500;
    padding: 10px 14px;
    border-radius: var(--radius-sm, 8px);
    font-size: 0.88rem;
  }

  .filter-tabs {
    display: flex;
    gap: 8px;
    background: rgba(0, 0, 0, 0.05);
    padding: 4px;
    border-radius: var(--radius-md, 10px);
  }

  .tab-btn {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    padding: 8px 12px;
    border-radius: var(--radius-sm, 8px);
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast, all 0.2s);
  }

  .tab-btn.active {
    background: var(--color-general);
    color: #ffffff;
    box-shadow: 0 2px 8px rgba(4, 120, 87, 0.25);
  }

  .tables-selection-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 12px;
    max-height: 260px;
    overflow-y: auto;
    padding: 4px;
  }

  .target-card {
    background: rgba(0, 0, 0, 0.02);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-md, 10px);
    padding: 12px;
    text-align: left;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: var(--transition-fast, all 0.2s);
  }

  .target-card:hover {
    background: rgba(0, 0, 0, 0.05);
    border-color: var(--color-cafe);
    transform: translateY(-2px);
  }

  .target-card.selected {
    border-color: var(--color-cafe);
    background: rgba(180, 83, 9, 0.1);
    box-shadow: 0 0 12px rgba(180, 83, 9, 0.2);
  }

  .card-header-mini {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .table-name {
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--text-primary);
  }

  .status-pill {
    font-size: 0.7rem;
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
    font-weight: 600;
    background: var(--color-general-glow);
    color: var(--color-general);
  }

  .status-pill.occupied {
    background: var(--color-cafe-glow);
    color: var(--color-cafe);
  }

  .card-sale-info, .card-available-info {
    font-size: 0.78rem;
    color: var(--text-muted);
    display: flex;
    justify-content: space-between;
  }

  .sale-total {
    font-weight: 700;
    color: var(--text-primary);
  }

  .empty-state {
    grid-column: 1 / -1;
    text-align: center;
    padding: 30px;
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .impact-notice {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    background: var(--color-cafe-glow);
    border: 1px solid rgba(180, 83, 9, 0.25);
    border-radius: var(--radius-md, 10px);
    padding: 12px 14px;
    font-size: 0.85rem;
    color: #78350f;
    font-weight: 500;
  }

  .impact-icon {
    font-size: 1.5rem;
  }

  .impact-notice p {
    margin: 4px 0 0 0;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 8px;
  }
</style>
