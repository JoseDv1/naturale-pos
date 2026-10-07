/**
 * Dedicated 80mm Thermal Receipt Printing Service for Naturale POS.
 *
 * Provides isolated, clean thermal printing using a headless print iframe.
 * Prevents browser layout overflow (e.g. 150-page bug caused by global page flow)
 * and guarantees 100% of receipt items, totals, and typography render in exactly 1 page.
 */

export type PrintDarkness = 'normal' | 'dark' | 'extra-dark';

export function getThermalCSS(darkness: PrintDarkness = 'dark'): string {
  const strokeWidth = darkness === 'extra-dark' ? '0.42px' : darkness === 'dark' ? '0.22px' : '0px';
  const baseWeight = darkness === 'extra-dark' ? '800' : darkness === 'dark' ? '700' : '600';
  const headingWeight = '900';
  const boldWeight = darkness === 'extra-dark' ? '900' : '800';

  return `
  @page {
    size: 80mm auto;
    margin: 0mm;
  }

  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  html, body {
    width: 72mm;
    max-width: 72mm;
    margin: 0 auto;
    padding: 1.5mm 1.5mm 14mm 1.5mm;
    background: #ffffff !important;
    color: #000000 !important;
    font-family: 'Consolas', 'Courier New', 'Lucida Console', Monaco, 'DejaVu Sans Mono', monospace;
    font-size: 12px;
    font-weight: ${baseWeight};
    line-height: 1.35;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    -webkit-font-smoothing: antialiased;
    -webkit-text-stroke: ${strokeWidth} #000000;
    text-rendering: geometricPrecision;
  }

  /* Thermal Receipt Base */
  .thermal-receipt-80mm,
  .receipt-thermal-paper {
    width: 100%;
    max-width: 72mm;
    margin: 0 auto;
    background: #ffffff !important;
    color: #000000 !important;
    font-family: 'Consolas', 'Courier New', 'Lucida Console', Monaco, 'DejaVu Sans Mono', monospace;
    font-size: 12px;
    font-weight: ${baseWeight};
    line-height: 1.35;
  }

  /* Header */
  .receipt-header,
  .receipt-brand {
    text-align: center;
    margin-bottom: 4px;
  }

  .store-name,
  .receipt-logo {
    font-size: 16px;
    font-weight: ${headingWeight};
    letter-spacing: 0.5px;
    margin: 0 0 2px 0;
    color: #000000 !important;
    text-transform: uppercase;
  }

  .store-subtitle,
  .receipt-tagline {
    font-size: 11px;
    font-weight: ${boldWeight};
    margin: 0 0 3px 0;
    color: #000000 !important;
  }

  .meta-line,
  .receipt-meta {
    font-size: 10.5px;
    font-weight: ${baseWeight};
    margin: 1px 0;
    color: #000000 !important;
  }

  .legal-notice {
    font-size: 9.5px;
    font-weight: ${baseWeight};
    margin: 2px 0 0 0;
    color: #000000 !important;
  }

  .ticket-type-pill {
    display: inline-block;
    border: 1.5px solid #000000;
    font-size: 10px;
    font-weight: ${headingWeight};
    padding: 2px 6px;
    margin: 3px 0;
    text-transform: uppercase;
    color: #000000 !important;
  }

  .pre-receipt-badge {
    text-align: center;
    border: 1.5px dashed #000000 !important;
    padding: 3px 2px;
    margin: 4px 0;
    color: #000000 !important;
  }

  .pre-receipt-badge .badge-title {
    display: block;
    font-size: 13px;
    font-weight: ${headingWeight};
    letter-spacing: 0.5px;
    color: #000000 !important;
  }

  .pre-receipt-badge .badge-subtitle {
    display: block;
    font-size: 9px;
    font-weight: ${boldWeight};
    color: #000000 !important;
    margin-top: 1px;
  }

  .pre-receipt-notice-section {
    text-align: center;
    padding: 3px 0;
    margin: 2px 0;
  }

  .pre-receipt-headline {
    font-size: 11.5px;
    font-weight: ${headingWeight};
    color: #000000 !important;
    margin-bottom: 2px;
  }

  .pre-receipt-subtext {
    font-size: 9.5px;
    font-weight: ${baseWeight};
    color: #000000 !important;
    margin: 1px 0;
  }

  /* Monospace divider lines */
  .dashed-line,
  .receipt-divider,
  .receipt-divider-dashed {
    text-align: center;
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 11px;
    font-weight: ${headingWeight};
    letter-spacing: -0.5px;
    overflow: hidden;
    user-select: none;
    margin: 3px 0;
    color: #000000 !important;
    border: none;
  }

  /* Ticket Meta Info */
  .ticket-info,
  .receipt-details {
    margin: 3px 0;
    font-size: 11px;
    font-weight: ${baseWeight};
  }

  .info-row,
  .meta-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 2px;
    font-weight: ${baseWeight};
    color: #000000 !important;
  }

  .info-label {
    font-weight: ${baseWeight};
    color: #000000 !important;
  }

  .info-value {
    font-weight: ${headingWeight};
    color: #000000 !important;
  }

  .status-tag {
    font-weight: ${headingWeight};
    color: #000000 !important;
  }

  /* Items Table */
  .items-table-header {
    display: grid;
    grid-template-columns: 1fr 54px 66px;
    font-weight: ${headingWeight};
    font-size: 10.5px;
    margin: 2px 0;
    color: #000000 !important;
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
    font-weight: ${boldWeight};
    font-size: 11.5px;
    color: #000000 !important;
  }

  .item-qty {
    font-weight: ${headingWeight};
    min-width: 18px;
    color: #000000 !important;
  }

  .item-title {
    flex: 1;
    word-break: break-word;
    font-weight: ${boldWeight};
    color: #000000 !important;
  }

  .item-variant-line {
    font-size: 10px;
    padding-left: 22px;
    color: #000000 !important;
    font-weight: ${boldWeight};
  }

  .item-notes-line {
    font-size: 9.5px;
    padding-left: 22px;
    color: #000000 !important;
    font-weight: ${baseWeight};
    font-style: italic;
    word-break: break-word;
  }

  .item-pricing-line {
    display: grid;
    grid-template-columns: 1fr 54px 66px;
    font-size: 11px;
    font-weight: ${boldWeight};
    margin-top: 1px;
    color: #000000 !important;
  }

  .unit-price {
    text-align: right;
    color: #000000 !important;
    font-weight: ${boldWeight};
  }

  .item-total {
    text-align: right;
    font-weight: ${headingWeight};
    color: #000000 !important;
  }

  .empty-items-notice {
    text-align: center;
    font-style: italic;
    font-size: 11px;
    color: #000000 !important;
    font-weight: ${baseWeight};
    padding: 4px 0;
  }

  /* Totals */
  .totals-section,
  .receipt-summary-block {
    margin: 3px 0;
    font-size: 11.5px;
    font-weight: ${baseWeight};
  }

  .total-row,
  .summary-line {
    display: flex;
    justify-content: space-between;
    margin-bottom: 2px;
    font-weight: ${baseWeight};
    color: #000000 !important;
  }

  .discount-line {
    font-weight: ${headingWeight};
    color: #000000 !important;
  }

  .grand-total {
    font-size: 14px;
    font-weight: ${headingWeight};
    margin-top: 3px;
    padding-top: 2px;
    color: #000000 !important;
  }

  /* Payments Breakdown */
  .payments-section,
  .other-payments-block {
    margin: 3px 0;
    font-size: 11px;
    font-weight: ${baseWeight};
  }

  .payments-title {
    font-weight: ${headingWeight};
    margin: 0 0 2px 0;
    color: #000000 !important;
  }

  .payment-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 1.5px;
    font-weight: ${baseWeight};
    color: #000000 !important;
  }

  .change-row {
    font-weight: ${headingWeight};
    margin-top: 2px;
    color: #000000 !important;
  }

  /* Closure / Shift Summary tables */
  .receipt-grid,
  .summary-box {
    margin: 4px 0;
    font-size: 11px;
    font-weight: ${baseWeight};
  }

  .finance-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 2px;
    font-weight: ${baseWeight};
    color: #000000 !important;
  }

  .diff-row {
    display: flex;
    justify-content: space-between;
    font-weight: ${headingWeight};
    margin-top: 3px;
    color: #000000 !important;
  }

  .font-bold {
    font-weight: ${headingWeight} !important;
  }

  .signatures-box {
    margin-top: 16px;
    font-size: 10.5px;
    text-align: center;
    font-weight: ${baseWeight};
    color: #000000 !important;
  }

  .signature-line {
    margin-top: 20px;
    border-top: 1.5px dashed #000000;
    padding-top: 4px;
  }

  /* Footer */
  .receipt-footer {
    text-align: center;
    margin-top: 5px;
    font-size: 10.5px;
    font-weight: ${baseWeight};
    color: #000000 !important;
  }

  .footer-thankyou {
    font-weight: ${boldWeight};
    margin: 0 0 2px 0;
    color: #000000 !important;
  }

  .footer-instagram {
    font-size: 11px;
    font-weight: ${headingWeight};
    color: #000000 !important;
    margin: 3px 0 0 0;
    letter-spacing: 0.2px;
  }

  .thermal-feed-space {
    display: block;
    height: 14mm; /* Feed clearance past thermal cutter */
  }

  .no-print {
    display: none !important;
  }
  `;
}

export const THERMAL_CSS = getThermalCSS('dark');

function resolveDarkness(element: HTMLElement): PrintDarkness {
  if (element.classList.contains('darkness-extra-dark')) return 'extra-dark';
  if (element.classList.contains('darkness-normal')) return 'normal';
  if (element.classList.contains('darkness-dark')) return 'dark';

  try {
    const raw = localStorage.getItem('naturale_receipt_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.fontDarkness === 'extra-dark' || parsed.fontDarkness === 'normal' || parsed.fontDarkness === 'dark') {
        return parsed.fontDarkness;
      }
    }
  } catch {
    // Ignore JSON parse errors
  }
  return 'dark';
}

/**
 * Print an element directly via an isolated invisible iframe.
 * @param targetElementOrId HTMLElement or DOM ID string of the receipt container
 */
export function printThermalReceipt(
  targetElementOrId: HTMLElement | string,
  options?: { darkness?: PrintDarkness }
) {
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

  // Determine darkness setting from options, element classes, or localStorage
  const darkness = options?.darkness || resolveDarkness(clone);
  const activeCSS = getThermalCSS(darkness);

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
          ${activeCSS}
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
