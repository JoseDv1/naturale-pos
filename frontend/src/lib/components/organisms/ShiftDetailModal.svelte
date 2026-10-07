<script lang="ts">
  import { onMount } from 'svelte';
  import { getShift } from '../../api/shifts';
  import Spinner from '../atoms/Spinner.svelte';
  import { printThermalReceipt } from '../../services/printer';

  interface Props {
    shiftId: string;
    onclose: () => void;
  }

  let { shiftId, onclose }: Props = $props();

  let isLoading = $state(true);
  let errorMsg = $state('');
  let shiftData = $state<any>(null);

  onMount(async () => {
    try {
      const data = await getShift(shiftId);
      shiftData = data;
    } catch (e: any) {
      errorMsg = e.message || 'Error al cargar el detalle del turno';
    } finally {
      isLoading = false;
    }
  });

  function handlePrint() {
    printThermalReceipt('printable-closure-receipt');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onclose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-overlay flex-center animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="shift-detail-title">
  <div class="modal-container glass-panel animate-scale-up" style="max-width: 520px; max-height: 92vh; display: flex; flex-direction: column;">
    <header class="modal-header no-print">
      <div class="header-info">
        <span class="header-icon">🧾</span>
        <div>
          <h2 id="shift-detail-title">Reporte de Cierre de Caja</h2>
          <p class="header-sub">Comprobante y arqueo financiero del turno #{shiftId.slice(0, 8).toUpperCase()}</p>
        </div>
      </div>
      <button type="button" class="close-modal-btn" onclick={onclose} aria-label="Cerrar modal">✕</button>
    </header>

    {#if isLoading}
      <div class="flex-center" style="padding: 50px 0;">
        <Spinner size="36px" />
        <p style="margin-top: 12px; color: var(--text-secondary);">Cargando reporte de arqueo...</p>
      </div>
    {:else if errorMsg}
      <div class="error-banner animate-fade-in">
        ⚠️ {errorMsg}
      </div>
    {:else if shiftData}
      <div class="receipt-scroll-container">
        <!-- Printable 80mm thermal closing ticket -->
        <article class="thermal-receipt-80mm" id="printable-closure-receipt">
          {#snippet metaRow(label: string, value: string, strong: boolean = false, color?: string)}
            <div class="meta-row">
              <span>{label}</span>
              {#if strong}
                <strong style={color ? `color: ${color};` : undefined}>{value}</strong>
              {:else}
                <span style={color ? `color: ${color};` : undefined}>{value}</span>
              {/if}
            </div>
          {/snippet}

          {#snippet summaryRow(label: string, value: string, bold: boolean = false, color?: string)}
            <div class="summary-line" class:font-bold={bold} style={color ? `color: ${color};` : undefined}>
              <span>{label}</span>
              <span>{value}</span>
            </div>
          {/snippet}

          <header class="receipt-header text-center">
            <h1 class="store-name">NATURALE POS</h1>
            <p class="store-subtitle">COMPROBANTE DE CIERRE DE CAJA</p>
            <p class="meta-line">Turno #{shiftData.shift.id.slice(0, 8).toUpperCase()}</p>
          </header>

          <div class="dashed-line" aria-hidden="true">----------------------------------------</div>

          <section class="receipt-details">
            {@render metaRow('Cajero Apertura:', shiftData.shift.user?.name || 'Cajero', true)}
            {#if shiftData.shift.closedByUser}
              {@render metaRow('Cajero Cierre:', shiftData.shift.closedByUser.name, true)}
            {/if}
            {@render metaRow('Apertura:', new Date(shiftData.shift.openedAt).toLocaleString())}
            {@render metaRow('Cierre:', shiftData.shift.closedAt ? new Date(shiftData.shift.closedAt).toLocaleString() : 'En curso (Abierto)')}
            {@render metaRow('Estado:', shiftData.shift.status === 'OPEN' ? 'ABIERTO (EN CURSO)' : 'CERRADO (ARCHIVADO)', true, shiftData.shift.status === 'OPEN' ? '#10b981' : '#64748b')}
          </section>

          <div class="dashed-line" aria-hidden="true">----------------------------------------</div>

          <!-- Cash summary & Arqueo -->
          <section class="receipt-summary-block">
            {@render summaryRow('Base Inicial:', `$${Number(shiftData.summary.initialCash || 0).toLocaleString()}`)}
            {@render summaryRow('(+) Ventas en Efectivo:', `$${Number(shiftData.summary.cashSales || 0).toLocaleString()}`)}
            {@render summaryRow('(-) Egresos / Gastos Menores:', `-$${Number(shiftData.summary.totalExpenses || 0).toLocaleString()}`)}
            <div class="dashed-line" aria-hidden="true">----------------------------------------</div>
            {@render summaryRow('Efectivo Teórico Esperado:', `$${Number(shiftData.summary.expectedCash || 0).toLocaleString()}`, true)}
            {#if shiftData.summary.actualCash !== null}
              {@render summaryRow('Efectivo Real (Contado):', `$${Number(shiftData.summary.actualCash || 0).toLocaleString()}`, true)}
              {@render summaryRow('Diferencia (Arqueo):', `${Number(shiftData.summary.difference) > 0 ? '+' : ''}$${Number(shiftData.summary.difference || 0).toLocaleString()}`, true, Number(shiftData.summary.difference) < 0 ? '#c0392b' : Number(shiftData.summary.difference) > 0 ? '#2980b9' : '#10b981')}
            {/if}
          </section>

          <div class="dashed-line" aria-hidden="true">----------------------------------------</div>

          <!-- Other payments -->
          <section class="other-payments-block">
            <p style="font-weight: 700; margin: 0 0 4px 0;">Otros Medios de Pago:</p>
            {@render summaryRow('💳 Ventas Tarjeta:', `$${Number(shiftData.summary.cardSales || 0).toLocaleString()}`)}
            {@render summaryRow('📲 Transferencias:', `$${Number(shiftData.summary.transferSales || 0).toLocaleString()}`)}
            {#if Number(shiftData.summary.internalSales || 0) > 0}
              {@render summaryRow('🔄 Consumo Interno:', `$${Number(shiftData.summary.internalSales).toLocaleString()}`)}
            {/if}
            <div class="dashed-line" aria-hidden="true">----------------------------------------</div>
            <div class="summary-line grand-total">
              <span>TOTAL VENTAS DEL TURNO:</span>
              <span>${Number(shiftData.summary.totalSales || 0).toLocaleString()}</span>
            </div>
            <div class="summary-line" style="font-size: 10px; color: #555;">
              <span>Total transacciones:</span>
              <span>{shiftData.summary.salesCount || 0} ventas • {shiftData.summary.expensesCount || 0} egresos</span>
            </div>
          </section>

          {#if shiftData.shift.notes}
            <div class="dashed-line" aria-hidden="true">----------------------------------------</div>
            <section class="notes-block">
              <span style="font-size: 10px; color: #555;">Observaciones:</span>
              <p style="font-size: 11px; margin: 2px 0 0 0;">{shiftData.shift.notes}</p>
            </section>
          {/if}

          <div class="dashed-line" aria-hidden="true">----------------------------------------</div>
          <footer class="receipt-footer text-center">
            <div class="signature-line" style="margin-top: 25px; border-top: 1px solid #333; width: 65%; margin-left: auto; margin-right: auto;"></div>
            <p style="font-size: 10px; margin-top: 4px;">Firma del Cajero Responsable</p>
            <div class="thermal-feed-space"></div>
          </footer>
        </article>
      </div>
    {/if}

    <footer class="modal-footer no-print">
      <button type="button" class="btn btn-secondary" onclick={onclose}>
        Cerrar
      </button>
      <button type="button" class="btn btn-general" onclick={handlePrint} disabled={isLoading || !shiftData}>
        🖨️ Imprimir Cierre (80mm)
      </button>
    </footer>
  </div>
</div>

<style>
  .header-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-icon {
    font-size: 1.8rem;
  }

  .header-info h2 {
    margin: 0;
    font-size: 1.2rem;
    color: var(--text-primary);
  }

  .header-sub {
    margin: 2px 0 0 0;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .receipt-scroll-container {
    overflow-y: auto;
    max-height: 70vh;
    padding: 12px 6px;
    display: flex;
    justify-content: center;
    background: rgba(0, 0, 0, 0.35);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-glass);
  }

  /* 80mm thermal receipt styling */
  .thermal-receipt-80mm {
    background: #ffffff;
    color: #000000;
    width: 72mm;
    max-width: 72mm;
    padding: 10px 12px;
    font-family: 'Consolas', 'Courier New', 'Lucida Console', Monaco, monospace;
    font-size: 12px;
    font-weight: 700;
    line-height: 1.35;
    border-radius: 4px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
    -webkit-font-smoothing: antialiased;
    text-rendering: geometricPrecision;
  }

  .store-name {
    font-size: 16px;
    font-weight: 900;
    margin: 0;
    color: #000000;
  }

  .store-subtitle {
    font-size: 11px;
    font-weight: 700;
    margin: 2px 0;
    color: #000000;
  }

  .meta-line {
    font-size: 10.5px;
    font-weight: 700;
    color: #000000;
    margin: 0;
  }

  .dashed-line {
    font-family: 'Consolas', 'Courier New', monospace;
    color: #000000;
    font-weight: 900;
    margin: 6px 0;
    overflow: hidden;
    white-space: nowrap;
  }

  .meta-row, .summary-line {
    display: flex;
    justify-content: space-between;
    margin-bottom: 3px;
    font-size: 11.5px;
    font-weight: 700;
  }

  .font-bold {
    font-weight: 900;
  }

  .grand-total {
    font-weight: 900;
    font-size: 13.5px;
    margin-top: 4px;
  }

  .thermal-feed-space {
    height: 15mm;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding-top: 14px;
    border-top: 1px solid var(--border-glass);
  }

  @media print {
    :global(#printable-closure-receipt) {
      display: block !important;
      position: static !important;
      width: 72mm !important;
      max-width: 72mm !important;
      margin: 0 auto !important;
      padding: 2mm 2mm 15mm 2mm !important;
      box-shadow: none !important;
      border: none !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: 'Consolas', 'Courier New', 'Lucida Console', Monaco, monospace !important;
      font-size: 12px !important;
      font-weight: 700 !important;
      line-height: 1.35 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      -webkit-font-smoothing: antialiased !important;
      -webkit-text-stroke: 0.22px #000000 !important;
      text-rendering: geometricPrecision !important;
      visibility: visible !important;
    }

    .no-print {
      display: none !important;
    }
  }
</style>
