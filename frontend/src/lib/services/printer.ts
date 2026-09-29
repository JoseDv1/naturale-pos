/**
 * Dedicated 80mm Thermal Receipt Printing Service for Naturale POS.
 *
 * Provides isolated, clean thermal printing using a headless print iframe.
 * Prevents browser layout overflow (e.g. 150-page bug caused by global page flow)
 * and guarantees 100% of receipt items, totals, and typography render in exactly 1 page.
 */

const THERMAL_CSS = `
  @page {
    size: 80mm auto;
    margin: 0mm;
  }

  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html, body {
    width: 72mm;
    max-width: 72mm;
    margin: 0 auto;
    padding: 1mm 1.5mm 12mm 1.5mm;
    background: #ffffff !important;
    color: #000000 !important;
    font-family: 'Courier New', Courier, monospace, monospace;
    font-size: 11px;
    line-height: 1.3;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Thermal Receipt Base */
  .thermal-receipt-80mm,
  .receipt-thermal-paper {
    width: 100%;
    max-width: 72mm;
    margin: 0 auto;
    background: #ffffff;
    color: #000000;
    font-family: 'Courier New', Courier, monospace, monospace;
    font-size: 11px;
    line-height: 1.3;
  }

  /* Header */
  .receipt-header,
  .receipt-brand {
    text-align: center;
    margin-bottom: 4px;
  }

  .store-name,
  .receipt-logo {
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.5px;
    margin: 0 0 2px 0;
    color: #000000;
    text-transform: uppercase;
  }

  .store-subtitle,
  .receipt-tagline {
    font-size: 10.5px;
    font-weight: 600;
    margin: 0 0 3px 0;
    color: #222222;
  }

  .meta-line,
  .receipt-meta {
    font-size: 10px;
    margin: 1px 0;
    color: #333333;
  }

  .legal-notice {
    font-size: 9px;
    margin: 2px 0 0 0;
    color: #444444;
    font-style: italic;
  }

  .ticket-type-pill {
    display: inline-block;
    border: 1px solid #000000;
    font-size: 9.5px;
    font-weight: 700;
    padding: 2px 6px;
    margin: 3px 0;
    text-transform: uppercase;
  }

  /* Monospace divider lines */
  .dashed-line,
  .receipt-divider {
    text-align: center;
    font-size: 10px;
    font-weight: bold;
    letter-spacing: -0.5px;
    overflow: hidden;
    user-select: none;
    margin: 3px 0;
    color: #000000;
    border: none;
  }

  /* Ticket Meta Info */
  .ticket-info {
    margin: 3px 0;
    font-size: 10.5px;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 1.5px;
  }

  .info-label {
    font-weight: 600;
  }

  .info-value {
    font-weight: 700;
  }

  .status-tag {
    font-weight: bold;
  }

  /* Items Table */
  .items-table-header {
    display: grid;
    grid-template-columns: 1fr 52px 64px;
    font-weight: 700;
    font-size: 10px;
    margin: 2px 0;
  }

  .col-item-desc { text-align: left; }
  .col-item-unit { text-align: right; }
  .col-item-sub { text-align: right; }

  .items-list {
    margin: 2px 0;
  }

  .receipt-item-entry {
    margin-bottom: 5px;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .item-primary-line {
    display: flex;
    gap: 4px;
    font-weight: 700;
    font-size: 11px;
    color: #000000;
  }

  .item-qty {
    font-weight: 800;
    min-width: 18px;
  }

  .item-title {
    flex: 1;
    word-break: break-word;
  }

  .item-variant-line {
    font-size: 9.5px;
    padding-left: 22px;
    color: #222222;
    font-weight: 600;
  }

  .item-notes-line {
    font-size: 9px;
    padding-left: 22px;
    color: #333333;
    font-style: italic;
    word-break: break-word;
  }

  .item-pricing-line {
    display: grid;
    grid-template-columns: 1fr 52px 64px;
    font-size: 10px;
    margin-top: 1px;
  }

  .unit-price {
    text-align: right;
    color: #333333;
  }

  .item-total {
    text-align: right;
    font-weight: 700;
    color: #000000;
  }

  .empty-items-notice {
    text-align: center;
    font-style: italic;
    font-size: 10px;
    color: #444444;
    padding: 4px 0;
  }

  /* Totals */
  .totals-section {
    margin: 3px 0;
    font-size: 11px;
  }

  .total-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 2px;
  }

  .discount-line {
    font-weight: 700;
  }

  .grand-total {
    font-size: 13px;
    font-weight: 800;
    margin-top: 3px;
    padding-top: 2px;
    color: #000000;
  }

  /* Payments Breakdown */
  .payments-section {
    margin: 3px 0;
    font-size: 10.5px;
  }

  .payments-title {
    font-weight: 700;
    margin: 0 0 2px 0;
  }

  .payment-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 1.5px;
  }

  .change-row {
    font-weight: 800;
    margin-top: 2px;
  }

  /* Closure / Shift Summary tables */
  .receipt-grid,
  .summary-box {
    margin: 4px 0;
    font-size: 10.5px;
  }

  .finance-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 2px;
  }

  .diff-row {
    display: flex;
    justify-content: space-between;
    font-weight: 800;
    margin-top: 3px;
  }

  .signatures-box {
    margin-top: 16px;
    font-size: 10px;
    text-align: center;
  }

  .signature-line {
    margin-top: 20px;
    border-top: 1px dashed #000000;
    padding-top: 4px;
  }

  /* Footer */
  .receipt-footer {
    text-align: center;
    margin-top: 5px;
    font-size: 10px;
  }

  .footer-thankyou {
    font-weight: 700;
    margin: 0 0 2px 0;
    color: #000000;
  }

  .footer-meta {
    font-size: 9.5px;
    color: #333333;
    margin: 0 0 3px 0;
  }

  .footer-pos-brand {
    font-size: 8.5px;
    color: #555555;
    margin: 2px 0 0 0;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .thermal-feed-space {
    display: block;
    height: 14mm; /* Feed clearance past thermal cutter */
  }

  .no-print {
    display: none !important;
  }
`;

