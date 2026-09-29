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
</script>

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
          <header class="receipt-header text-center">
            <h1 class="store-name">NATURALE POS</h1>
            <p class="store-subtitle">COMPROBANTE DE CIERRE DE CAJA</p>
            <p class="meta-line">Turno #{shiftData.shift.id.slice(0, 8).toUpperCase()}</p>
          </header>

          <div class="dashed-line">----------------------------------------</div>

          <section class="receipt-details">
            <div class="meta-row">
              <span>Cajero Apertura:</span>
              <strong>{shiftData.shift.user?.name || 'Cajero'}</strong>
            </div>
            {#if shiftData.shift.closedByUser}
              <div class="meta-row">
                <span>Cajero Cierre:</span>
                <strong>{shiftData.shift.closedByUser.name}</strong>
              </div>
            {/if}
            <div class="meta-row">
              <span>Apertura:</span>
              <span>{new Date(shiftData.shift.openedAt).toLocaleString()}</span>
            </div>
            <div class="meta-row">
              <span>Cierre:</span>
              <span>{shiftData.shift.closedAt ? new Date(shiftData.shift.closedAt).toLocaleString() : 'En curso (Abierto)'}</span>
            </div>
            <div class="meta-row">
              <span>Estado:</span>
              <strong style="color: {shiftData.shift.status === 'OPEN' ? '#10b981' : '#64748b'};">
                {shiftData.shift.status === 'OPEN' ? 'ABIERTO (EN CURSO)' : 'CERRADO (ARCHIVADO)'}
              </strong>
            </div>
          </section>

          <div class="dashed-line">----------------------------------------</div>

          <!-- Cash summary & Arqueo -->
          <section class="receipt-summary-block">
            <div class="summary-line">
              <span>Base Inicial:</span>
              <span>${Number(shiftData.summary.initialCash || 0).toLocaleString()}</span>
            </div>
            <div class="summary-line">
              <span>(+) Ventas en Efectivo:</span>
              <span>${Number(shiftData.summary.cashSales || 0).toLocaleString()}</span>
            </div>
            <div class="summary-line">
              <span>(-) Egresos / Gastos Menores:</span>
              <span>-${Number(shiftData.summary.totalExpenses || 0).toLocaleString()}</span>
            </div>
            <div class="dashed-line">----------------------------------------</div>
            <div class="summary-line font-bold">
              <span>Efectivo Teórico Esperado:</span>
              <span>${Number(shiftData.summary.expectedCash || 0).toLocaleString()}</span>
            </div>
            {#if shiftData.summary.actualCash !== null}
              <div class="summary-line font-bold">
                <span>Efectivo Real (Contado):</span>
                <span>${Number(shiftData.summary.actualCash || 0).toLocaleString()}</span>
              </div>
              <div class="summary-line font-bold" style="color: {Number(shiftData.summary.difference) < 0 ? '#c0392b' : Number(shiftData.summary.difference) > 0 ? '#2980b9' : '#10b981'};">
                <span>Diferencia (Arqueo):</span>
                <span>{Number(shiftData.summary.difference) > 0 ? '+' : ''}${Number(shiftData.summary.difference || 0).toLocaleString()}</span>
              </div>
            {/if}
          </section>

          <div class="dashed-line">----------------------------------------</div>

          <!-- Other payments -->
          <section class="other-payments-block">
            <p style="font-weight: 700; margin: 0 0 4px 0;">Otros Medios de Pago:</p>
            <div class="summary-line">
              <span>💳 Ventas Tarjeta:</span>
              <span>${Number(shiftData.summary.cardSales || 0).toLocaleString()}</span>
            </div>
            <div class="summary-line">
              <span>📲 Transferencias:</span>
              <span>${Number(shiftData.summary.transferSales || 0).toLocaleString()}</span>
            </div>
            {#if Number(shiftData.summary.internalSales || 0) > 0}
              <div class="summary-line">
                <span>🔄 Consumo Interno:</span>
                <span>${Number(shiftData.summary.internalSales).toLocaleString()}</span>
              </div>
            {/if}
            <div class="dashed-line">----------------------------------------</div>
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
            <div class="dashed-line">----------------------------------------</div>
            <section class="notes-block">
              <span style="font-size: 10px; color: #555;">Observaciones:</span>
              <p style="font-size: 11px; margin: 2px 0 0 0;">{shiftData.shift.notes}</p>
            </section>
          {/if}

          <div class="dashed-line">----------------------------------------</div>
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
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    line-height: 1.35;
    border-radius: 4px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  }

  .store-name {
    font-size: 15px;
    font-weight: 800;
    margin: 0;
    color: #000000;
  }

  .store-subtitle {
    font-size: 10px;
    margin: 2px 0;
    color: #444;
  }

  .meta-line {
    font-size: 10px;
    color: #666;
    margin: 0;
  }

  .dashed-line {
    font-family: monospace;
    color: #777;
    margin: 6px 0;
    overflow: hidden;
    white-space: nowrap;
  }

  .meta-row, .summary-line {
    display: flex;
    justify-content: space-between;
    margin-bottom: 3px;
    font-size: 11px;
  }

  .font-bold {
    font-weight: 700;
  }

  .grand-total {
    font-weight: 800;
    font-size: 12px;
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
      visibility: visible !important;
    }

    .no-print {
      display: none !important;
    }
  }
</style>
