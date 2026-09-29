<script lang="ts">
  import { receiptSettings, type ReceiptSettings } from '../../store';
  import { printThermalReceipt } from '../../services/printer';

  interface Props {
    sale: any;
    overrideSettings?: Partial<ReceiptSettings>;
    cashierName?: string;
    tableName?: string;
    showPrintButton?: boolean;
    onprint?: () => void;
  }

  let {
    sale,
    overrideSettings,
    cashierName,
    tableName,
    showPrintButton = false,
    onprint,
  }: Props = $props();

  let settings = $derived<ReceiptSettings>({
    ...$receiptSettings,
    ...(overrideSettings || {}),
  });

  const paymentLabels: Record<string, string> = {
    CASH: 'Efectivo',
    CARD: 'Tarjeta Débito/Crédito',
    TRANSFER: 'Transferencia Bancaria',
    INTERNAL: 'Consumo Interno',
  };

  // Normalization of sale items (handles cart item format and prisma DB sale format)
  let normalizedItems = $derived.by(() => {
    if (!sale?.items || !Array.isArray(sale.items)) return [];
    return sale.items.map((it: any) => {
      const name = it.product?.name || it.name || it.productName || it.title || 'Producto';
      const variantName = it.variant?.name || it.variantName || null;
      const notes = it.notes || null;
      const quantity = Number(it.quantity || 1);
      const unitPrice = Number(
        it.price ?? it.unitPrice ?? it.variant?.price ?? it.product?.price ?? 0
      );
      const subtotal = quantity * unitPrice;
      return {
        name,
        variantName,
        notes,
        quantity,
        unitPrice,
        subtotal,
      };
    });
  });

  // Normalization of payments
  let normalizedPayments = $derived.by(() => {
    if (!sale?.payments || !Array.isArray(sale.payments)) return [];
    return sale.payments.map((p: any) => {
      const rawMethod = String(p.method || 'CASH').toUpperCase();
      const methodName = paymentLabels[rawMethod] || rawMethod;
      const amount = Number(p.amount || 0);
      return { method: rawMethod, methodName, amount };
    });
  });

  let subtotalAmount = $derived.by(() => {
    if (normalizedItems.length > 0) {
      return normalizedItems.reduce((acc: number, it: { subtotal: number }) => acc + it.subtotal, 0);
    }
    return Number(sale?.total || 0);
  });

  let totalAmount = $derived(Number(sale?.total || subtotalAmount));
  let discountAmount = $derived(Math.max(0, subtotalAmount - totalAmount));
  let changeAmount = $derived(Number(sale?.change || 0));

  let ticketId = $derived(
    sale?.id ? String(sale.id).slice(0, 8).toUpperCase() : '00000000'
  );

  let formattedDate = $derived.by(() => {
    const d = sale?.createdAt ? new Date(sale.createdAt) : new Date();
    return d.toLocaleString('es-CO', {
      dateStyle: 'short',
      timeStyle: 'medium',
    });
  });

  let effectiveCashier = $derived(
    cashierName || sale?.user?.name || 'Cajero de Turno'
  );
  let effectiveTable = $derived(
    tableName || sale?.table?.name || null
  );

  let statusLabel = $derived.by(() => {
    if (!sale?.status || sale.status === 'COMPLETED') return 'COMPLETADA';
    if (sale.status === 'CANCELLED') return 'ANULADA';
    if (sale.status === 'TRANSFER_OUT') return 'TRASLADO';
    return sale.status;
  });

  function handlePrint() {
    if (onprint) {
      onprint();
    } else {
      printThermalReceipt('printable-thermal-receipt');
    }
  }
</script>

