<script lang="ts">
  import ThermalReceipt80mm from '../molecules/ThermalReceipt80mm.svelte';
  import ReceiptSettingsModal from './ReceiptSettingsModal.svelte';
  import { printThermalReceipt } from '../../services/printer';
  import { receiptSettings } from '../../store';

  interface Props {
    table: any;
    onclose: () => void;
  }

  let { table, onclose }: Props = $props();
  let showReceiptSettings = $state(false);

  // Normalize table items to sale structure for receipt renderer
  let saleData = $derived.by(() => {
    if (!table?.currentSale) return null;
    return {
      ...table.currentSale,
      table: { name: table.name },
      user: table.currentSale.user,
    };
  });

  function handlePrint() {
    printThermalReceipt('printable-pre-receipt', {
      darkness: $receiptSettings.fontDarkness || 'dark'
    });
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onclose();
    } else if (e.key === 'Enter' && !showReceiptSettings) {
      handlePrint();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="modal-overlay flex-center animate-fade-in"
  role="dialog"
  aria-modal="true"
  aria-labelledby="pre-receipt-title"
>
  <div
    class="modal-container glass-panel animate-scale-up"
    style="max-width: 480px; max-height: 92vh; display: flex; flex-direction: column;"
  >
    <!-- Modal Header (hidden on print) -->
    <header class="modal-header no-print">
      <div class="header-info">
        <h2 id="pre-receipt-title">🧾 Pre-Cuenta del Cliente</h2>
        <span class="table-badge">{table.name}</span>
      </div>
      <div class="header-actions">
        <button
          type="button"
          class="btn-settings-icon"
          onclick={() => (showReceiptSettings = true)}
          title="Configurar datos del ticket"
          aria-label="Configurar datos del ticket"
        >
          ⚙️
        </button>
        <button
          type="button"
          class="close-modal-btn"
          onclick={onclose}
          aria-label="Cerrar modal"
          title="Cerrar (Esc)"
        >
          ✕
        </button>
      </div>
    </header>

    <!-- Scrollable thermal receipt preview wrapper -->
    <div class="receipt-scroll-container">
      <div class="receipt-paper-wrapper">
        {#if saleData}
          <ThermalReceipt80mm
            sale={saleData}
            tableName={table.name}
            cashierName={saleData.user?.name}
            isPreReceipt={true}
            elementId="printable-pre-receipt"
          />
        {:else}
          <div class="empty-notice p-4 text-center">
            No hay una comanda activa registrada para esta mesa.
          </div>
        {/if}
      </div>
    </div>

    <!-- Modal Footer Actions (hidden on print) -->
    <footer class="modal-footer no-print">
      <button type="button" class="btn btn-secondary" onclick={onclose}>
        Cerrar (Esc)
      </button>
      <button
        type="button"
        class="btn btn-cafe print-action-btn"
        onclick={handlePrint}
        disabled={!saleData}
      >
        🖨️ Imprimir Pre-Cuenta (80mm)
      </button>
    </footer>
  </div>
</div>

{#if showReceiptSettings}
  <ReceiptSettingsModal onclose={() => (showReceiptSettings = false)} />
{/if}

<style>
  .header-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-info h2 {
    margin: 0;
    font-size: 1.2rem;
    color: var(--text-primary);
  }

  .table-badge {
    background: var(--color-cafe, #b45309);
    color: #ffffff;
    font-size: 0.78rem;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: var(--radius-sm, 6px);
  }

  .btn-settings-icon {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm, 6px);
    color: var(--text-secondary);
    font-size: 1rem;
    cursor: pointer;
    padding: 4px 8px;
    transition: background var(--transition-fast, 0.15s), color var(--transition-fast, 0.15s);
  }

  .btn-settings-icon:hover {
    background: rgba(255, 255, 255, 0.15);
    color: var(--text-primary);
  }

  .close-modal-btn {
    background: transparent;
    border: none;
    font-size: 1.2rem;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: var(--radius-sm, 6px);
    transition: background var(--transition-fast, 0.15s), color var(--transition-fast, 0.15s);
  }

  .close-modal-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-primary);
  }

  .receipt-scroll-container {
    overflow-y: auto;
    padding: 16px 12px;
    background: rgba(0, 0, 0, 0.25);
    border-radius: var(--radius-sm);
    margin: 10px 0;
    flex: 1;
    display: flex;
    justify-content: center;
    max-height: 72vh;
  }

  .receipt-paper-wrapper {
    display: flex;
    justify-content: center;
    width: 100%;
  }

  .empty-notice {
    padding: 30px 10px;
    color: var(--text-secondary);
    font-size: 0.95rem;
  }

  .modal-footer {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding-top: 10px;
    border-top: 1px solid var(--border-glass);
  }

  .print-action-btn {
    font-weight: 700;
    padding: 8px 18px;
  }
</style>
