<script lang="ts">
  import Button from '../atoms/Button.svelte';

  interface Props {
    table: any;
    userRole?: string;
    ondelete: (table: any) => void;
    onopen: (table: any) => void;
    onresume: (table: any) => void;
    oncancel: (table: any) => void;
  }

  let { table, userRole = '', ondelete, onopen, onresume, oncancel }: Props = $props();
</script>

<div class="table-card glass-panel animate-scale-up" class:occupied={table.status === 'OCCUPIED'}>
  <div class="table-card-header">
    <div class="header-left-side">
      <span class="table-icon">☕</span>
      {#if table.status === 'AVAILABLE' && userRole === 'ADMIN'}
        <button class="btn-delete-table" onclick={() => ondelete(table)} title="Eliminar Mesa">
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
      <Button variant="cafe" extraClass="flex-1" onclick={() => onresume(table)}>
        Ver Cuenta / Cobrar 🛒
      </Button>
      <button class="btn-cancel-table" onclick={() => oncancel(table)} title="Anular cuenta de mesa">
        ✕
      </button>
    {/if}
  </div>
</div>

<style>
  .table-card {
    padding: 16px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 180px;
    transition: var(--transition-normal);
    box-sizing: border-box;
    width: 100%;
  }

  .table-card:hover {
    border-color: var(--color-general);
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
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
    opacity: 0.4;
    transition: var(--transition-fast);
    outline: none;
  }

  .btn-delete-table:hover {
    opacity: 1;
    background: rgba(244, 63, 94, 0.15);
  }

  .status-indicator {
    font-size: 0.72rem;
    padding: 3px 8px;
    border-radius: 4px;
    font-weight: 600;
    text-transform: uppercase;
    background: rgba(16, 185, 129, 0.08);
    color: var(--color-general);
    border: 1px solid rgba(16, 185, 129, 0.2);
  }

  .status-indicator.occupied {
    background: rgba(245, 158, 11, 0.08);
    color: var(--color-cafe);
    border: 1px solid rgba(245, 158, 11, 0.2);
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

  :global(.flex-1) {
    flex: 1;
  }

  .btn-cancel-table {
    background: rgba(244, 63, 94, 0.08);
    border: 1px solid rgba(244, 63, 94, 0.2);
    color: var(--color-danger);
    width: 38px;
    height: 40px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 0.95rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: var(--transition-fast);
    outline: none;
  }

  .btn-cancel-table:hover {
    background: var(--color-danger-glow);
    border-color: var(--color-danger);
  }
</style>
