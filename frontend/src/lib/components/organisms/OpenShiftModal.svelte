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
  <div class="modal-container glass-panel animate-scale-up" style="max-width: 480px;">
    <header class="modal-header">
      <div class="header-content">
        <span class="header-icon">🔓</span>
        <div>
          <h2 id="open-shift-title">Apertura de Turno de Caja</h2>
          <p class="header-sub">Ingresa el fondo o base en efectivo para iniciar operaciones comerciales.</p>
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

        <div class="cashier-summary-card">
          <span>Cajero Responsable:</span>
          <strong>{$user?.name || 'Cajero de Turno'}</strong>
        </div>

        <div class="form-group">
          <label for="initial-cash-input">
            Monto Base Inicial en Efectivo ($) <span class="required">*</span>
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
              placeholder="Ej: 50000"
              required
            />
          </div>
        </div>

        <!-- Quick Base Selection Pills -->
        <div class="quick-base-group">
          <span class="quick-label">Montos sugeridos:</span>
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

        <div class="form-group">
          <label for="shift-notes">Notas u Observaciones de Apertura (Opcional)</label>
          <textarea
            id="shift-notes"
            class="form-control"
            rows="2"
            bind:value={notes}
            placeholder="Ej: Billetes de 10k y 20k en gaveta, monedas para cambio..."
          ></textarea>
        </div>
      </div>

      <footer class="modal-footer">
        {#if onclose}
          <button type="button" class="btn btn-secondary" onclick={onclose} disabled={isLoading}>
            Cancelar
          </button>
        {/if}
        <button type="submit" class="btn btn-primary btn-open-confirm" disabled={isLoading}>
          {#if isLoading}
            <Spinner size="18px" /> Abriendo Caja...
          {:else}
            🚀 Abrir Caja y Comenzar Turno
          {/if}
        </button>
      </footer>
    </form>
  </div>
</div>

<style>
  .header-content {
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
    gap: 16px;
  }

  .cashier-summary-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    font-size: 0.88rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-group label {
    font-size: 0.88rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .required {
    color: var(--color-danger);
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

  .cash-input {
    font-size: 1.3rem !important;
    font-weight: 700 !important;
    padding-left: 32px !important;
    color: var(--color-general) !important;
  }

  .quick-base-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .quick-label {
    font-size: 0.78rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .quick-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .base-pill {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-glass);
    border-radius: 16px;
    padding: 5px 12px;
    font-size: 0.85rem;
    color: var(--text-primary);
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .base-pill:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: var(--color-general);
  }

  .base-pill.selected {
    background: rgba(34, 197, 94, 0.15);
    border-color: #22c55e;
    color: #22c55e;
    font-weight: 600;
  }

  .btn-open-confirm {
    flex: 1;
  }

  .error-banner {
    padding: 10px 14px;
    background: rgba(231, 76, 60, 0.15);
    border: 1px solid rgba(231, 76, 60, 0.3);
    border-radius: var(--radius-sm);
    color: #e74c3c;
    font-size: 0.88rem;
  }
</style>
