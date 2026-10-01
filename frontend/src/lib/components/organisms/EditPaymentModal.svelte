<script lang="ts">
  import { untrack } from 'svelte';
  import { updateSalePayments } from '../../api/sales';
  import Spinner from '../atoms/Spinner.svelte';

  type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'INTERNAL';

  interface PaymentItem {
    method: PaymentMethod;
    amount: number;
  }

  interface Props {
    sale: any;
    onclose: () => void;
    onsave?: (updatedSale: any) => void;
  }

  let { sale, onclose, onsave }: Props = $props();

  // Initialize payment items from sale
  let payments = $state<PaymentItem[]>(
    untrack(() =>
      Array.isArray(sale?.payments) && sale.payments.length > 0
        ? sale.payments.map((p: any) => ({
            method: p.method as PaymentMethod,
            amount: Number(p.amount) || 0,
          }))
        : [{ method: 'CASH', amount: Number(sale?.total || 0) }]
    )
  );

  let isLoading = $state(false);
  let errorMessage = $state('');
  let successMessage = $state('');

  // New payment to add
  let newMethod = $state<PaymentMethod>('CARD');
  let newAmount = $state<number | string>('');

  const saleTotal = $derived(Number(sale?.total || 0));
  const currentTotal = $derived(
    payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  );
  const difference = $derived(
    Math.round((saleTotal - currentTotal) * 100) / 100
  );
  const isExact = $derived(Math.abs(difference) < 0.01);
  const hasValidAmounts = $derived(
    payments.length > 0 && payments.every((p) => Number(p.amount) > 0)
  );

  const isClosedShift = $derived(sale?.shift?.status === 'CLOSED');
  const isCancelled = $derived(sale?.status === 'CANCELLED');
  const canSave = $derived(
    isExact && hasValidAmounts && !isLoading && !isClosedShift && !isCancelled
  );

  const paymentMethodLabels: Record<PaymentMethod, { label: string; icon: string }> = {
    CASH: { label: 'Efectivo', icon: '💵' },
    CARD: { label: 'Tarjeta', icon: '💳' },
    TRANSFER: { label: 'Transferencia', icon: '📲' },
    INTERNAL: { label: 'Interno', icon: '🔄' },
  };

  const availableMethods: PaymentMethod[] = ['CASH', 'CARD', 'TRANSFER', 'INTERNAL'];

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && !isLoading) {
      onclose();
    }
  }

  function setSingleMethod(method: PaymentMethod) {
    payments = [{ method, amount: saleTotal }];
    errorMessage = '';
  }

  function addPayment() {
    const amt = Number(newAmount);
    if (isNaN(amt) || amt <= 0) {
      errorMessage = 'El monto a agregar debe ser mayor a 0.';
      return;
    }

    payments = [...payments, { method: newMethod, amount: amt }];
    newAmount = '';
    errorMessage = '';
  }

  function removePayment(index: number) {
    if (payments.length <= 1) {
      errorMessage = 'Debe mantener al menos un método de pago.';
      return;
    }
    payments = payments.filter((_, i) => i !== index);
    errorMessage = '';
  }

  function updateRowAmount(index: number, val: number) {
    payments = payments.map((p, i) => (i === index ? { ...p, amount: val } : p));
  }

  function updateRowMethod(index: number, method: PaymentMethod) {
    payments = payments.map((p, i) => (i === index ? { ...p, method } : p));
  }

  function fillRemaining(index: number) {
    const otherSum = payments.reduce((sum, p, i) => (i === index ? sum : sum + (Number(p.amount) || 0)), 0);
    const rem = Math.max(0, Math.round((saleTotal - otherSum) * 100) / 100);
    updateRowAmount(index, rem);
  }

  function prefillNewRemaining() {
    if (difference > 0) {
      newAmount = difference;
    }
  }

  async function handleSave() {
    if (!canSave) return;

    isLoading = true;
    errorMessage = '';
    successMessage = '';

    try {
      const payload = payments.map((p) => ({
        method: p.method,
        amount: Number(p.amount),
      }));

      const res = await updateSalePayments(sale.id, payload);
      successMessage = '¡Métodos de pago actualizados con éxito!';
      onsave?.(res.sale);
      setTimeout(() => {
        onclose();
      }, 700);
    } catch (err: any) {
      console.error('Error al actualizar métodos de pago:', err);
      errorMessage = err.message || 'Error al guardar los métodos de pago.';
    } finally {
      isLoading = false;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="modal-overlay flex-center animate-fade-in"
  role="dialog"
  aria-modal="true"
  aria-labelledby="edit-payment-title"
>
  <div class="modal-container glass-panel animate-scale-up">
    <!-- Header -->
    <header class="modal-header">
      <div class="header-info">
        <h2 id="edit-payment-title">💳 Editar Métodos de Pago</h2>
        <span class="ticket-code">#{sale.id.slice(0, 8).toUpperCase()}</span>
      </div>
      <button
        type="button"
        class="close-modal-btn"
        onclick={onclose}
        disabled={isLoading}
        aria-label="Cerrar modal"
      >
        ✕
      </button>
    </header>

    <!-- Subtitle / Context -->
    <div class="sale-context-bar">
      <div class="context-item">
        <span class="context-label">Total a Cubrir:</span>
        <strong class="context-value highlight">${saleTotal.toLocaleString()}</strong>
      </div>
      <div class="context-item">
        <span class="context-label">Cajero:</span>
        <span class="context-value">{sale.user?.name || 'N/A'}</span>
      </div>
      <div class="context-item">
        <span class="context-label">Fecha:</span>
        <span class="context-value">{new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>

    <!-- Warnings for closed shift or cancelled sale -->
    {#if isClosedShift}
      <div class="status-banner warning animate-fade-in" role="alert">
        <span>🔒 Esta venta pertenece a un <strong>turno cerrado</strong>. Por seguridad de arqueo, no es posible modificar sus métodos de pago.</span>
      </div>
    {:else if isCancelled}
      <div class="status-banner danger animate-fade-in" role="alert">
        <span>⚠️ Esta venta está <strong>ANULADA</strong>. No se pueden modificar métodos de pago de ventas canceladas.</span>
      </div>
    {/if}

    {#if errorMessage}
      <div class="status-banner danger animate-fade-in" role="alert">
        <span>⚠️ {errorMessage}</span>
      </div>
    {/if}

    {#if successMessage}
      <div class="status-banner success animate-fade-in" role="alert">
        <span>✅ {successMessage}</span>
      </div>
    {/if}

    <!-- Quick Single-Method Shortcuts -->
    {#if !isClosedShift && !isCancelled}
      <div class="quick-shortcuts-section">
        <span class="section-hint">Atajo: Cambiar todo a un solo método</span>
        <div class="quick-chips">
          {#each availableMethods as method}
            {@const info = paymentMethodLabels[method]}
            <button
              type="button"
              class="quick-chip-btn"
              class:active={payments.length === 1 && payments[0].method === method && isExact}
              onclick={() => setSingleMethod(method)}
              disabled={isLoading}
              title={`Asignar el 100% ($${saleTotal.toLocaleString()}) a ${info.label}`}
            >
              <span class="chip-icon">{info.icon}</span>
              <span class="chip-label">{info.label}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Payments List -->
    <div class="payments-list-section">
      <div class="section-header">
        <span class="section-title">Desglose de Pagos Registrados</span>
        <span class="count-badge">{payments.length} {payments.length === 1 ? 'método' : 'métodos'}</span>
      </div>

      <div class="payments-list">
        {#each payments as pay, idx}
          {@render paymentRow(pay, idx)}
        {/each}
      </div>

      <!-- Add Split Payment Row -->
      {#if !isClosedShift && !isCancelled}
        <div class="add-payment-box">
          <div class="add-inputs">
            <select
              bind:value={newMethod}
              class="method-select"
              aria-label="Seleccionar método adicional"
              disabled={isLoading}
            >
              {#each availableMethods as m}
                <option value={m}>{paymentMethodLabels[m].icon} {paymentMethodLabels[m].label}</option>
              {/each}
            </select>

            <div class="amount-input-wrapper">
              <span class="currency-symbol">$</span>
              <input
                type="number"
                class="amount-input"
                placeholder="Monto"
                min="0"
                step="100"
                bind:value={newAmount}
                disabled={isLoading}
                aria-label="Monto para método adicional"
                onkeydown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addPayment();
                  }
                }}
              />
            </div>

            {#if difference > 0}
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                onclick={prefillNewRemaining}
                disabled={isLoading}
                title="Rellenar con la diferencia restante"
              >
                Restante (${difference.toLocaleString()})
              </button>
            {/if}

            <button
              type="button"
              class="btn btn-primary btn-sm add-btn"
              onclick={addPayment}
              disabled={isLoading || !newAmount || Number(newAmount) <= 0}
            >
              + Agregar
            </button>
          </div>
        </div>
      {/if}
    </div>

    <!-- Balance & Difference Card -->
    <div class="balance-card" class:balanced={isExact} class:unbalanced={!isExact}>
      <div class="balance-row">
        <span>Total Requerido:</span>
        <strong>${saleTotal.toLocaleString()}</strong>
      </div>
      <div class="balance-row">
        <span>Suma de Métodos:</span>
        <strong>${currentTotal.toLocaleString()}</strong>
      </div>
      <div class="balance-divider"></div>
      <div class="balance-row status-row">
        {#if isExact}
          <span class="status-text exact">✅ Pagos exactamente balanceados</span>
          <strong class="diff-amount zero">$0</strong>
        {:else if difference > 0}
          <span class="status-text pending">⚠️ Falta asignar</span>
          <strong class="diff-amount pending">${difference.toLocaleString()}</strong>
        {:else}
          <span class="status-text excess">⚠️ Excede por</span>
          <strong class="diff-amount excess">${Math.abs(difference).toLocaleString()}</strong>
        {/if}
      </div>
    </div>

    <!-- Footer Actions -->
    <footer class="modal-footer">
      <button
        type="button"
        class="btn btn-secondary"
        onclick={onclose}
        disabled={isLoading}
      >
        Cancelar
      </button>

      <button
        type="button"
        class="btn btn-market save-btn"
        onclick={handleSave}
        disabled={!canSave}
      >
        {#if isLoading}
          <Spinner size="18px" />
          <span>Guardando...</span>
        {:else}
          <span>💾 Guardar Métodos de Pago</span>
        {/if}
      </button>
    </footer>
  </div>
</div>

{#snippet paymentRow(pay: PaymentItem, idx: number)}
  <div class="payment-item-row animate-fade-in">
    <div class="row-method">
      <select
        value={pay.method}
        onchange={(e) => updateRowMethod(idx, e.currentTarget.value as PaymentMethod)}
        class="inline-select"
        disabled={isLoading || isClosedShift || isCancelled}
        aria-label={`Método de pago ${idx + 1}`}
      >
        {#each availableMethods as m}
          <option value={m}>{paymentMethodLabels[m].icon} {paymentMethodLabels[m].label}</option>
        {/each}
      </select>
    </div>

    <div class="row-amount">
      <span class="currency-symbol">$</span>
      <input
        type="number"
        class="inline-amount-input"
        value={pay.amount}
        min="0"
        step="100"
        disabled={isLoading || isClosedShift || isCancelled}
        oninput={(e) => {
          const val = parseFloat(e.currentTarget.value);
          updateRowAmount(idx, isNaN(val) ? 0 : val);
        }}
        aria-label={`Monto pago ${idx + 1}`}
      />
    </div>

    {#if !isClosedShift && !isCancelled}
      <div class="row-actions">
        {#if !isExact}
          <button
            type="button"
            class="action-mini-btn"
            onclick={() => fillRemaining(idx)}
            title="Ajustar esta línea para balancear el total"
            disabled={isLoading}
          >
            Ajustar
          </button>
        {/if}
        <button
          type="button"
          class="delete-pay-btn"
          onclick={() => removePayment(idx)}
          title="Eliminar este método de pago"
          disabled={isLoading || payments.length <= 1}
          aria-label={`Eliminar método ${idx + 1}`}
        >
          ✕
        </button>
      </div>
    {/if}
  </div>
{/snippet}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    z-index: 1200;
  }

  .modal-container {
    background: var(--bg-glass, #1e293b);
    border: 1px solid var(--border-glass, rgba(255, 255, 255, 0.12));
    border-radius: var(--radius-lg, 16px);
    width: 95%;
    max-width: 520px;
    max-height: 90vh;
    overflow-y: auto;
    padding: 24px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .header-info h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary, #f8fafc);
  }

  .ticket-code {
    font-size: 0.82rem;
    background: rgba(255, 255, 255, 0.08);
    padding: 2px 8px;
    border-radius: 4px;
    color: var(--color-general, #10b981);
    font-weight: 600;
  }

  .close-modal-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary, #94a3b8);
    font-size: 1.3rem;
    cursor: pointer;
    line-height: 1;
    padding: 4px 8px;
    border-radius: 4px;
    transition: var(--transition-fast, 0.15s ease);
  }

  .close-modal-btn:hover:not(:disabled) {
    color: var(--text-primary, #fff);
    background: rgba(255, 255, 255, 0.1);
  }

  .sale-context-bar {
    display: flex;
    justify-content: space-between;
    background: rgba(0, 0, 0, 0.25);
    padding: 10px 14px;
    border-radius: var(--radius-sm, 8px);
    border: 1px solid var(--border-glass, rgba(255, 255, 255, 0.08));
    font-size: 0.85rem;
  }

  .context-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .context-label {
    color: var(--text-secondary, #94a3b8);
    font-size: 0.72rem;
    text-transform: uppercase;
  }

  .context-value {
    color: var(--text-primary, #f8fafc);
    font-weight: 500;
  }

  .context-value.highlight {
    color: var(--color-general, #10b981);
    font-weight: 700;
    font-size: 0.98rem;
  }

  .status-banner {
    padding: 10px 14px;
    border-radius: var(--radius-sm, 8px);
    font-size: 0.85rem;
    line-height: 1.4;
  }

  .status-banner.warning {
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.35);
    color: #fbbf24;
  }

  .status-banner.danger {
    background: rgba(244, 63, 94, 0.12);
    border: 1px solid rgba(244, 63, 94, 0.35);
    color: #f43f5e;
  }

  .status-banner.success {
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.35);
    color: #10b981;
  }

  .quick-shortcuts-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-hint {
    font-size: 0.76rem;
    color: var(--text-secondary, #94a3b8);
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.04em;
  }

  .quick-chips {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }

  .quick-chip-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--border-glass, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-sm, 8px);
    padding: 8px 4px;
    cursor: pointer;
    transition: all 0.18s ease;
    outline: none;
    color: var(--text-primary, #f8fafc);
  }

  .quick-chip-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    border-color: var(--color-general, #10b981);
    transform: translateY(-1px);
  }

  .quick-chip-btn.active {
    background: rgba(16, 185, 129, 0.16);
    border-color: var(--color-general, #10b981);
    box-shadow: 0 0 10px rgba(16, 185, 129, 0.25);
  }

  .chip-icon {
    font-size: 1.15rem;
  }

  .chip-label {
    font-size: 0.72rem;
    font-weight: 600;
  }

  .payments-list-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .section-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-primary, #f8fafc);
  }

  .count-badge {
    font-size: 0.72rem;
    background: rgba(255, 255, 255, 0.08);
    padding: 2px 6px;
    border-radius: 4px;
    color: var(--text-secondary, #94a3b8);
  }

  .payments-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 190px;
    overflow-y: auto;
    padding-right: 4px;
  }

  .payment-item-row {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(0, 0, 0, 0.3);
    padding: 8px 12px;
    border-radius: var(--radius-sm, 8px);
    border: 1px solid var(--border-glass, rgba(255, 255, 255, 0.08));
  }

  .row-method {
    flex: 1.2;
  }

  .inline-select,
  .method-select {
    width: 100%;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--border-glass, rgba(255, 255, 255, 0.15));
    border-radius: var(--radius-sm, 6px);
    color: var(--text-primary, #f8fafc);
    padding: 6px 8px;
    font-size: 0.82rem;
  }

  .inline-select:focus,
  .method-select:focus {
    border-color: var(--color-general, #10b981);
    outline: none;
  }

  .row-amount {
    flex: 1.2;
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--border-glass, rgba(255, 255, 255, 0.15));
    border-radius: var(--radius-sm, 6px);
    padding: 0 8px;
  }

  .currency-symbol {
    color: var(--text-secondary, #94a3b8);
    font-weight: 600;
    font-size: 0.85rem;
  }

  .inline-amount-input,
  .amount-input {
    width: 100%;
    background: transparent;
    border: none;
    color: var(--text-primary, #f8fafc);
    padding: 6px 6px;
    font-size: 0.9rem;
    font-weight: 600;
  }

  .inline-amount-input:focus,
  .amount-input:focus {
    outline: none;
  }

  .row-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .action-mini-btn {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--border-glass, rgba(255, 255, 255, 0.15));
    color: var(--text-secondary, #94a3b8);
    padding: 4px 6px;
    border-radius: 4px;
    font-size: 0.7rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .action-mini-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.15);
    color: var(--text-primary, #fff);
  }

  .delete-pay-btn {
    background: rgba(244, 63, 94, 0.1);
    border: 1px solid rgba(244, 63, 94, 0.2);
    color: var(--color-danger, #f43f5e);
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .delete-pay-btn:hover:not(:disabled) {
    background: rgba(244, 63, 94, 0.25);
    border-color: #f43f5e;
  }

  .delete-pay-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .add-payment-box {
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed var(--border-glass, rgba(255, 255, 255, 0.12));
    border-radius: var(--radius-sm, 8px);
    padding: 10px;
  }

  .add-inputs {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .amount-input-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-glass, rgba(255, 255, 255, 0.12));
    border-radius: var(--radius-sm, 6px);
    padding: 0 8px;
  }

  .btn-sm {
    padding: 6px 10px;
    font-size: 0.78rem;
    white-space: nowrap;
    border-radius: 6px;
  }

  .add-btn {
    font-weight: 600;
  }

  .balance-card {
    background: rgba(0, 0, 0, 0.35);
    border-radius: var(--radius-sm, 8px);
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    border: 1px solid var(--border-glass, rgba(255, 255, 255, 0.08));
    font-size: 0.85rem;
  }

  .balance-card.balanced {
    border-color: rgba(16, 185, 129, 0.3);
  }

  .balance-card.unbalanced {
    border-color: rgba(245, 158, 11, 0.3);
  }

  .balance-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--text-secondary, #94a3b8);
  }

  .balance-row strong {
    color: var(--text-primary, #f8fafc);
  }

  .balance-divider {
    height: 1px;
    background: var(--border-glass, rgba(255, 255, 255, 0.08));
    margin: 4px 0;
  }

  .status-row {
    font-weight: 600;
  }

  .status-text.exact {
    color: var(--color-general, #10b981);
  }

  .status-text.pending {
    color: #fbbf24;
  }

  .status-text.excess {
    color: #f43f5e;
  }

  .diff-amount.zero {
    color: var(--color-general, #10b981);
    font-size: 1rem;
  }

  .diff-amount.pending {
    color: #fbbf24;
    font-size: 1rem;
  }

  .diff-amount.excess {
    color: #f43f5e;
    font-size: 1rem;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--border-glass, rgba(255, 255, 255, 0.08));
  }

  .save-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    min-width: 170px;
    justify-content: center;
  }

  @media (max-width: 480px) {
    .quick-chips {
      grid-template-columns: repeat(2, 1fr);
    }

    .add-inputs {
      flex-wrap: wrap;
    }
  }
</style>
