<script lang="ts">
  import { openShift, getCurrentShift } from '../../api/shifts';
  import { currentShift, triggerRefresh, user } from '../../store';
  import Spinner from '../atoms/Spinner.svelte';

  interface Props {
    onclose?: () => void;
    onsuccess?: (shift: any) => void;
  }

  let { onclose, onsuccess }: Props = $props();

  let initialCash = $state<number | string>(50000);
  let notes = $state('');
  let isLoading = $state(false);
  let errorMessage = $state('');

  const quickBases = [0, 30000, 50000, 100000, 150000, 200000];

  function setQuickBase(val: number) {
    initialCash = val;
    errorMessage = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && onclose) {
      onclose();
    }
  }

  const currentDateString = new Date().toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  const currentTimeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  async function handleOpenShift(e: SubmitEvent) {
    e.preventDefault();
    const amount = Number(initialCash);
    if (isNaN(amount) || amount < 0) {
      errorMessage = 'El monto base inicial no puede ser negativo.';
      return;
    }

    isLoading = true;
    errorMessage = '';

    try {
      const res = await openShift(amount, notes.trim() || undefined);
      // Update global store
      const refreshed = await getCurrentShift().catch(() => ({ shift: res.shift, realTimeTotals: null }));
      currentShift.set(refreshed);
      triggerRefresh();
      onsuccess?.(res.shift);
      onclose?.();
    } catch (err: any) {
      console.error('Error opening shift:', err);
      errorMessage = err.message || 'Error al abrir el turno de caja.';
    } finally {
      isLoading = false;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-overlay flex-center animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="open-shift-title">
  <div class="modal-container glass-panel animate-scale-up open-shift-dialog" style="max-width: 480px;">
    <!-- Top Decorative Line -->
    <div class="dialog-accent-bar"></div>

    <header class="modal-header">
      <div class="header-main">
        <div class="header-icon-badge">
          <span class="badge-emoji">🌿</span>
          <div class="badge-glow"></div>
        </div>
        <div class="header-text-group">
          <div class="header-pretitle">NATURALE POS • CAJA REGISTRADORA</div>
          <h2 id="open-shift-title">Apertura de Turno</h2>
          <p class="header-sub">Establece la base de efectivo en gaveta para comenzar</p>
        </div>
      </div>
      {#if onclose}
        <button
          type="button"
          class="close-modal-btn"
          onclick={onclose}
          aria-label="Cerrar modal de apertura"
          title="Cerrar (Esc)"
        >
          ✕
        </button>
      {/if}
    </header>

    <form onsubmit={handleOpenShift}>
      <div class="modal-body">
        {#if errorMessage}
          <div class="error-banner animate-fade-in" role="alert">
            <span class="error-icon">⚠️</span>
            <span>{errorMessage}</span>
          </div>
        {/if}

        <!-- Cashier Information Banner -->
        <div class="cashier-strip">
          <div class="cashier-avatar-col">
            <div class="cashier-avatar">
              {($user?.name || 'C')[0].toUpperCase()}
            </div>
            <div class="status-indicator-dot" title="Listo para iniciar jornada"></div>
          </div>
          <div class="cashier-details">
            <span class="cashier-sub">Cajero Responsable</span>
            <div class="cashier-name-row">
              <strong class="cashier-name">{$user?.name || 'Cajero de Turno'}</strong>
              <span class="role-pill">{$user?.role || 'CAJERO'}</span>
            </div>
          </div>
          <div class="shift-time-chip">
            <span class="clock-icon">🕒</span>
            <div class="time-texts">
              <span class="date-text">{currentDateString}</span>
              <span class="time-text">{currentTimeString}</span>
            </div>
          </div>
        </div>

        <!-- Hero Base Input Card -->
        <div class="cash-card">
          <div class="cash-card-header">
            <div class="cash-card-title-group">
              <span class="cash-icon-tag">💵</span>
              <div>
                <label for="initial-cash-input" class="cash-label">Base Inicial en Efectivo</label>
                <p id="initial-cash-helper" class="cash-helper">Efectivo físico presente en la gaveta para cambio</p>
              </div>
            </div>
            <span class="required-badge">Requerido</span>
          </div>

          <div class="input-container">
            <span class="currency-symbol">$</span>
            <input
              id="initial-cash-input"
              type="number"
              min="0"
              step="any"
              class="cash-input"
              bind:value={initialCash}
              placeholder="0"
              aria-describedby="initial-cash-helper"
              required
              onfocus={(e) => e.currentTarget.select()}
            />
          </div>

          {#if Number(initialCash) >= 0}
            <div class="amount-preview-row">
              <span class="preview-label">Monto a registrar:</span>
              <span class="preview-amount">${Number(initialCash || 0).toLocaleString()} COP</span>
            </div>
          {/if}

          <!-- Quick Base Selection Pills -->
          {#snippet quickPill(baseVal: number)}
            <button
              type="button"
              class="base-pill"
              class:selected={Number(initialCash) === baseVal}
              class:zero-pill={baseVal === 0}
              aria-pressed={Number(initialCash) === baseVal}
              onclick={() => setQuickBase(baseVal)}
            >
              {#if Number(initialCash) === baseVal}
                <span class="pill-check" aria-hidden="true">✓</span>
              {/if}
              {baseVal === 0 ? 'Sin Base ($0)' : `$${baseVal.toLocaleString()}`}
            </button>
          {/snippet}

          <div class="quick-base-section">
            <span class="quick-label">Sugerencias Rápidas:</span>
            <div class="quick-pills-grid">
              {#each quickBases as baseVal}
                {@render quickPill(baseVal)}
              {/each}
            </div>
          </div>
        </div>

        <!-- Optional Notes -->
        <div class="notes-card">
          <label for="shift-notes" class="field-label">
            <span>📝 Observaciones Iniciales</span>
            <span class="optional-tag">Opcional</span>
          </label>
          <textarea
            id="shift-notes"
            class="notes-textarea"
            rows="1"
            bind:value={notes}
            placeholder="Ej. Billetes de $2.000 y $5.000 para cambio, monedas en bandeja..."
          ></textarea>
        </div>
      </div>

      <footer class="modal-footer">
        {#if onclose}
          <button type="button" class="btn btn-secondary btn-cancel" onclick={onclose} disabled={isLoading}>
            Cancelar
          </button>
        {/if}
        <button type="submit" class="btn btn-primary btn-open-confirm" disabled={isLoading}>
          {#if isLoading}
            <Spinner size="18px" /> Abriendo Turno...
          {:else}
            <span>🚀 Abrir Caja y Comenzar</span>
          {/if}
        </button>
      </footer>
    </form>
  </div>
</div>

<style>
  .open-shift-dialog {
    border: 1px solid rgba(16, 185, 129, 0.28);
    box-shadow: 0 20px 50px -15px rgba(4, 120, 87, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.5) inset;
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
    background: linear-gradient(90deg, #059669, #10b981, #34d399, #10b981);
    background-size: 200% 100%;
    flex-shrink: 0;
  }

  .modal-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 18px;
    background: linear-gradient(180deg, rgba(16, 185, 129, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%);
    border-bottom: 1px solid rgba(16, 185, 129, 0.15);
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
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.08));
    border: 1px solid rgba(16, 185, 129, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.7);
    flex-shrink: 0;
  }

  .badge-emoji {
    z-index: 1;
  }

  .badge-glow {
    position: absolute;
    inset: 2px;
    border-radius: 8px;
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
    color: var(--color-general);
  }

  .modal-header h2 {
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
    letter-spacing: -0.015em;
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

  .cashier-strip {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.65);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
  }

  .cashier-avatar-col {
    position: relative;
  }

  .cashier-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--color-general), var(--color-market));
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.88rem;
  }

  .status-indicator-dot {
    position: absolute;
    bottom: -1px;
    right: -1px;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #10b981;
    border: 1.5px solid white;
  }

  .cashier-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .cashier-sub {
    font-size: 0.68rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }

  .cashier-name-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .cashier-name {
    font-size: 0.88rem;
    color: var(--text-primary);
  }

  .role-pill {
    font-size: 0.65rem;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(16, 185, 129, 0.12);
    color: var(--color-general);
    border: 1px solid rgba(16, 185, 129, 0.25);
  }

  .shift-time-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(0, 0, 0, 0.03);
    border: 1px solid var(--border-glass);
    padding: 4px 8px;
    border-radius: 6px;
  }

  .clock-icon {
    font-size: 0.95rem;
  }

  .time-texts {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    line-height: 1.15;
  }

  .date-text {
    font-size: 0.68rem;
    color: var(--text-muted);
    text-transform: capitalize;
  }

  .time-text {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--text-secondary);
  }

  .cash-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.75);
    border: 1.5px solid rgba(16, 185, 129, 0.3);
    border-radius: var(--radius-md);
  }

  .cash-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .cash-card-title-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .cash-icon-tag {
    font-size: 1.2rem;
  }

  .cash-label {
    font-size: 0.88rem;
    font-weight: 700;
    color: var(--text-primary);
    display: block;
    margin: 0;
  }

  .cash-helper {
    font-size: 0.74rem;
    color: var(--text-muted);
    margin: 0;
  }

  .required-badge {
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--color-general);
    background: rgba(16, 185, 129, 0.1);
    padding: 1px 6px;
    border-radius: 4px;
    border: 1px solid rgba(16, 185, 129, 0.25);
  }

  .input-container {
    position: relative;
    display: flex;
    align-items: center;
  }

  .currency-symbol {
    position: absolute;
    left: 14px;
    font-size: 1.4rem;
    font-weight: 800;
    color: var(--color-general);
    pointer-events: none;
    user-select: none;
  }

  .cash-input {
    width: 100%;
    font-size: 1.45rem !important;
    font-weight: 800 !important;
    padding-left: 36px !important;
    padding-top: 8px !important;
    padding-bottom: 8px !important;
    color: var(--color-general) !important;
    background: rgba(255, 255, 255, 0.95) !important;
    border: 2px solid rgba(16, 185, 129, 0.35) !important;
    border-radius: var(--radius-sm) !important;
    box-shadow: 0 1px 4px rgba(16, 185, 129, 0.08) !important;
    letter-spacing: 0.02em;
    font-family: inherit;
  }

  .cash-input:focus {
    border-color: var(--color-general) !important;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.22) !important;
    background: #ffffff !important;
  }

  .amount-preview-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 3px 8px;
    background: rgba(16, 185, 129, 0.08);
    border-radius: 4px;
    border: 1px dashed rgba(16, 185, 129, 0.3);
  }

  .preview-label {
    font-size: 0.72rem;
    color: var(--text-muted);
  }

  .preview-amount {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--color-general);
  }

  .quick-base-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 1px;
  }

  .quick-label {
    font-size: 0.7rem;
    color: var(--text-muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .quick-pills-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .base-pill {
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 14px;
    padding: 5px 10px;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
    display: inline-flex;
    align-items: center;
    gap: 3px;
    user-select: none;
  }

  .base-pill:hover {
    background: rgba(16, 185, 129, 0.12);
    border-color: var(--color-general);
    color: var(--color-general);
    transform: translateY(-1px);
  }

  .base-pill.selected {
    background: var(--color-general);
    border-color: var(--color-general);
    color: white;
    box-shadow: 0 2px 8px rgba(4, 120, 87, 0.3);
  }

  .base-pill.zero-pill {
    color: var(--text-muted);
    border-style: dashed;
  }
  .base-pill.zero-pill.selected {
    background: #64748b;
    border-color: #64748b;
    color: white;
    box-shadow: 0 2px 6px rgba(100, 116, 139, 0.3);
  }

  .pill-check {
    font-size: 0.72rem;
    font-weight: 800;
  }

  .notes-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .optional-tag {
    font-size: 0.68rem;
    color: var(--text-muted);
    font-weight: normal;
  }

  .notes-textarea {
    border-radius: var(--radius-sm);
    resize: none;
    font-size: 0.82rem;
    background: rgba(255, 255, 255, 0.75);
    border: 1px solid var(--border-glass);
    padding: 6px 10px;
    line-height: 1.35;
    min-height: 40px;
    height: 40px;
  }
  .notes-textarea:focus {
    background: #ffffff;
    border-color: var(--color-general);
  }

  .modal-footer {
    flex-shrink: 0;
    padding: 12px 18px;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    border-top: 1px solid var(--border-glass);
    background: rgba(255, 255, 255, 0.03);
  }

  .btn-cancel {
    height: 38px;
    padding: 0 16px;
    font-size: 0.88rem;
    font-weight: 500;
  }

  .btn-open-confirm {
    flex: 1;
    height: 38px;
    font-size: 0.92rem;
    font-weight: 700;
    background: linear-gradient(135deg, #059669, #10b981);
    box-shadow: 0 3px 10px rgba(4, 120, 87, 0.3);
    border-radius: var(--radius-sm);
  }
  .btn-open-confirm:hover:not(:disabled) {
    background: linear-gradient(135deg, #047857, #059669);
    box-shadow: 0 4px 14px rgba(4, 120, 87, 0.35);
    transform: translateY(-1px);
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: var(--radius-sm);
    color: #ef4444;
    font-size: 0.82rem;
    font-weight: 500;
  }
  .error-icon {
    font-size: 1rem;
  }
</style>
