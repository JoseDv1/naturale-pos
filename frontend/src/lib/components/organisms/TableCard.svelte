<script lang="ts">
  import Button from '../atoms/Button.svelte';

  interface Props {
    table: any;
    userRole?: string;
    isEditMode?: boolean;
    isSelected?: boolean;
    onselect?: (table: any) => void;
    ondelete: (table: any) => void;
    onopen: (table: any) => void;
    onresume: (table: any) => void;
    oncancel: (table: any) => void;
    onmerge?: (table: any) => void;
    onsplit?: (table: any) => void;
    onprereceipt?: (table: any) => void;
  }

  let { 
    table, 
    userRole = '', 
    isEditMode = false, 
    isSelected = false,
    onselect,
    ondelete, 
    onopen, 
    onresume, 
    oncancel, 
    onmerge, 
    onsplit,
    onprereceipt 
  }: Props = $props();
</script>

<div 
  class="table-card glass-panel animate-scale-up" 
  class:occupied={table.status === 'OCCUPIED'}
  class:selected={isSelected}
  onclick={(e) => {
    if ((e.target as HTMLElement)?.closest('button')) return;
    onselect?.(table);
  }}
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if ((e.target as HTMLElement)?.closest('button')) return;
      onselect?.(table);
    }
  }}
  role="button"
  tabindex="0"
  aria-label="Mesa {table.name}"
