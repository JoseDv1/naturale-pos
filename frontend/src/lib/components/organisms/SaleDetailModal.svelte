<script lang="ts">
  import Badge from '../atoms/Badge.svelte';
  import ReceiptItem from '../molecules/ReceiptItem.svelte';
  import ReceiptPaymentRow from '../molecules/ReceiptPaymentRow.svelte';

  interface Props {
    sale: any;
    onclose: () => void;
  }

  let { sale, onclose }: Props = $props();

  function printReceipt() {
    window.print();
  }

  const paymentMethodLabels: Record<string, { label: string; icon: string }> = {
    CASH: { label: 'Efectivo', icon: '💵' },
    CARD: { label: 'Tarjeta Débito/Crédito', icon: '💳' },
    TRANSFER: { label: 'Transferencia Bancaria', icon: '📲' },
    INTERNAL: { label: 'Consumo Interno', icon: '🔄' },
  };

  let subtotalCalc = $derived.by(() => {
    if (!sale?.items) return 0;
    return sale.items.reduce((sum: number, it: any) => {
      const price = it.variant ? Number(it.variant.price) : Number(it.price || it.product?.price || 0);
      return sum + price * Number(it.quantity || 1);
    }, 0);
  });

  let discountCalc = $derived(Math.max(0, subtotalCalc - Number(sale?.total || 0)));
</script>