<div class="thermal-receipt-wrapper">
  {#if showPrintButton}
    <div class="print-actions-bar no-print">
      <button type="button" class="btn-print-action" onclick={handlePrint}>
        🖨️ Imprimir Ticket (80mm)
      </button>
    </div>
  {/if}

  <!-- The printable 80mm ticket -->
  <article class="thermal-receipt-80mm" id="printable-thermal-receipt" aria-label="Ticket térmico de venta 80mm">
    <!-- Header / Brand -->
    <header class="receipt-header">
      <h1 class="store-name">{settings.storeName}</h1>
      {#if settings.storeSubtitle}
        <p class="store-subtitle">{settings.storeSubtitle}</p>
      {/if}
      {#if settings.taxId}
        <p class="meta-line">{settings.taxId}</p>
      {/if}
      {#if settings.address}
        <p class="meta-line">{settings.address}</p>
      {/if}
      {#if settings.phone}
        <p class="meta-line">{settings.phone}</p>
      {/if}
      {#if settings.legalNotice}
        <p class="legal-notice">{settings.legalNotice}</p>
      {/if}
    </header>

    <div class="dashed-line" aria-hidden="true">================================</div>

    <!-- Ticket Info -->
    <section class="ticket-info">
      <div class="info-row">
        <span class="info-label">FACTURA/TICKET:</span>
        <strong class="info-value">#{ticketId}</strong>
      </div>
      <div class="info-row">
        <span class="info-label">FECHA:</span>
        <span class="info-value">{formattedDate}</span>
      </div>
      <div class="info-row">
        <span class="info-label">CAJERO:</span>
        <span class="info-value">{effectiveCashier}</span>
      </div>
      {#if effectiveTable}
        <div class="info-row">
          <span class="info-label">MESA / CUENTA:</span>
          <strong class="info-value">{effectiveTable}</strong>
        </div>
      {/if}
      <div class="info-row">
        <span class="info-label">ESTADO:</span>
        <span class="info-value status-tag">{statusLabel}</span>
      </div>
    </section>

    <div class="dashed-line" aria-hidden="true">--------------------------------</div>

    <!-- Items Header -->
    <div class="items-table-header">
      <span class="col-item-desc">DESCRIPCIÓN</span>
      <span class="col-item-unit">P.UNIT</span>
      <span class="col-item-sub">TOTAL</span>
    </div>
    <div class="dashed-line" aria-hidden="true">--------------------------------</div>

    <!-- Items List -->
    <section class="items-list">
      {#each normalizedItems as item}
        <div class="receipt-item-entry">
          <div class="item-primary-line">
            <span class="item-qty">{item.quantity}x</span>
            <span class="item-title">{item.name}</span>
          </div>
          {#if item.variantName}
            <div class="item-variant-line">└ {item.variantName}</div>
          {/if}
          {#if item.notes}
            <div class="item-notes-line">└ {item.notes}</div>
          {/if}
          <div class="item-pricing-line">
            <span></span>
            <span class="unit-price">${item.unitPrice.toLocaleString('es-CO')}</span>
            <span class="item-total">${item.subtotal.toLocaleString('es-CO')}</span>
          </div>
        </div>
      {:else}
        <div class="empty-items-notice">— Sin productos registrados —</div>
      {/each}
    </section>

    <div class="dashed-line" aria-hidden="true">--------------------------------</div>

    <!-- Financial Totals -->
    <section class="totals-section">
      <div class="total-row">
        <span>SUBTOTAL:</span>
        <span>${subtotalAmount.toLocaleString('es-CO')}</span>
      </div>
      {#if discountAmount > 0}
        <div class="total-row discount-line">
          <span>DESCUENTO:</span>
          <span>-${discountAmount.toLocaleString('es-CO')}</span>
        </div>
      {/if}
      <div class="total-row grand-total">
        <span>TOTAL A PAGAR:</span>
        <span>${totalAmount.toLocaleString('es-CO')}</span>
      </div>
    </section>

    <div class="dashed-line" aria-hidden="true">================================</div>

    <!-- Payment Breakdown -->
    <section class="payments-section">
      <p class="payments-title">MÉTODO(S) DE PAGO:</p>
      {#each normalizedPayments as pay}
        <div class="payment-row">
          <span>{pay.methodName}:</span>
          <span>${pay.amount.toLocaleString('es-CO')}</span>
        </div>
      {/each}
      {#if changeAmount > 0}
        <div class="payment-row change-row">
          <span>CAMBIO ENTREGADO:</span>
          <span>${changeAmount.toLocaleString('es-CO')}</span>
        </div>
      {/if}
    </section>

    <div class="dashed-line" aria-hidden="true">--------------------------------</div>

    <!-- Footer -->
    <footer class="receipt-footer">
      {#if settings.footerMessage}
        <p class="footer-thankyou">{settings.footerMessage}</p>
      {/if}
      {#if settings.website}
        <p class="footer-meta">{settings.website}</p>
      {/if}
      <p class="footer-pos-brand">Sistema Naturale POS 80mm</p>
      <!-- Feed space for thermal cutter clearance (15mm) -->
      <div class="thermal-feed-space" aria-hidden="true"></div>
    </footer>
  </article>
</div>

<style>
  /* Screen Presentation Preview */
  .thermal-receipt-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  .print-actions-bar {
    width: 100%;
    max-width: 340px;
    margin-bottom: 12px;
    display: flex;
    justify-content: center;
  }

  .btn-print-action {
    background: var(--color-general, #047857);
    color: #ffffff;
    border: none;
    border-radius: var(--radius-sm, 8px);
    padding: 10px 18px;
    font-weight: 700;
    font-size: 0.95rem;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(4, 120, 87, 0.25);
    transition: transform var(--transition-fast, 0.15s), background var(--transition-fast, 0.15s);
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .btn-print-action:hover {
    background: var(--color-general-hover, #065f46);
    transform: translateY(-1px);
  }

  /* Thermal Receipt Card (Preview on Screen) */
  .thermal-receipt-80mm {
    width: 100%;
    max-width: 320px; /* ~76mm on standard 96dpi displays */
    background: #ffffff;
    color: #111111;
    font-family: 'Courier New', Courier, monospace, 'Lucida Console';
    font-size: 11.5px;
    line-height: 1.35;
    padding: 18px 14px 22px 14px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
    border-radius: 4px;
    box-sizing: border-box;
    border-top: 4px solid var(--color-general, #047857);
  }

  /* Header Styles */
  .receipt-header {
    text-align: center;
    margin-bottom: 4px;
  }

  .store-name {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 0.5px;
    margin: 0 0 2px 0;
    color: #000000;
    text-transform: uppercase;
  }

  .store-subtitle {
    font-size: 11px;
    font-weight: 600;
    margin: 0 0 4px 0;
    color: #333333;
  }

  .meta-line {
    font-size: 10.5px;
    margin: 1px 0;
    color: #444444;
  }

  .legal-notice {
    font-size: 9.5px;
    margin: 3px 0 0 0;
    color: #555555;
    font-style: italic;
  }

  /* Dashed Divider Lines (monospace art for thermal pin precision) */
  .dashed-line {
    text-align: center;
    font-size: 10px;
    font-weight: bold;
    letter-spacing: -1px;
    overflow: hidden;
    user-select: none;
    margin: 4px 0;
    color: #222222;
  }

  /* Ticket Meta Info */
  .ticket-info {
    margin: 4px 0;
    font-size: 11px;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 2px;
  }

  .info-label {
    font-weight: 600;
  }

  .status-tag {
    font-weight: bold;
  }

  /* Table Header */
  .items-table-header {
    display: grid;
    grid-template-columns: 1fr 55px 65px;
    font-weight: 700;
    font-size: 10px;
    margin: 2px 0;
  }

  .col-item-desc {
    text-align: left;
  }

  .col-item-unit {
    text-align: right;
  }

  .col-item-sub {
    text-align: right;
  }

  /* Item Entries */
  .items-list {
    margin: 2px 0;
  }

  .receipt-item-entry {
    margin-bottom: 6px;
  }

  .item-primary-line {
    display: flex;
    gap: 6px;
    font-weight: 600;
    font-size: 11px;
    color: #000000;
  }

  .item-qty {
    font-weight: 700;
    min-width: 20px;
  }

  .item-title {
    flex: 1;
    word-break: break-word;
  }

  .item-variant-line {
    font-size: 10px;
    padding-left: 26px;
    color: #333333;
    font-weight: 600;
  }

  .item-notes-line {
    font-size: 9.5px;
    padding-left: 26px;
    color: #444444;
    font-style: italic;
    word-break: break-word;
    margin-top: 1px;
  }

  .item-pricing-line {
    display: grid;
    grid-template-columns: 1fr 55px 65px;
    font-size: 10.5px;
    margin-top: 1px;
  }

  .unit-price {
    text-align: right;
    color: #555555;
  }

  .item-total {
    text-align: right;
    font-weight: 700;
    color: #000000;
  }

  .empty-items-notice {
    text-align: center;
    font-style: italic;
    font-size: 10.5px;
    color: #666666;
    padding: 6px 0;
  }

  /* Totals Section */
  .totals-section {
    margin: 4px 0;
    font-size: 11.5px;
  }

  .total-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 2px;
  }

  .discount-line {
    color: #be123c;
    font-weight: 600;
  }

  .grand-total {
    font-size: 13.5px;
    font-weight: 800;
    margin-top: 4px;
    padding-top: 2px;
    color: #000000;
  }

  /* Payments Breakdown */
  .payments-section {
    margin: 4px 0;
    font-size: 11px;
  }

  .payments-title {
    font-weight: 700;
    margin: 0 0 2px 0;
  }

  .payment-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 1px;
  }

  .change-row {
    font-weight: 700;
    margin-top: 2px;
    color: #047857;
  }

  /* Footer */
  .receipt-footer {
    text-align: center;
    margin-top: 6px;
    font-size: 10.5px;
  }

  .footer-thankyou {
    font-weight: 700;
    margin: 0 0 2px 0;
    color: #000000;
  }

  .footer-meta {
    font-size: 10px;
    color: #555555;
    margin: 0 0 4px 0;
  }

  .footer-pos-brand {
    font-size: 9px;
    color: #888888;
    margin: 2px 0 0 0;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .thermal-feed-space {
    height: 14mm; /* Ensures full text passes the thermal paper cutter blade */
  }

  /* =========================================================================
     EXACT 80MM BROWSER PRINT ENGINE
     ========================================================================= */
  @page {
    size: 80mm auto;
    margin: 0mm;
  }

  @media print {
    :global(.thermal-receipt-80mm) {
      display: block !important;
      position: static !important;
      /* 72mm printable width fits standard 80mm paper roll without clipping */
      width: 72mm !important;
      max-width: 72mm !important;
      margin: 0 auto !important;
      padding: 1.5mm 1.5mm 15mm 1.5mm !important;
      box-shadow: none !important;
      border: none !important;
      border-radius: 0 !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-size: 10.5px !important;
      line-height: 1.25 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      visibility: visible !important;
    }

    .dashed-line {
      color: #000000 !important;
      letter-spacing: -0.5px !important;
      visibility: visible !important;
    }

    .store-name {
      color: #000000 !important;
      font-size: 15px !important;
      visibility: visible !important;
    }

    .receipt-item-entry,
    .item-primary-line,
    .item-pricing-line,
    .item-title,
    .item-qty,
    .unit-price,
    .item-total {
      color: #000000 !important;
      visibility: visible !important;
    }

    .receipt-item-entry {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .grand-total {
      color: #000000 !important;
      font-size: 13px !important;
      visibility: visible !important;
    }

    .change-row {
      color: #000000 !important;
      visibility: visible !important;
    }

    .thermal-feed-space {
      display: block !important;
      height: 15mm !important;
    }

    .no-print {
      display: none !important;
    }
  }
</style>