/**
 * Print an element directly via an isolated invisible iframe.
 * @param targetElementOrId HTMLElement or DOM ID string of the receipt container
 */
export function printThermalReceipt(targetElementOrId: HTMLElement | string) {
  if (typeof window === 'undefined') return;

  const element = typeof targetElementOrId === 'string'
    ? document.getElementById(targetElementOrId)
    : targetElementOrId;

  if (!element) {
    console.warn('[Printer] Element not found for ID/ref:', targetElementOrId, '— falling back to window.print()');
    window.print();
    return;
  }

  // Remove any non-print elements in cloned tree
  const clone = element.cloneNode(true) as HTMLElement;
  const noPrintEls = clone.querySelectorAll('.no-print');
  noPrintEls.forEach((el) => el.remove());

  // Reuse or construct a clean print iframe
  let iframe = document.getElementById('naturale-pos-print-iframe') as HTMLIFrameElement | null;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'naturale-pos-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.margin = '0';
    iframe.style.padding = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);
  }

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) {
    console.warn('[Printer] Unable to access print iframe document — fallback to window.print()');
    window.print();
    return;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Ticket Naturale POS</title>
        <style>
          ${THERMAL_CSS}
        </style>
      </head>
      <body>
        ${clone.outerHTML}
      </body>
    </html>
  `;

  iframeDoc.open();
  iframeDoc.write(htmlContent);
  iframeDoc.close();

  // Small delay to ensure browser finishes parsing iframe DOM and calculating layout
  setTimeout(() => {
    try {
      const win = iframe?.contentWindow;
      if (win) {
        win.focus();
        win.print();
      } else {
        window.print();
      }
    } catch (err) {
      console.error('[Printer] Printing from iframe failed:', err);
      window.print();
    }
  }, 150);
}
