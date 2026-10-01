<script lang="ts">
  import ThermalReceipt80mm from '../molecules/ThermalReceipt80mm.svelte';
  import ReceiptSettingsModal from './ReceiptSettingsModal.svelte';
  import { printThermalReceipt } from '../../services/printer';

  interface Props {
    sale: any;
    onclose: () => void;
    oneditpayment?: (sale: any) => void;
  }

  let { sale, onclose, oneditpayment }: Props = $props();
  let showReceiptSettings = $state(false);

  const canEditPayment = $derived(sale.status !== 'CANCELLED' && sale.shift?.status === 'OPEN');

  function printReceipt() {
    printThermalReceipt('printable-thermal-receipt');
  }
</script>

<div class="modal-overlay flex-center animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="sale-detail-title">
  <div class="modal-container glass-panel animate-scale-up" style="max-width: 480px; max-height: 92vh; display: flex; flex-direction: column;">
    <!-- Modal Header (hidden on print) -->
    <header class="modal-header no-print">
      <div class="header-info">
        <h2 id="sale-detail-title">🧾 Detalle de Venta</h2>
        <span class="ticket-code">#{sale.id.slice(0, 8).toUpperCase()}</span>
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
        <button type="button" class="close-modal-btn" onclick={onclose} aria-label="Cerrar modal">✕</button>
      </div>
    </header>

    <!-- Scrollable thermal receipt preview wrapper -->
    <div class="receipt-scroll-container">
      <div class="receipt-paper-wrapper">
        <ThermalReceipt80mm
          {sale}
          cashierName={sale.user?.name}
          tableName={sale.table?.name}
        />
      </div>
    </div>

    <!-- Modal Footer Actions (hidden on print) -->
    <footer class="modal-footer no-print">
      <button type="button" class="btn btn-secondary" onclick={onclose}>
        Cerrar
      </button>
      {#if sale.status !== 'CANCELLED'}
        <button
          type="button"
          class="btn btn-secondary edit-payment-btn"
          onclick={() => oneditpayment?.(sale)}
          disabled={!canEditPayment}
          title={canEditPayment ? 'Editar métodos de pago' : 'No disponible (Turno cerrado)'}
        >
          💳 Editar Pagos
        </button>
      {/if}
      <button type="button" class="btn btn-general print-action-btn" onclick={printReceipt}>
        🖨️ Imprimir Ticket (80mm)
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

  .ticket-code {
    font-size: 0.85rem;
    background: rgba(255, 255, 255, 0.08);
    padding: 2px 8px;
    border-radius: 4px;
    color: var(--color-general);
    font-weight: 600;
  }

  .btn-settings-icon {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid var(--border-glass);
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    font-size: 0.95rem;
    color: var(--text-primary);
    transition: all 0.2s;
  }

  .btn-settings-icon:hover {
    background: rgba(255, 255, 255, 0.16);
  }

  .receipt-scroll-container {
    overflow-y: auto;
    max-height: 70vh;
    padding: 4px;
  }

  .receipt-paper-wrapper {
    display: flex;
    justify-content: center;
    background: rgba(0, 0, 0, 0.35);
    border-radius: var(--radius-md);
    padding: 16px 8px;
    border: 1px solid var(--border-glass);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding-top: 14px;
    border-top: 1px solid var(--border-glass);
  }

  .print-action-btn {
    font-weight: 700;
  }

  @media print {
    .no-print {
      display: none !important;
    }
  }
</style>