>
  <div class="table-card-header">
    <div class="header-left-side">
      <span class="table-icon">☕</span>
      {#if isEditMode && table.status === 'AVAILABLE' && userRole === 'ADMIN'}
        <button type="button" class="btn-delete-table" onclick={() => ondelete(table)} title="Eliminar Mesa" aria-label="Eliminar Mesa">
          🗑️
        </button>
      {/if}
    </div>
    <span class="status-indicator" class:occupied={table.status === 'OCCUPIED'}>
      {table.status === 'OCCUPIED' ? 'Ocupada' : 'Disponible'}
    </span>
  </div>

  <div class="table-card-body">
    <h3>{table.name}</h3>
    
    {#if table.status === 'OCCUPIED' && table.currentSale}
      <div class="order-summary">
        <span class="items-count">📦 {table.currentSale.items.reduce((sum: number, i: any) => sum + i.quantity, 0)} Productos</span>
        <span class="order-total">${table.currentSale.total.toLocaleString()}</span>
      </div>
      <div class="order-time">
        <span>Abierta: {new Date(table.currentSale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    {:else}
      <p class="empty-msg">Mesa disponible para nuevos pedidos.</p>
    {/if}
  </div>

  <div class="table-card-actions">
    {#if table.status === 'AVAILABLE'}
      <Button variant="market" extraClass="w-100" onclick={() => onopen(table)}>
        Abrir Mesa 🪑
      </Button>
    {:else}
      <div class="occupied-actions-wrap">
        <Button variant="cafe" extraClass="w-100 card-main-btn" onclick={() => onresume(table)}>
          Ver Cuenta / Facturar 🛒
        </Button>
        <div class="sub-action-row">
          {#if onprereceipt}
            <button
              type="button"
              class="btn-tool-action btn-pre-receipt"
              onclick={(e) => { e.stopPropagation(); onprereceipt(table); }}
              title="Imprimir pre-cuenta para el cliente"
              aria-label="Imprimir pre-cuenta para el cliente"
            >
              🧾 Pre-Cuenta
            </button>
          {/if}
          {#if onmerge}
            <button 
              type="button" 
              class="btn-tool-action" 
              onclick={(e) => { e.stopPropagation(); onmerge(table); }} 
              title="Fusionar o mover mesa"
            >
              🔀 Mover
            </button>
          {/if}
          {#if onsplit}
            <button 
              type="button" 
              class="btn-tool-action" 
              onclick={(e) => { e.stopPropagation(); onsplit(table); }} 
              title="Dividir cuenta"
            >
              ✂️ Dividir
            </button>
          {/if}
          <button 
            type="button" 
            class="btn-tool-action btn-tool-cancel" 
            onclick={(e) => { e.stopPropagation(); oncancel(table); }} 
            title="Anular cuenta de mesa" 
            aria-label="Anular cuenta de mesa"
          >
            ✕ Anular
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .table-card {
    padding: 16px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 200px;
    height: auto;
    transition: var(--transition-normal);
    box-sizing: border-box;
    width: 100%;
    cursor: pointer;
  }

  .table-card.selected {
    border-color: #6366f1 !important;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.35), 0 8px 24px rgba(0, 0, 0, 0.12) !important;
  }

  .occupied-actions-wrap {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  :global(.card-main-btn) {
    font-size: 0.84rem !important;
    font-weight: 600 !important;
    height: 38px !important;
    padding: 0 8px !important;
    white-space: nowrap !important;
    letter-spacing: 0.2px;
    box-shadow: 0 2px 8px var(--color-cafe-glow);
  }

  :global(.card-main-btn:hover) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px var(--color-cafe-glow);
  }

  .sub-action-row {
    display: flex;
    gap: 6px;
    width: 100%;
  }

  .btn-tool-action {
    flex: 1;
    background: rgba(0, 0, 0, 0.03);
    border: 1px solid var(--border-glass);
    color: var(--text-secondary);
    padding: 6px 4px;
    border-radius: var(--radius-sm, 6px);
    font-size: 0.72rem;
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast, all 0.2s);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    white-space: nowrap;
  }

  .btn-tool-action:hover {
    background: rgba(0, 0, 0, 0.07);
    color: var(--text-primary);
    border-color: var(--color-general);
  }

  .btn-tool-cancel {
    color: var(--color-danger);
    border-color: rgba(244, 63, 94, 0.25);
    background: rgba(244, 63, 94, 0.04);
  }

  .btn-tool-cancel:hover {
    background: rgba(244, 63, 94, 0.12);
    border-color: var(--color-danger);
    color: var(--color-danger);
  }

  .btn-tool-action.btn-pre-receipt {
    background: rgba(180, 83, 9, 0.12);
    border-color: rgba(180, 83, 9, 0.3);
    color: var(--color-cafe, #b45309);
    font-weight: 700;
  }

  .btn-tool-action.btn-pre-receipt:hover {
    background: rgba(180, 83, 9, 0.22);
    border-color: var(--color-cafe, #b45309);
  }

  .table-card:hover {
    border-color: var(--color-general);
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }

  .table-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-left-side {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .table-icon {
    font-size: 1.25rem;
  }

  .btn-delete-table {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 0.85rem;
    padding: 2px 4px;
    border-radius: 4px;
    opacity: 0.7;
    transition: var(--transition-fast);
    outline: none;
  }

  .btn-delete-table:hover {
    opacity: 1;
    background: rgba(190, 18, 60, 0.15);
  }

  .status-indicator {
    font-size: 0.72rem;
    padding: 3px 8px;
    border-radius: 4px;
    font-weight: 600;
    text-transform: uppercase;
    background: var(--color-general-glow);
    color: var(--color-general);
    border: 1px solid rgba(4, 120, 87, 0.25);
  }

  .status-indicator.occupied {
    background: var(--color-cafe-glow);
    color: var(--color-cafe);
    border: 1px solid rgba(180, 83, 9, 0.25);
  }

  .table-card-body {
    display: flex;
    flex-direction: column;
    justify-content: center;
    flex: 1;
    margin: 12px 0;
  }

  .table-card-body h3 {
    font-size: 1.05rem;
    font-weight: 600;
    margin-bottom: 4px;
    color: var(--text-primary);
  }

  .order-summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .items-count {
    font-size: 0.78rem;
    color: var(--text-secondary);
  }

  .order-total {
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .order-time {
    font-size: 0.72rem;
    color: var(--text-muted);
    margin-top: 2px;
  }

  .empty-msg {
    font-size: 0.82rem;
    color: var(--text-muted);
    font-style: italic;
  }

  .table-card-actions {
    display: flex;
    gap: 8px;
  }

  :global(.w-100) {
    width: 100%;
  }

</style>
