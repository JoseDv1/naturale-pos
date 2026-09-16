<script lang="ts">
  import { closeShift, getCurrentShift } from '../../api/shifts';
  import { currentShift, triggerRefresh, user } from '../../store';
  import Spinner from '../atoms/Spinner.svelte';

  interface Props {
    shiftData?: any;
    onclose: () => void;
    onsuccess?: (report: any) => void;
    onopennew?: () => void;
  }

  let { shiftData, onclose, onsuccess, onopennew }: Props = $props();

  let activeShift = $state<any>(null);
  let totals = $state<any>(null);
  let isLoadingData = $state(true);

  let actualCash = $state<number | string>('');
  let notes = $state('');
  let isClosing = $state(false);
  let errorMessage = $state('');
  let closedReport = $state<any>(null);

  // Fetch current live totals if not passed
  $effect(() => {
    if (shiftData) {
      activeShift = shiftData.shift || shiftData;
      totals = shiftData.realTimeTotals || null;
      if (totals) {
        isLoadingData = false;
        if (actualCash === '') {
          actualCash = totals.expectedCash;
        }
      }
    }

    if (!activeShift || !totals) {
      getCurrentShift()
        .then((data) => {
          activeShift = data.shift;
          totals = data.realTimeTotals;
          if (totals && actualCash === '') {
            actualCash = totals.expectedCash;
          }
        })
        .catch((e) => {
          errorMessage = e.message || 'Error al cargar los datos del turno activo.';
        })
        .finally(() => {
          isLoadingData = false;
        });
    }
  });

  // Expected Cash: base + cashSales - expenses
  let expectedCash = $derived(Number(totals?.expectedCash || activeShift?.expectedCash || 0));
  let enteredCash = $derived(Number(actualCash || 0));
  let discrepancy = $derived(enteredCash - expectedCash);

  async function handleCloseShift(e: SubmitEvent) {
    e.preventDefault();
    const counted = Number(actualCash);
    if (isNaN(counted) || counted < 0) {
      errorMessage = 'Ingresa un valor válido para el conteo de efectivo.';
      return;
    }

    isClosing = true;
    errorMessage = '';

    try {
      const res = await closeShift(counted, notes.trim() || undefined);
      closedReport = res.report;
      // Update global store: shift is now closed
      currentShift.set(null);
      triggerRefresh();
      onsuccess?.(res.report);
    } catch (err: any) {
      console.error('Error closing shift:', err);
      errorMessage = err.message || 'Error al procesar el cierre de caja.';
    } finally {
      isClosing = false;
    }
  }

  function printClosureTicket() {
    window.print();
  }
</script>

