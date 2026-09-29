<script lang="ts">
  import { onMount } from 'svelte';
  import { closeShift, getCurrentShift } from '../../api/shifts';
  import { currentShift, triggerRefresh, user } from '../../store';
  import Spinner from '../atoms/Spinner.svelte';
  import { printThermalReceipt } from '../../services/printer';

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

  // Fetch current live totals once on mount
  onMount(() => {
    if (shiftData?.shift) {
      activeShift = shiftData.shift;
      totals = shiftData.realTimeTotals;
      if (totals) {
        isLoadingData = false;
        actualCash = totals.expectedCash;
        return;
      }
    }

    getCurrentShift()
      .then((data) => {
        activeShift = data.shift;
        totals = data.realTimeTotals;
        if (totals) {
          actualCash = totals.expectedCash;
        }
      })
      .catch((e) => {
        errorMessage = e.message || 'Error al cargar los datos del turno activo.';
      })
      .finally(() => {
        isLoadingData = false;
      });
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
    printThermalReceipt('closure-ticket');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onclose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-overlay flex-center animate-fade-in" role="dialog" aria-modal="true" aria-labelledby={closedReport ? 'receipt-title' : 'close-shift-title'}>
  <div class="modal-container glass-panel animate-scale-up printable-modal close-shift-dialog" style="max-width: 530px;">
    <!-- If not yet closed, show Guided Arqueo Form -->
    {#if !closedReport}
      <div class="dialog-accent-bar amber"></div>
      <header class="modal-header">
        <div class="header-main">
          <div class="header-icon-badge amber">
            <span class="badge-emoji">🔒</span>
            <div class="badge-glow amber"></div>
          </div>
          <div class="header-text-group">
            <div class="header-pretitle amber">FIN DE JORNADA • ARQUEO DE CAJA</div>
            <h2 id="close-shift-title">Cierre de Turno & Arqueo</h2>
            <p class="header-sub">Verifica el efectivo físico en gaveta y genera el balance del turno</p>
          </div>
        </div>
        <button
          type="button"
          class="close-modal-btn"
          onclick={onclose}
          aria-label="Cerrar modal de cierre"
          title="Cerrar (Esc)"
        >
          ✕
        </button>
      </header>

      {#if isLoadingData}
        <div class="loading-state flex-center" style="padding: 40px 0;">
          <Spinner size="36px" />
          <p style="margin-top: 10px; color: var(--text-secondary);">Calculando totales de caja en tiempo real...</p>
        </div>
      {:else if !activeShift}
        <div class="modal-body">
          <div class="error-banner animate-fade-in" role="alert">
            ⚠️ No hay ningún turno de caja abierto actualmente para cerrar.
          </div>
        </div>
        <footer class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick={onclose}>Cerrar</button>
        </footer>
      {:else}
        {#snippet metaCard(icon: string, label: string, value: string, extraClass: string = '')}
          <div class="meta-card">
            <span class="meta-icon">{icon}</span>
            <div class="meta-col">
              <span class="meta-label">{label}</span>
              <strong class="meta-val {extraClass}">{value}</strong>
            </div>
          </div>
        {/snippet}

        <form onsubmit={handleCloseShift}>
          <div class="modal-body">
            {#if errorMessage}
              <div class="error-banner animate-fade-in" role="alert">
                ⚠️ {errorMessage}
              </div>
            {/if}

            <!-- Cashier & Opening Info -->
            <div class="shift-meta-cards">
              {@render metaCard('👤', 'Cajero', activeShift.user?.name || $user?.name || 'Cajero')}
              {@render metaCard('🕒', 'Apertura', new Date(activeShift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}
              {@render metaCard('💵', 'Base Inicial', `$${Number(activeShift.initialCash).toLocaleString()}`, 'text-general')}
            </div>

            <!-- Financial Breakdown Card -->
            <div class="breakdown-card">
              <div class="breakdown-header">
                <h4>Movimientos Registrados en Turno</h4>
              </div>
              <div class="breakdown-list">
                <div class="breakdown-row">
                  <span class="row-label">💵 Ventas en Efectivo:</span>
                  <strong class="text-general">+${Number(totals?.cashSales || 0).toLocaleString()}</strong>
                </div>
                <div class="breakdown-row">
                  <span class="row-label">💳 Ventas con Tarjeta:</span>
                  <span>${Number(totals?.cardSales || 0).toLocaleString()}</span>
                </div>
                <div class="breakdown-row">
                  <span class="row-label">📲 Ventas Transferencia:</span>
                  <span>${Number(totals?.transferSales || 0).toLocaleString()}</span>
                </div>
                {#if Number(totals?.internalSales || 0) > 0}
                  <div class="breakdown-row">
                    <span class="row-label">🔄 Consumo Interno:</span>
                    <span>${Number(totals.internalSales).toLocaleString()}</span>
                  </div>
                {/if}
                {#if Number(totals?.expenses || 0) > 0}
                  <div class="breakdown-row text-danger">
                    <span class="row-label">💸 Egresos en Efectivo:</span>
                    <strong>-${Number(totals?.expenses || 0).toLocaleString()}</strong>
                  </div>
                {/if}
              </div>

              <div class="expected-highlight-box">
                <div class="expected-text">
                  <span class="expected-label">Efectivo Teórico Esperado:</span>
                  <span class="expected-sub">(Base + Efectivo - Egresos)</span>
                </div>
                <strong class="expected-amount">${expectedCash.toLocaleString()}</strong>
              </div>
            </div>

            <!-- Physical Count Input (Arqueo) -->
            <div class="form-group cash-count-group">
              <label for="actual-cash-input" class="field-label">
                <span>Efectivo Físico Contado en Gaveta</span>
                <span class="required-tag">* Requerido</span>
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
                />
              </div>
            </div>

            <!-- Real-Time Discrepancy Assessment -->
            <div class="discrepancy-card" class:cuadrado={discrepancy === 0} class:faltante={discrepancy < 0} class:sobrante={discrepancy > 0} aria-live="polite">
              <div class="discrepancy-header">
                {#if discrepancy === 0}
                  <span class="disc-icon">✅</span>
                  <div>
                    <strong>Caja Cuadrada</strong>
                    <p class="disc-sub">El conteo físico coincide exactamente con el cálculo teórico del turno.</p>
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
              <div class="discrepancy-badge">
                <span>Diferencia:</span>
                <strong>{discrepancy > 0 ? '+' : ''}${discrepancy.toLocaleString()}</strong>
              </div>
            </div>

            <div class="form-group">
              <label for="close-notes" class="field-label">Observaciones de Cierre (Opcional)</label>
              <textarea
                id="close-notes"
                class="form-control notes-textarea"
                rows="2"
                bind:value={notes}
                placeholder="Ej: Justificación de diferencias, novedades del turno..."
              ></textarea>
            </div>
          </div>

          <footer class="modal-footer">
            <button type="button" class="btn btn-secondary btn-cancel" onclick={onclose} disabled={isClosing}>
              Cancelar
            </button>
            <button type="submit" class="btn btn-primary btn-close-confirm" disabled={isClosing}>
              {#if isClosing}
                <Spinner size="18px" /> Procesando Arqueo...
              {:else}
                🔒 Confirmar y Cerrar Caja
              {/if}
            </button>
          </footer>
        </form>
      {/if}
    {:else}
      <!-- ==========================================
           PRINTABLE CLOSING SUMMARY TICKET (R1)
           ========================================== -->
      <div class="dialog-accent-bar green"></div>
      <header class="modal-header no-print">
        <div class="header-main">
          <div class="header-icon-badge green">
            <span class="badge-emoji">🧾</span>
            <div class="badge-glow green"></div>
          </div>
          <div class="header-text-group">
            <div class="header-pretitle">COMPROBANTE FINAL REGISTRADO</div>
            <h2 id="receipt-title">Comprobante de Cierre</h2>
            <p class="header-sub">El turno ha sido cerrado y registrado exitosamente en el sistema</p>
          </div>
        </div>
        <button
          type="button"
          class="close-modal-btn"
          onclick={onclose}
          aria-label="Cerrar comprobante"
          title="Cerrar (Esc)"
        >
          ✕
        </button>
      </header>

      <div class="receipt-thermal-paper" id="closure-ticket">
        <div class="receipt-brand text-center">
          <h3 class="receipt-logo">🌿 NATURALE</h3>
          <p class="receipt-tagline">Mercado Saludable & Café</p>
          <div class="ticket-type-pill">COMPROBANTE DE CIERRE DE CAJA</div>
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
          <div class="summary-line font-bold" style="color: {Number(closedReport.difference) < 0 ? '#be123c' : Number(closedReport.difference) > 0 ? '#1d4ed8' : '#15803d'}; font-size: 0.95rem; margin-top: 4px;">
            <span>Diferencia (Arqueo):</span>
            <span>{Number(closedReport.difference) > 0 ? '+' : ''}${Number(closedReport.difference || 0).toLocaleString()}</span>
          </div>
        </div>

        <div class="receipt-divider-dashed"></div>

        <div class="other-payments-block">
          <p style="font-weight: 700; margin-bottom: 4px; font-size: 0.8rem; color: #555;">Otros Medios de Pago:</p>
          <div class="summary-line">
            <span>💳 Ventas Tarjeta:</span>
            <span>${Number(closedReport.totals?.cardSales || 0).toLocaleString()}</span>
          </div>
          <div class="summary-line">
            <span>📲 Transferencias:</span>
            <span>${Number(closedReport.totals?.transferSales || 0).toLocaleString()}</span>
          </div>
          <div class="summary-line font-bold" style="margin-top: 6px; border-top: 1px dotted #ccc; padding-top: 6px; font-size: 0.95rem;">
            <span>TOTAL VENTAS DEL TURNO:</span>
            <span>${(Number(closedReport.totals?.cashSales || 0) + Number(closedReport.totals?.cardSales || 0) + Number(closedReport.totals?.transferSales || totals?.transferSales || 0)).toLocaleString()}</span>
          </div>
        </div>

        {#if closedReport.shift?.notes}
          <div class="receipt-divider-dashed"></div>
          <div class="notes-block">
            <span style="font-size: 0.75rem; color: #666; font-weight: 600;">Notas del Turno:</span>
            <p style="font-size: 0.8rem; margin: 2px 0 0 0; color: #333;">{closedReport.shift.notes}</p>
          </div>
        {/if}

        <div class="receipt-divider-dashed"></div>
        <div class="signature-section" style="margin-top: 24px; text-align: center;">
          <div style="border-top: 1px solid #777; width: 60%; margin: 0 auto 6px auto;"></div>
          <p style="font-size: 0.75rem; color: #666; font-weight: 500;">Firma del Cajero Responsable</p>
        </div>
      </div>

      <footer class="modal-footer no-print">
        <button type="button" class="btn btn-secondary btn-cancel" onclick={onclose}>
          Listo / Salir
        </button>
        <button type="button" class="btn btn-secondary" onclick={printClosureTicket}>
          🖨️ Imprimir Ticket
        </button>
        {#if onopennew}
          <button type="button" class="btn btn-primary btn-new-shift" onclick={onopennew}>
            🚀 Abrir Nuevo Turno
          </button>
        {/if}
      </footer>
    {/if}
  </div>
</div>

<style>
  .close-shift-dialog {
    border: 1px solid rgba(245, 158, 11, 0.28);
    box-shadow: 0 20px 50px -15px rgba(217, 119, 6, 0.22), 0 0 0 1px rgba(255, 255, 255, 0.5) inset;
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(28px);
    -webkit-backdrop-filter: blur(28px);
    max-height: calc(100vh - 40px);
    display: flex;
    flex-direction: column;
  }

  .dialog-accent-bar {
    height: 3px;
    width: 100%;
    flex-shrink: 0;
    background: linear-gradient(90deg, #f59e0b, #d97706, #fbbf24);
  }
  .dialog-accent-bar.green {
    background: linear-gradient(90deg, #059669, #10b981, #34d399);
  }

  .modal-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 18px;
    background: linear-gradient(180deg, rgba(245, 158, 11, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%);
    border-bottom: 1px solid rgba(245, 158, 11, 0.15);
    position: relative;
  }

  .header-main {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-icon-badge {
    position: relative;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    flex-shrink: 0;
  }
  .header-icon-badge.amber {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.22), rgba(217, 119, 6, 0.08));
    border: 1px solid rgba(245, 158, 11, 0.4);
    box-shadow: 0 4px 14px rgba(245, 158, 11, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.7);
  }
  .header-icon-badge.green {
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.22), rgba(5, 150, 105, 0.08));
    border: 1px solid rgba(16, 185, 129, 0.4);
    box-shadow: 0 4px 14px rgba(16, 185, 129, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.7);
  }

  .badge-emoji {
    z-index: 1;
  }

  .badge-glow {
    position: absolute;
    inset: 2px;
    border-radius: 8px;
    background: radial-gradient(circle, rgba(245, 158, 11, 0.3) 0%, transparent 70%);
  }
  .badge-glow.green {
    background: radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, transparent 70%);
  }

  .header-text-group {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .header-pretitle {
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-market);
  }
  .header-pretitle.amber {
    color: #d97706;
  }

  .modal-header h2 {
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
    line-height: 1.2;
  }

  .header-sub {
    font-size: 0.78rem;
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.2;
  }

  .close-modal-btn {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.04);
    border: 1px solid var(--border-glass);
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.88rem;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    flex-shrink: 0;
    outline: none;
    padding: 0;
  }

  .close-modal-btn:hover {
    background: rgba(239, 68, 68, 0.12);
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.25);
    transform: rotate(90deg) scale(1.08);
  }

  form {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .modal-body {
    padding: 14px 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    -webkit-overflow-scrolling: touch;
  }

  .shift-meta-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .meta-card {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.6);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
  }

  .meta-icon {
    font-size: 1.2rem;
  }

  .meta-col {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .meta-label {
    font-size: 0.7rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
  }

  .meta-val {
    font-size: 0.85rem;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .breakdown-card {
    padding: 16px;
    background: rgba(255, 255, 255, 0.6);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .breakdown-header h4 {
    font-size: 0.88rem;
    font-weight: 700;
    margin: 0;
    color: var(--text-primary);
  }

  .breakdown-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .breakdown-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.86rem;
  }

  .row-label {
    color: var(--text-secondary);
  }

  .expected-highlight-box {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 14px;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(4, 120, 87, 0.05));
    border: 1.5px solid rgba(16, 185, 129, 0.35);
    border-radius: var(--radius-sm);
    margin-top: 4px;
  }

  .expected-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .expected-label {
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .expected-sub {
    font-size: 0.72rem;
    color: var(--text-muted);
  }

  .expected-amount {
    font-size: 1.35rem;
    font-weight: 800;
    color: var(--color-market);
  }

  .cash-count-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px;
    background: rgba(255, 255, 255, 0.55);
    border: 1.5px solid rgba(16, 185, 129, 0.25);
    border-radius: var(--radius-md);
  }

  .field-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .required-tag {
    font-size: 0.74rem;
    color: var(--color-market);
    font-weight: 500;
  }

  .input-with-symbol {
    position: relative;
    display: flex;
    align-items: center;
  }

  .currency-symbol {
    position: absolute;
    left: 14px;
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--color-general);
    pointer-events: none;
  }

  .cash-count-input {
    font-size: 1.5rem !important;
    font-weight: 700 !important;
    padding-left: 36px !important;
    padding-top: 8px !important;
    padding-bottom: 8px !important;
    color: var(--color-general) !important;
    background: rgba(255, 255, 255, 0.85) !important;
    border: 1.5px solid rgba(16, 185, 129, 0.3) !important;
    border-radius: var(--radius-sm) !important;
  }
  .cash-count-input:focus {
    border-color: var(--color-general) !important;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2) !important;
  }

  .discrepancy-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-radius: var(--radius-sm);
    border: 1.5px solid var(--border-glass);
    background: rgba(255, 255, 255, 0.6);
    transition: var(--transition-fast);
  }

  .discrepancy-card.cuadrado {
    background: rgba(16, 185, 129, 0.12);
    border-color: rgba(16, 185, 129, 0.4);
    color: #15803d;
  }

  .discrepancy-card.faltante {
    background: rgba(244, 63, 94, 0.12);
    border-color: rgba(244, 63, 94, 0.4);
    color: var(--color-danger);
  }

  .discrepancy-card.sobrante {
    background: rgba(59, 130, 246, 0.12);
    border-color: rgba(59, 130, 246, 0.4);
    color: #2563eb;
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
    font-size: 0.76rem;
    margin: 2px 0 0 0;
    opacity: 0.9;
  }

  .discrepancy-badge {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    font-size: 0.8rem;
  }
  .discrepancy-badge strong {
    font-size: 1.1rem;
    font-weight: 800;
  }

  .notes-textarea {
    border-radius: var(--radius-sm);
    resize: none;
    font-size: 0.88rem;
    background: rgba(255, 255, 255, 0.6);
  }

  .modal-footer {
    flex-shrink: 0;
    padding: 12px 18px;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    border-top: 1px solid var(--border-glass);
    background: rgba(255, 255, 255, 0.02);
  }

  .btn-cancel {
    height: 38px;
    padding: 0 16px;
    font-size: 0.88rem;
    font-weight: 500;
  }

  .btn-close-confirm {
    flex: 1;
    height: 38px;
    font-size: 0.92rem;
    font-weight: 700;
    box-shadow: 0 3px 10px rgba(4, 120, 87, 0.25);
  }

  .btn-new-shift {
    height: 38px;
    font-size: 0.88rem;
    font-weight: 600;
  }

  /* Thermal Receipt Style */
  .receipt-thermal-paper {
    background: #ffffff;
    color: #1a1a1a;
    padding: 18px 20px;
    font-family: var(--font-sans);
    font-size: 0.86rem;
    line-height: 1.45;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    -webkit-overflow-scrolling: touch;
    border-radius: var(--radius-sm);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    border: 1px solid rgba(0, 0, 0, 0.08);
  }

  .receipt-brand h3 {
    font-size: 1.2rem;
    font-weight: 800;
    margin: 0 0 2px 0;
    letter-spacing: 0.5px;
    color: #112217;
  }

  .receipt-tagline {
    font-size: 0.78rem;
    color: #555;
    margin: 0;
  }

  .ticket-type-pill {
    display: inline-block;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.5px;
    background: #f1f5f9;
    color: #334155;
    padding: 2px 8px;
    border-radius: 4px;
    margin: 6px 0 2px 0;
  }

  .receipt-meta {
    font-size: 0.72rem;
    color: #777;
    margin: 2px 0 0 0;
  }

  .receipt-divider-dashed {
    border-top: 1px dashed #cbd5e1;
    margin: 10px 0;
  }

  .receipt-details .meta-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.82rem;
    margin-bottom: 3px;
    color: #334155;
  }

  .summary-line {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    margin-bottom: 4px;
    color: #334155;
  }

  .font-bold {
    font-weight: 700;
    color: #0f172a;
  }

  .error-banner {
    padding: 10px 14px;
    background: rgba(231, 76, 60, 0.12);
    border: 1px solid rgba(231, 76, 60, 0.3);
    border-radius: var(--radius-sm);
    color: #e74c3c;
    font-size: 0.88rem;
    font-weight: 500;
  }

  @media print {
    #closure-ticket {
      display: block !important;
      position: static !important;
      width: 72mm !important;
      max-width: 72mm !important;
      margin: 0 auto !important;
      box-shadow: none !important;
      padding: 2mm 2mm 15mm 2mm !important;
      visibility: visible !important;
    }

    .no-print {
      display: none !important;
    }
  }
</style>
