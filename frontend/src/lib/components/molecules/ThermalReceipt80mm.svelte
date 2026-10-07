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
    isPreReceipt?: boolean;
    elementId?: string;
  }

  let {
    sale,
    overrideSettings,
    cashierName,
    tableName,
    showPrintButton = false,
    onprint,
    isPreReceipt = false,
    elementId = 'printable-thermal-receipt',
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
    if (isPreReceipt) return 'PENDIENTE';
    if (!sale?.status || sale.status === 'COMPLETED') return 'COMPLETADA';
    if (sale.status === 'CANCELLED') return 'ANULADA';
    if (sale.status === 'TRANSFER_OUT') return 'TRASLADO';
    return sale.status;
  });

  let fontDarkness = $derived(settings.fontDarkness || 'dark');

  function handlePrint() {
    if (onprint) {
      onprint();
    } else {
      printThermalReceipt(elementId, { darkness: fontDarkness });
    }
  }
</script>

<div class="thermal-receipt-wrapper">
  {#if showPrintButton}
    <div class="print-actions-bar no-print">
      <button type="button" class="btn-print-action" onclick={handlePrint}>
        {isPreReceipt ? '🖨️ Imprimir Pre-Cuenta (80mm)' : '🖨️ Imprimir Ticket (80mm)'}
      </button>
    </div>
  {/if}

  <!-- The printable 80mm ticket -->
  <article
    class="thermal-receipt-80mm darkness-{fontDarkness}"
    id={elementId}
    aria-label={isPreReceipt ? 'Pre-cuenta térmica de mesa 80mm' : 'Ticket térmico de venta 80mm'}
  >
    <!-- Header / Brand -->
    <header class="receipt-header">
      <h1 class="store-name">{settings.storeName || 'NATURALE'}</h1>
    </header>

    {#if isPreReceipt}
      <div class="pre-receipt-badge" aria-label="Comprobante Pre-Cuenta">
        <span class="badge-title">*** PRE-CUENTA ***</span>
        <span class="badge-subtitle">CUENTA PROVISIONAL • NO VÁLIDO COMO FACTURA</span>
      </div>
    {/if}

    <!-- Snippets for repeating receipt row layouts -->
    {#snippet infoRow(label: string, value: string, isStrong: boolean = false, extraClass: string = '')}
      <div class="info-row">
        <span class="info-label">{label}</span>
        {#if isStrong}
          <strong class="info-value {extraClass}">{value}</strong>
        {:else}
          <span class="info-value {extraClass}">{value}</span>
        {/if}
      </div>
    {/snippet}

    {#snippet totalRow(label: string, value: string, extraClass: string = '')}
      <div class="total-row {extraClass}">
        <span>{label}</span>
        <span>{value}</span>
      </div>
    {/snippet}

    {#snippet paymentRow(label: string, value: string, extraClass: string = '')}
      <div class="payment-row {extraClass}">
        <span>{label}</span>
        <span>{value}</span>
      </div>
    {/snippet}

    <div class="dashed-line" aria-hidden="true">================================</div>

    <!-- Ticket Info -->
    <section class="ticket-info">
      {#if isPreReceipt}
        {@render infoRow('DOCUMENTO:', 'PRE-CUENTA / COMANDA', true)}
        {@render infoRow('FECHA:', formattedDate)}
        {@render infoRow('ATENDIDO POR:', effectiveCashier)}
        {#if effectiveTable}
          {@render infoRow('MESA / CUENTA:', effectiveTable, true)}
        {/if}
        {@render infoRow('ESTADO:', 'PENDIENTE DE PAGO', false, 'status-tag')}
      {:else}
        {@render infoRow('FACTURA/TICKET:', `#${ticketId}`, true)}
        {@render infoRow('FECHA:', formattedDate)}
        {@render infoRow('CAJERO:', effectiveCashier)}
        {#if effectiveTable}
          {@render infoRow('MESA / CUENTA:', effectiveTable, true)}
        {/if}
        {@render infoRow('ESTADO:', statusLabel, false, 'status-tag')}
      {/if}
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
      {@render totalRow('SUBTOTAL:', `$${subtotalAmount.toLocaleString('es-CO')}`)}
      {#if discountAmount > 0}
        {@render totalRow('DESCUENTO:', `-$${discountAmount.toLocaleString('es-CO')}`, 'discount-line')}
      {/if}
      {@render totalRow('TOTAL A PAGAR:', `$${totalAmount.toLocaleString('es-CO')}`, 'grand-total')}
    </section>

    <div class="dashed-line" aria-hidden="true">================================</div>

    {#if !isPreReceipt}
      <!-- Payment Breakdown -->
      <section class="payments-section">
        <p class="payments-title">MÉTODO(S) DE PAGO:</p>
        {#each normalizedPayments as pay}
          {@render paymentRow(`${pay.methodName}:`, `$${pay.amount.toLocaleString('es-CO')}`)}
        {/each}
        {#if changeAmount > 0}
          {@render paymentRow('CAMBIO ENTREGADO:', `$${changeAmount.toLocaleString('es-CO')}`, 'change-row')}
        {/if}
      </section>
    {:else}
      <!-- Pre-receipt payment pending notice -->
      <section class="pre-receipt-notice-section">
        <p class="pre-receipt-headline">*** CUENTA PENDIENTE DE COBRO ***</p>
        <p class="pre-receipt-subtext">Por favor acérquese a caja para realizar su pago.</p>
        <p class="pre-receipt-subtext">Propina voluntaria no incluida.</p>
      </section>
    {/if}

    <div class="dashed-line" aria-hidden="true">--------------------------------</div>

    <!-- Footer -->
    <footer class="receipt-footer">
      {#if settings.footerMessage}
        <p class="footer-thankyou">{settings.footerMessage}</p>
      {/if}
      <p class="footer-instagram">{settings.instagram || '@naturale.mercadosaludable'}</p>
      <!-- Feed space for thermal cutter clearance (14mm) -->
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
    color: #000000;
    font-family: 'Consolas', 'Courier New', 'Lucida Console', Monaco, monospace;
    font-size: 12px;
    font-weight: 700;
    line-height: 1.35;
    padding: 18px 14px 22px 14px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
    border-radius: 4px;
    box-sizing: border-box;
    border-top: 4px solid var(--color-general, #047857);
    -webkit-font-smoothing: antialiased;
    text-rendering: geometricPrecision;
  }

  /* Darkness variants */
  .thermal-receipt-80mm.darkness-normal {
    font-weight: 600;
    -webkit-text-stroke: 0px #000000;
  }

  .thermal-receipt-80mm.darkness-dark {
    font-weight: 700;
    -webkit-text-stroke: 0.22px #000000;
  }

  .thermal-receipt-80mm.darkness-extra-dark {
    font-weight: 800;
    -webkit-text-stroke: 0.42px #000000;
  }

  /* Header Styles */
  .receipt-header {
    text-align: center;
    margin-bottom: 4px;
  }

  .store-name {
    font-size: 16px;
    font-weight: 900;
    letter-spacing: 0.5px;
    margin: 0 0 2px 0;
    color: #000000;
    text-transform: uppercase;
  }

  /* Pre-Receipt Elements */
  .pre-receipt-badge {
    text-align: center;
    border: 1.5px dashed #000000;
    padding: 4px 2px;
    margin: 4px 0 6px 0;
    background: #f8fafc;
  }

  .pre-receipt-badge .badge-title {
    display: block;
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 1px;
    color: #000000;
  }

  .pre-receipt-badge .badge-subtitle {
    display: block;
    font-size: 9px;
    font-weight: 800;
    color: #000000;
    margin-top: 2px;
  }

  .pre-receipt-notice-section {
    text-align: center;
    padding: 4px 0;
    margin: 3px 0;
  }

  .pre-receipt-headline {
    font-size: 11.5px;
    font-weight: 900;
    color: #000000;
    margin-bottom: 2px;
  }

  .pre-receipt-subtext {
    font-size: 9.5px;
    font-weight: 700;
    color: #000000;
    margin: 1px 0;
  }

  /* Dashed Divider Lines (monospace art for thermal pin precision) */
  .dashed-line {
    text-align: center;
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: -0.5px;
    overflow: hidden;
    user-select: none;
    margin: 4px 0;
    color: #000000;
  }

  /* Ticket Meta Info */
  .ticket-info {
    margin: 4px 0;
    font-size: 11.5px;
    font-weight: 700;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 2px;
  }

  .info-label {
    font-weight: 700;
    color: #000000;
  }

  .info-value {
    font-weight: 800;
    color: #000000;
  }

  .status-tag {
    font-weight: 900;
    color: #000000;
  }

  /* Table Header */
  .items-table-header {
    display: grid;
    grid-template-columns: 1fr 54px 66px;
    font-weight: 900;
    font-size: 10.5px;
    margin: 2px 0;
    color: #000000;
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
    font-weight: 800;
    font-size: 12px;
    color: #000000;
  }

  .item-qty {
    font-weight: 900;
    min-width: 20px;
    color: #000000;
  }

  .item-title {
    flex: 1;
    word-break: break-word;
    font-weight: 800;
    color: #000000;
  }

  .item-variant-line {
    font-size: 10.5px;
    padding-left: 26px;
    color: #111111;
    font-weight: 700;
  }

  .item-notes-line {
    font-size: 10px;
    padding-left: 26px;
    color: #222222;
    font-style: italic;
    word-break: break-word;
    margin-top: 1px;
    font-weight: 700;
  }

  .item-pricing-line {
    display: grid;
    grid-template-columns: 1fr 54px 66px;
    font-size: 11.5px;
    font-weight: 700;
    margin-top: 1px;
    color: #000000;
  }

  .unit-price {
    text-align: right;
    color: #000000;
    font-weight: 700;
  }

  .item-total {
    text-align: right;
    font-weight: 900;
    color: #000000;
  }

  .empty-items-notice {
    text-align: center;
    font-style: italic;
    font-size: 11px;
    color: #222222;
    font-weight: 700;
    padding: 6px 0;
  }

  /* Totals Section */
  .totals-section {
    margin: 4px 0;
    font-size: 12px;
    font-weight: 700;
  }

  .total-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 2px;
    font-weight: 700;
    color: #000000;
  }

  .discount-line {
    color: #be123c;
    font-weight: 800;
  }

  .grand-total {
    font-size: 14.5px;
    font-weight: 900;
    margin-top: 4px;
    padding-top: 2px;
    color: #000000;
  }

  /* Payments Breakdown */
  .payments-section {
    margin: 4px 0;
    font-size: 11.5px;
    font-weight: 700;
  }

  .payments-title {
    font-weight: 900;
    margin: 0 0 2px 0;
    color: #000000;
  }

  .payment-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 1.5px;
    font-weight: 700;
    color: #000000;
  }

  .change-row {
    font-weight: 900;
    margin-top: 2px;
    color: #047857;
  }

  /* Footer */
  .receipt-footer {
    text-align: center;
    margin-top: 6px;
    font-size: 11px;
    font-weight: 700;
    color: #000000;
  }

  .footer-thankyou {
    font-weight: 800;
    margin: 0 0 2px 0;
    color: #000000;
  }

  .footer-instagram {
    font-size: 11px;
    font-weight: 900;
    color: #000000;
    margin: 3px 0 0 0;
    letter-spacing: 0.2px;
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

    :global(.thermal-receipt-80mm.darkness-normal) {
      font-weight: 600 !important;
      -webkit-text-stroke: 0px #000000 !important;
    }

    :global(.thermal-receipt-80mm.darkness-dark) {
      font-weight: 700 !important;
      -webkit-text-stroke: 0.22px #000000 !important;
    }

    :global(.thermal-receipt-80mm.darkness-extra-dark) {
      font-weight: 800 !important;
      -webkit-text-stroke: 0.42px #000000 !important;
    }

    .dashed-line {
      color: #000000 !important;
      letter-spacing: -0.5px !important;
      font-weight: 900 !important;
      visibility: visible !important;
    }

    .store-name {
      color: #000000 !important;
      font-size: 16px !important;
      font-weight: 900 !important;
      visibility: visible !important;
    }

    .pre-receipt-badge {
      border: 1.5px dashed #000000 !important;
      background: transparent !important;
      color: #000000 !important;
      visibility: visible !important;
    }

    .pre-receipt-badge .badge-title,
    .pre-receipt-badge .badge-subtitle,
    .pre-receipt-notice-section,
    .pre-receipt-headline,
    .pre-receipt-subtext {
      color: #000000 !important;
      visibility: visible !important;
    }

    .receipt-item-entry,
    .item-primary-line,
    .item-pricing-line,
    .item-title,
    .item-qty,
    .unit-price,
    .item-total,
    .item-variant-line,
    .item-notes-line {
      color: #000000 !important;
      visibility: visible !important;
    }

    .item-qty {
      font-weight: 900 !important;
    }

    .item-title {
      font-weight: 800 !important;
    }

    .item-total {
      font-weight: 900 !important;
    }

    .receipt-item-entry {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .total-row,
    .discount-line,
    .grand-total {
      color: #000000 !important;
      visibility: visible !important;
    }

    .grand-total {
      font-size: 14px !important;
      font-weight: 900 !important;
    }

    .payment-row,
    .change-row {
      color: #000000 !important;
      visibility: visible !important;
    }

    .change-row {
      font-weight: 900 !important;
    }

    .footer-thankyou,
    .footer-instagram {
      color: #000000 !important;
      font-weight: 900 !important;
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