<div class="modal-overlay flex-center animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="close-shift-title">
  <div class="modal-container glass-panel animate-scale-up printable-modal" style="max-width: 520px;">
    <!-- If not yet closed, show Guided Arqueo Form -->
    {#if !closedReport}
      <header class="modal-header">
        <div class="header-info">
          <span class="header-icon">🔒</span>
          <div>
            <h2 id="close-shift-title">Cierre de Caja & Arqueo Guiado</h2>
            <p class="header-sub">Verifica el efectivo físico en gaveta y genera el balance de la jornada.</p>
          </div>
        </div>
        <button type="button" class="close-modal-btn" onclick={onclose} aria-label="Cerrar modal">✕</button>
      </header>

      {#if isLoadingData}
        <div class="loading-state flex-center" style="padding: 40px 0;">
          <Spinner size="36px" />
          <p style="margin-top: 10px; color: var(--text-secondary);">Calculando totales de caja en tiempo real...</p>
        </div>
      {:else if !activeShift}
        <div class="modal-body">
          <div class="error-banner">
            ⚠️ No hay ningún turno de caja abierto actualmente para cerrar.
          </div>
        </div>
        <footer class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick={onclose}>Cerrar</button>
        </footer>
      {:else}
        <form onsubmit={handleCloseShift}>
          <div class="modal-body">
            {#if errorMessage}
              <div class="error-banner animate-fade-in" role="alert">
                ⚠️ {errorMessage}
              </div>
            {/if}

            <!-- Cashier & Opening Info -->
            <div class="shift-meta-grid">
              <div class="meta-item">
                <span class="meta-label">Cajero:</span>
                <strong>{activeShift.user?.name || $user?.name || 'Cajero'}</strong>
              </div>
              <div class="meta-item">
                <span class="meta-label">Apertura:</span>
                <span>{new Date(activeShift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Base Inicial:</span>
                <strong class="text-general">${Number(activeShift.initialCash).toLocaleString()}</strong>
              </div>
            </div>

            <!-- Financial Breakdown Card -->
            <div class="breakdown-card">
              <h4>Desglose Financiero del Turno:</h4>
              <div class="breakdown-row">
                <span>💵 Ventas en Efectivo:</span>
                <strong>+${Number(totals?.cashSales || 0).toLocaleString()}</strong>
              </div>
              <div class="breakdown-row">
                <span>💳 Ventas con Tarjeta:</span>
                <span>${Number(totals?.cardSales || 0).toLocaleString()}</span>
              </div>
              <div class="breakdown-row">
                <span>📲 Ventas por Transferencia:</span>
                <span>${Number(totals?.transferSales || 0).toLocaleString()}</span>
              </div>
              {#if Number(totals?.internalSales || 0) > 0}
                <div class="breakdown-row">
                  <span>🔄 Consumo Interno:</span>
                  <span>${Number(totals.internalSales).toLocaleString()}</span>
                </div>
              {/if}
              <div class="breakdown-row text-danger">
                <span>💸 Egresos / Gastos Menores:</span>
                <strong>-${Number(totals?.expenses || 0).toLocaleString()}</strong>
              </div>
              <div class="breakdown-divider"></div>
              <div class="breakdown-row expected-row">
                <span>💰 Efectivo Teórico Esperado:</span>
                <strong class="expected-amount">${expectedCash.toLocaleString()}</strong>
              </div>
            </div>

            <!-- Physical Count Input (Arqueo) -->
            <div class="form-group">
              <label for="actual-cash-input">
                Efectivo Físico Contado en Gaveta ($) <span class="required">*</span>
              </label>
              <div class="input-with-symbol">
                <span class="currency-symbol">$</span>
                <input
                  id="actual-cash-input"
                  type="number"
                  min="0"
                  step="any"
                  class="form-control cash-count-input"
                  bind:value={actualCash}
                  placeholder="0"
                  required
                  autofocus
                />
              </div>
            </div>

            <!-- Real-Time Discrepancy Assessment -->
            <div class="discrepancy-card" class:cuadrado={discrepancy === 0} class:faltante={discrepancy < 0} class:sobrante={discrepancy > 0}>
              <div class="discrepancy-header">
                {#if discrepancy === 0}
                  <span class="disc-icon">✅</span>
                  <div>
                    <strong>Caja Cuadrada</strong>
                    <p class="disc-sub">El conteo físico coincide exactamente con el efectivo teórico esperado.</p>
                  </div>
                {:else if discrepancy < 0}
                  <span class="disc-icon">⚠️</span>
                  <div>
                    <strong>Faltante de Caja</strong>
                    <p class="disc-sub">Falta dinero físico respecto al cálculo teórico del turno.</p>
                  </div>
                {:else}
                  <span class="disc-icon">ℹ️</span>
                  <div>
                    <strong>Sobrante de Caja</strong>
                    <p class="disc-sub">Hay más efectivo físico en gaveta del computado en el sistema.</p>
                  </div>
                {/if}
              </div>
              <div class="discrepancy-value">
                Diferencia: <strong>{discrepancy > 0 ? '+' : ''}${discrepancy.toLocaleString()}</strong>
              </div>
            </div>

            <div class="form-group">
              <label for="close-notes">Observaciones de Cierre (Opcional)</label>
              <textarea
                id="close-notes"
                class="form-control"
                rows="2"
                bind:value={notes}
                placeholder="Ej: Justificación de diferencias, novedades del turno..."
              ></textarea>
            </div>
          </div>

          <footer class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick={onclose} disabled={isClosing}>
              Cancelar
            </button>
            <button type="submit" class="btn btn-primary btn-close-confirm" disabled={isClosing}>
              {#if isClosing}
                <Spinner size="18px" /> Procesando Arqueo...
              {:else}
                🔒 Confirmar Cierre de Caja
              {/if}
            </button>
          </footer>
        </form>
      {/if}
    {:else}
      <!-- ==========================================
           PRINTABLE CLOSING SUMMARY TICKET (R1)
           ========================================== -->
      <header class="modal-header no-print">
        <div class="header-info">
          <span class="header-icon">🧾</span>
          <div>
            <h2>Comprobante de Cierre de Turno</h2>
            <p class="header-sub">El turno ha sido cerrado y archivado satisfactoriamente.</p>
          </div>
        </div>
        <button type="button" class="close-modal-btn" onclick={onclose} aria-label="Cerrar modal">✕</button>
      </header>

      <div class="receipt-thermal-paper" id="closure-ticket">
        <div class="receipt-brand text-center">
          <h3 class="receipt-logo">NATURALE POS</h3>
          <p class="receipt-tagline">COMPROBANTE DE CIERRE DE CAJA</p>
          <p class="receipt-meta">Turno #{closedReport.shift?.id?.slice(0, 8).toUpperCase() || 'TURNO'}</p>
        </div>

        <div class="receipt-divider-dashed"></div>

        <div class="receipt-details">
          <div class="meta-row">
            <span>Cajero:</span>
            <strong>{closedReport.shift?.user?.name || $user?.name || 'Cajero'}</strong>
          </div>
          <div class="meta-row">
            <span>Apertura:</span>
            <span>{new Date(closedReport.shift?.openedAt).toLocaleString()}</span>
          </div>
          <div class="meta-row">
            <span>Cierre:</span>
            <span>{new Date(closedReport.shift?.closedAt || Date.now()).toLocaleString()}</span>
          </div>
        </div>

        <div class="receipt-divider-dashed"></div>

        <div class="receipt-summary-block">
          <div class="summary-line">
            <span>Base Inicial:</span>
            <span>${Number(closedReport.shift?.initialCash || 0).toLocaleString()}</span>
          </div>
          <div class="summary-line">
            <span>(+) Ventas Efectivo:</span>
            <span>${Number(closedReport.totals?.cashSales || 0).toLocaleString()}</span>
          </div>
          <div class="summary-line">
            <span>(-) Egresos en Efectivo:</span>
            <span>-${Number(closedReport.totals?.expenses || 0).toLocaleString()}</span>
          </div>
          <div class="receipt-divider-dashed"></div>
          <div class="summary-line font-bold">
            <span>Efectivo Esperado:</span>
            <span>${Number(closedReport.expectedCash || 0).toLocaleString()}</span>
          </div>
          <div class="summary-line font-bold">
            <span>Efectivo Real (Contado):</span>
            <span>${Number(closedReport.actualCash || 0).toLocaleString()}</span>
          </div>
          <div class="summary-line font-bold" style="color: {Number(closedReport.difference) < 0 ? '#c0392b' : Number(closedReport.difference) > 0 ? '#2980b9' : '#27ae60'};">
            <span>Diferencia (Arqueo):</span>
            <span>{Number(closedReport.difference) > 0 ? '+' : ''}${Number(closedReport.difference || 0).toLocaleString()}</span>
          </div>
        </div>

        <div class="receipt-divider-dashed"></div>

        <div class="other-payments-block">
          <p style="font-weight: 700; margin-bottom: 4px;">Otros Medios de Pago:</p>
          <div class="summary-line">
            <span>💳 Ventas Tarjeta:</span>
            <span>${Number(closedReport.totals?.cardSales || 0).toLocaleString()}</span>
          </div>
          <div class="summary-line">
            <span>📲 Transferencias:</span>
            <span>${Number(closedReport.totals?.transferSales || 0).toLocaleString()}</span>
          </div>
          <div class="summary-line font-bold" style="margin-top: 4px; border-top: 1px dotted #999; padding-top: 4px;">
            <span>TOTAL VENTAS DÍA:</span>
            <span>${(Number(closedReport.totals?.cashSales || 0) + Number(closedReport.totals?.cardSales || 0) + Number(closedReport.totals?.transferSales || 0)).toLocaleString()}</span>
          </div>
        </div>

        {#if closedReport.shift?.notes}
          <div class="receipt-divider-dashed"></div>
          <div class="notes-block">
            <span style="font-size: 0.75rem; color: #666;">Notas:</span>
            <p style="font-size: 0.8rem; margin: 2px 0 0 0;">{closedReport.shift.notes}</p>
          </div>
        {/if}

        <div class="receipt-divider-dashed"></div>
        <div class="signature-section" style="margin-top: 24px; text-align: center;">
          <div style="border-top: 1px solid #333; width: 60%; margin: 0 auto 6px auto;"></div>
          <p style="font-size: 0.75rem; color: #555;">Firma del Cajero Responsable</p>
        </div>
      </div>

      <footer class="modal-footer no-print">
        <button type="button" class="btn btn-secondary" onclick={onclose}>
          Listo / Salir
        </button>
        <button type="button" class="btn btn-secondary" onclick={printClosureTicket}>
          🖨️ Imprimir Ticket de Cierre
        </button>
        {#if onopennew}
          <button type="button" class="btn btn-primary" onclick={onopennew}>
            🚀 Abrir Nuevo Turno
          </button>
        {/if}
      </footer>
    {/if}
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

  .header-sub {
    font-size: 0.8rem;
    color: var(--text-secondary);
    margin: 2px 0 0 0;
  }

  .modal-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .shift-meta-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
  }

  .meta-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .meta-label {
    font-size: 0.72rem;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .breakdown-card {
    padding: 14px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .breakdown-card h4 {
    font-size: 0.85rem;
    font-weight: 600;
    margin: 0 0 4px 0;
    color: var(--text-secondary);
  }

  .breakdown-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
  }

  .breakdown-divider {
    border-top: 1px solid var(--border-glass);
    margin: 4px 0;
  }

  .expected-row {
    font-size: 0.95rem;
    font-weight: 700;
  }

  .expected-amount {
    color: var(--color-general);
    font-size: 1.05rem;
  }

  .input-with-symbol {
    position: relative;
    display: flex;
    align-items: center;
  }

  .currency-symbol {
    position: absolute;
    left: 14px;
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--color-general);
    pointer-events: none;
  }

  .cash-count-input {
    font-size: 1.3rem !important;
    font-weight: 700 !important;
    padding-left: 32px !important;
    color: var(--color-general) !important;
  }

  .discrepancy-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 14px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-glass);
    background: rgba(255, 255, 255, 0.03);
    transition: var(--transition-fast);
  }

  .discrepancy-card.cuadrado {
    background: rgba(46, 204, 113, 0.1);
    border-color: rgba(46, 204, 113, 0.3);
    color: #2ecc71;
  }

  .discrepancy-card.faltante {
    background: rgba(231, 76, 60, 0.12);
    border-color: rgba(231, 76, 60, 0.3);
    color: #e74c3c;
  }

  .discrepancy-card.sobrante {
    background: rgba(52, 152, 219, 0.12);
    border-color: rgba(52, 152, 219, 0.3);
    color: #3498db;
  }

  .discrepancy-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .disc-icon {
    font-size: 1.4rem;
  }

  .disc-sub {
    font-size: 0.75rem;
    margin: 2px 0 0 0;
    color: var(--text-secondary);
  }

  .discrepancy-value {
    font-size: 1rem;
    white-space: nowrap;
  }

  .btn-close-confirm {
    flex: 1;
  }

  /* Thermal Receipt Style */
  .receipt-thermal-paper {
    background: #ffffff;
    color: #1a1a1a;
    padding: 24px 20px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 0.85rem;
    line-height: 1.4;
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  }

  .receipt-brand h3 {
    font-size: 1.15rem;
    font-weight: 800;
    margin: 0 0 2px 0;
    letter-spacing: 1px;
    color: #111;
  }

  .receipt-tagline {
    font-size: 0.75rem;
    color: #555;
    margin: 0;
  }

  .receipt-meta {
    font-size: 0.7rem;
    color: #777;
    margin: 2px 0 0 0;
  }

  .receipt-divider-dashed {
    border-top: 1px dashed #999;
    margin: 10px 0;
  }

  .receipt-details .meta-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.82rem;
    margin-bottom: 2px;
  }

  .summary-line {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    margin-bottom: 3px;
  }

  .font-bold {
    font-weight: 700;
  }

  @media print {
    :global(body *) {
      visibility: hidden;
    }

    #closure-ticket, #closure-ticket * {
      visibility: visible;
    }

    #closure-ticket {
      position: absolute;
      left: 0;
      top: 0;
      width: 80mm;
      box-shadow: none;
      padding: 0;
      margin: 0;
    }

    .no-print {
      display: none !important;
    }
  }
</style>