<div class="modal-overlay flex-center animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="sale-detail-title">
  <div class="modal-container glass-panel animate-scale-up printable-modal" style="max-width: 460px;">
    <!-- Modal Header (hidden on print) -->
    <header class="modal-header no-print">
      <div class="header-info">
        <h2 id="sale-detail-title">🧾 Detalle de Venta</h2>
        <span class="ticket-code">#{sale.id.slice(0, 8).toUpperCase()}</span>
      </div>
      <button type="button" class="close-modal-btn" onclick={onclose} aria-label="Cerrar modal">✕</button>
    </header>

    <!-- Printable Thermal Receipt Content -->
    <div class="receipt-thermal-paper" id="printable-receipt">
      <div class="receipt-brand text-center">
        <h3 class="receipt-logo">NATURALE POS</h3>
        <p class="receipt-tagline">Tienda Saludable & Café Orgánico</p>
        <p class="receipt-meta">NIT: 901.234.567-8 | Reg. Simplificado</p>
      </div>

      <div class="receipt-divider-dashed"></div>

      <div class="receipt-details">
        <div class="meta-row">
          <span>Ticket #:</span>
          <strong>{sale.id.slice(0, 8).toUpperCase()}</strong>
        </div>
        <div class="meta-row">
          <span>Fecha y Hora:</span>
          <span>{new Date(sale.createdAt).toLocaleString()}</span>
        </div>
        <div class="meta-row">
          <span>Atendido por:</span>
          <strong>{sale.user?.name || 'Cajero'}</strong>
        </div>
        {#if sale.table}
          <div class="meta-row">
            <span>Mesa:</span>
            <strong>{sale.table.name}</strong>
          </div>
        {/if}
        <div class="meta-row">
          <span>Estado:</span>
          {#if sale.status === 'COMPLETED'}
            <span class="status-pill status-completed">COMPLETADA</span>
          {:else if sale.status === 'CANCELLED'}
            <span class="status-pill status-cancelled">ANULADA</span>
          {:else if sale.status === 'TRANSFER_OUT'}
            <span class="status-pill status-transfer">TRASLADO</span>
          {/if}
        </div>
      </div>

      <div class="receipt-divider-dashed"></div>

      <!-- Itemized Products -->
      <div class="receipt-items-list">
        <div class="items-header">
          <span>Cant. Descripción</span>
          <span>Total</span>
        </div>

        {#each sale.items as item}
          <div class="receipt-item-row">
            <div class="item-info">
              <span class="item-qty">{item.quantity}x</span>
              <div class="item-names">
                <span class="item-title">{item.product?.name || 'Producto'}</span>
                {#if item.variant}
                  <span class="item-variant">({item.variant.name})</span>
                {/if}
                <span class="item-unit-cost">@ ${Number(item.price || item.variant?.price || item.product?.price || 0).toLocaleString()}</span>
              </div>
            </div>
            <span class="item-subtotal">
              ${(Number(item.quantity) * Number(item.price || item.variant?.price || item.product?.price || 0)).toLocaleString()}
            </span>
          </div>
        {/each}
      </div>

      <div class="receipt-divider-dashed"></div>

      <!-- Totals -->
      <div class="receipt-totals">
        <div class="total-row">
          <span>Subtotal:</span>
          <span>${subtotalCalc.toLocaleString()}</span>
        </div>

        {#if discountCalc > 0}
          <div class="total-row discount-row">
            <span>Descuento Aplicado:</span>
            <span>-${discountCalc.toLocaleString()}</span>
          </div>
        {/if}

        <div class="total-row grand-total-row">
          <strong>TOTAL PAGADO:</strong>
          <strong>${Number(sale.total).toLocaleString()}</strong>
        </div>
      </div>

      <div class="receipt-divider-dashed"></div>

      <!-- Payment Breakdown -->
      <div class="receipt-payments">
        <div class="payments-header">Desglose de Pago:</div>
        {#each sale.payments as pay}
          {@const pInfo = paymentMethodLabels[pay.method] || { label: pay.method, icon: '💳' }}
          <div class="payment-row">
            <span>{pInfo.icon} {pInfo.label}</span>
            <span>${Number(pay.amount).toLocaleString()}</span>
          </div>
        {/each}
      </div>

      <div class="receipt-divider-dashed"></div>

      <div class="receipt-footer text-center">
        <p class="receipt-thankyou">¡Gracias por tu compra saludable!</p>
        <p class="receipt-website">www.naturalepos.co</p>
      </div>
    </div>

    <!-- Modal Footer Actions (hidden on print) -->
    <footer class="modal-footer no-print">
      <button type="button" class="btn btn-secondary" onclick={onclose}>
        Cerrar
      </button>
      <button type="button" class="btn btn-primary" onclick={printReceipt}>
        🖨️ Imprimir Recibo
      </button>
    </footer>
  </div>
</div>

<style>
  .header-info {
    display: flex;
    align-items: center;
    gap: 10px;
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
    margin: 12px 0;
  }

  .receipt-details .meta-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 3px;
    font-size: 0.82rem;
  }

  .status-pill {
    font-size: 0.72rem;
    padding: 1px 6px;
    border-radius: 3px;
    font-weight: 700;
  }

  .status-completed {
    background: #e8f8f0;
    color: #1e824c;
  }

  .status-cancelled {
    background: #fde8e8;
    color: #c0392b;
  }

  .status-transfer {
    background: #e8f4f8;
    color: #2980b9;
  }

  .items-header {
    display: flex;
    justify-content: space-between;
    font-weight: 700;
    font-size: 0.8rem;
    margin-bottom: 6px;
    color: #333;
  }

  .receipt-item-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 6px;
    font-size: 0.84rem;
  }

  .item-info {
    display: flex;
    gap: 6px;
    max-width: 75%;
  }

  .item-qty {
    font-weight: 700;
  }

  .item-names {
    display: flex;
    flex-direction: column;
  }

  .item-title {
    font-weight: 600;
  }

  .item-variant {
    font-size: 0.75rem;
    color: #444;
  }

  .item-unit-cost {
    font-size: 0.72rem;
    color: #666;
  }

  .item-subtotal {
    font-weight: 600;
    white-space: nowrap;
  }

  .total-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 4px;
    font-size: 0.85rem;
  }

  .discount-row {
    color: #c0392b;
  }

  .grand-total-row {
    font-size: 1.05rem;
    font-weight: 800;
    margin-top: 6px;
    border-top: 1px solid #333;
    padding-top: 6px;
  }

  .payments-header {
    font-weight: 700;
    font-size: 0.8rem;
    margin-bottom: 4px;
  }

  .payment-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.82rem;
    margin-bottom: 3px;
  }

  .receipt-footer {
    margin-top: 10px;
  }

  .receipt-thankyou {
    font-size: 0.85rem;
    font-weight: 700;
    margin: 0;
  }

  .receipt-website {
    font-size: 0.75rem;
    color: #666;
    margin: 2px 0 0 0;
  }

  /* Media Print Rules */
  @media print {
    :global(body *) {
      visibility: hidden;
    }

    #printable-receipt, #printable-receipt * {
      visibility: visible;
    }

    #printable-receipt {
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
