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

  const quickBases = [30000, 50000, 100000, 150000, 200000];

  function setQuickBase(val: number) {
    initialCash = val;
    errorMessage = '';
  }

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

<div class="modal-overlay flex-center animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="open-shift-title">
  <div class="modal-container glass-panel animate-scale-up open-shift-dialog" style="max-width: 490px;">
    <header class="modal-header">
      <div class="header-content">
        <div class="header-icon-badge">
          <span>🌿</span>
        </div>
        <div>
          <h2 id="open-shift-title">Apertura de Turno</h2>
          <p class="header-sub">Establece la base de efectivo para comenzar a operar.</p>
        </div>
      </div>
      {#if onclose}
        <button type="button" class="close-modal-btn" onclick={onclose} aria-label="Cerrar modal">✕</button>
      {/if}
    </header>

    <form onsubmit={handleOpenShift}>
      <div class="modal-body">
        {#if errorMessage}
          <div class="error-banner animate-fade-in" role="alert">
            ⚠️ {errorMessage}
          </div>
        {/if}

        <div class="cashier-card">
          <div class="cashier-avatar">
            {($user?.name || 'C')[0].toUpperCase()}
          </div>
          <div class="cashier-meta">
            <span class="cashier-label">Cajero Responsable</span>
            <strong class="cashier-name">{$user?.name || 'Cajero de Turno'}</strong>
          </div>
          <div class="shift-time-badge">
            <span>🕒 {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        <div class="cash-card">
          <label for="initial-cash-input" class="cash-label">
            <span>Base Inicial en Efectivo</span>
            <span class="required-indicator">* Requerido</span>
          </label>
          <div class="input-with-symbol">
            <span class="currency-symbol">$</span>
            <input
              id="initial-cash-input"
              type="number"
              min="0"
              step="any"
              class="form-control cash-input"
              bind:value={initialCash}
              placeholder="0"
              required
            />
          </div>
          <div class="quick-base-group">
            <span class="quick-label">Montos Rápidos:</span>
            <div class="quick-pills">
              {#each quickBases as baseVal}
                <button
                  type="button"
                  class="base-pill"
                  class:selected={Number(initialCash) === baseVal}
                  onclick={() => setQuickBase(baseVal)}
                >
                  ${baseVal.toLocaleString()}
                </button>
              {/each}
            </div>
          </div>
        </div>

        <div class="form-group">
          <label for="shift-notes" class="field-label">Notas u Observaciones (Opcional)</label>
          <textarea
            id="shift-notes"
            class="form-control notes-textarea"
            rows="2"
            bind:value={notes}
            placeholder="Ej: Billetes sencillos en gaveta, monedas para cambio..."
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
            🚀 Abrir Caja y Comenzar Turno
          {/if}
        </button>
      </footer>
    </form>
  </div>
</div>

<style>
  .open-shift-dialog {
    border: 1px solid rgba(16, 185, 129, 0.25);
    box-shadow: 0 20px 40px -15px rgba(4, 120, 87, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.4) inset;
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .header-icon-badge {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.08));
    border: 1px solid rgba(16, 185, 129, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    box-shadow: 0 4px 10px rgba(16, 185, 129, 0.15);
  }

  .header-content h2 {
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
  }

  .header-sub {
    font-size: 0.82rem;
    color: var(--text-secondary);
    margin: 2px 0 0 0;
  }

  .modal-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .cashier-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.55);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
  }

  .cashier-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--color-general), var(--color-market));
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.95rem;
    box-shadow: 0 2px 6px rgba(4, 120, 87, 0.25);
  }

  .cashier-meta {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .cashier-label {
    font-size: 0.72rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
  }

  .cashier-name {
    font-size: 0.92rem;
    color: var(--text-primary);
  }

  .shift-time-badge {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--text-secondary);
    background: rgba(0, 0, 0, 0.04);
    padding: 4px 8px;
    border-radius: 6px;
    border: 1px solid var(--border-glass);
  }

  .cash-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.55);
    border: 1.5px solid rgba(16, 185, 129, 0.25);
    border-radius: var(--radius-md);
    box-shadow: 0 4px 15px rgba(16, 185, 129, 0.04);
  }

  .cash-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .required-indicator {
    font-size: 0.75rem;
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
    left: 16px;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-market);
    pointer-events: none;
  }

  .cash-input {
    font-size: 1.6rem !important;
    font-weight: 700 !important;
    padding-left: 36px !important;
    padding-top: 10px !important;
    padding-bottom: 10px !important;
    color: var(--color-market) !important;
    background: rgba(255, 255, 255, 0.8) !important;
    border: 1.5px solid rgba(16, 185, 129, 0.3) !important;
    border-radius: var(--radius-sm) !important;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03) !important;
    letter-spacing: 0.5px;
  }
  .cash-input:focus {
    border-color: var(--color-general) !important;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2) !important;
  }

  .quick-base-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 4px;
  }

  .quick-label {
    font-size: 0.74rem;
    color: var(--text-muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .quick-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .base-pill {
    background: rgba(255, 255, 255, 0.85);
    border: 1px solid rgba(16, 185, 129, 0.25);
    border-radius: 16px;
    padding: 6px 12px;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text-secondary);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .base-pill:hover {
    background: rgba(16, 185, 129, 0.1);
    border-color: var(--color-general);
    color: var(--color-general);
    transform: translateY(-1px);
  }

  .base-pill.selected {
    background: var(--color-general);
    border-color: var(--color-general);
    color: white;
    box-shadow: 0 3px 8px rgba(4, 120, 87, 0.3);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field-label {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .notes-textarea {
    border-radius: var(--radius-sm);
    resize: none;
    font-size: 0.88rem;
    background: rgba(255, 255, 255, 0.6);
  }

  .modal-footer {
    padding: 16px 20px;
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    border-top: 1px solid var(--border-glass);
    background: rgba(255, 255, 255, 0.02);
  }

  .btn-cancel {
    height: 44px;
    padding: 0 18px;
    font-weight: 500;
  }

  .btn-open-confirm {
    flex: 1;
    height: 44px;
    font-size: 0.95rem;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(4, 120, 87, 0.25);
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
</style>
