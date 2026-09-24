<script lang="ts">
  import { receiptSettings, type ReceiptSettings } from '../../store';
  import ThermalReceipt80mm from '../molecules/ThermalReceipt80mm.svelte';

  interface Props {
    onclose: () => void;
  }

  let { onclose }: Props = $props();

  // Local draft of settings
  let localSettings = $state<ReceiptSettings>({ ...$receiptSettings });
  let saveFeedback = $state('');

  // Sample sale object for test printing
  const sampleSale = {
    id: 'DEMO-80MM-SAMPLE',
    createdAt: new Date().toISOString(),
    status: 'COMPLETED',
    total: 34500,
    change: 5500,
    user: { name: 'Cajero Principal' },
    table: null,
    items: [
      {
        product: { name: 'Café Cappuccino Especial' },
        variant: { name: '12oz / Deslactosada' },
        quantity: 2,
        price: 8500,
      },
      {
        product: { name: 'Muffin de Arándanos Orgánico' },
        variant: null,
        quantity: 1,
        price: 9500,
      },
      {
        product: { name: 'Bebida Kombucha Jengibre' },
        variant: null,
        quantity: 1,
        price: 8000,
      },
    ],
    payments: [
      { method: 'CASH', amount: 40000 },
    ],
  };

  function handleSave() {
    receiptSettings.set({ ...localSettings });
    saveFeedback = '✅ Configuración guardada exitosamente';
    setTimeout(() => {
      saveFeedback = '';
      onclose();
    }, 900);
  }

  function handleReset() {
    if (confirm('¿Restablecer los datos del ticket a los valores por defecto de Naturale?')) {
      receiptSettings.reset();
      localSettings = { ...$receiptSettings };
    }
  }

  function handleTestPrint() {
    window.print();
  }
</script>

<div class="modal-overlay flex-center animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="receipt-settings-title">
  <div class="modal-container glass-panel animate-scale-up settings-modal-box">
    <!-- Header -->
    <header class="modal-header no-print">
      <div class="header-titles">
        <h2 id="receipt-settings-title">🖨️ Configuración de Impresora y Ticket Térmico (80mm)</h2>
        <p class="header-subtitle">Personaliza los datos del encabezado, pie de página y comportamiento de la impresora</p>
      </div>
      <button type="button" class="close-modal-btn" onclick={onclose} aria-label="Cerrar modal">✕</button>
    </header>

    {#if saveFeedback}
      <div class="feedback-banner no-print animate-fade-in">{saveFeedback}</div>
    {/if}

    <div class="modal-body-split">
      <!-- Left side: Form Settings -->
      <form class="settings-form no-print" onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
        <div class="form-section-title">🏢 Información del Establecimiento</div>

        <div class="form-row">
          <div class="form-group flex-1">
            <label for="store-name">Nombre Comercial *</label>
            <input id="store-name" type="text" bind:value={localSettings.storeName} required placeholder="Ej: NATURALE" />
          </div>
          <div class="form-group flex-1">
            <label for="store-subtitle">Subtítulo / Razón Social</label>
            <input id="store-subtitle" type="text" bind:value={localSettings.storeSubtitle} placeholder="Ej: Tienda Saludable & Café" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group flex-1">
            <label for="store-nit">NIT / RUT / Identificación Fiscal</label>
            <input id="store-nit" type="text" bind:value={localSettings.taxId} placeholder="Ej: NIT: 901.234.567-8" />
          </div>
          <div class="form-group flex-1">
            <label for="store-phone">Teléfono / WhatsApp</label>
            <input id="store-phone" type="text" bind:value={localSettings.phone} placeholder="Ej: +57 300 123 4567" />
          </div>
        </div>

        <div class="form-group">
          <label for="store-address">Dirección Física</label>
          <input id="store-address" type="text" bind:value={localSettings.address} placeholder="Ej: Calle 10 # 4-20, Centro" />
        </div>

        <div class="form-group">
          <label for="store-legal">Régimen / Nota Legal</label>
          <input id="store-legal" type="text" bind:value={localSettings.legalNotice} placeholder="Ej: Régimen Simplificado - No responsable de IVA" />
        </div>

        <div class="form-section-title">📄 Pie de Ticket y Redes</div>

        <div class="form-group">
          <label for="store-footer">Mensaje de Agradecimiento</label>
          <input id="store-footer" type="text" bind:value={localSettings.footerMessage} placeholder="Ej: ¡Gracias por tu compra saludable!" />
        </div>

        <div class="form-group">
          <label for="store-web">Sitio Web / Instagram</label>
          <input id="store-web" type="text" bind:value={localSettings.website} placeholder="Ej: www.naturalepos.co / @naturalepos" />
        </div>

        <div class="form-section-title">⚙️ Automatización de Impresión</div>

        <div class="toggle-card">
          <label class="toggle-label" for="auto-print-checkbox">
            <input
              id="auto-print-checkbox"
              type="checkbox"
              bind:checked={localSettings.autoPrint}
            />
            <div class="toggle-text">
              <strong>Impresión Automática al Cobrar</strong>
              <p>Abre el diálogo de la impresora térmica inmediatamente al registrar cada venta en Checkout.</p>
            </div>
          </label>
        </div>
      </form>

      <!-- Right side: Live 80mm Preview -->
      <div class="preview-panel">
        <div class="preview-header no-print">
          <span>Vista Previa del Ticket (80mm)</span>
          <button type="button" class="btn-toggle-test" onclick={handleTestPrint}>
            🖨️ Probar Impresión
          </button>
        </div>
        <div class="receipt-preview-container scroll-y">
          <ThermalReceipt80mm
            sale={sampleSale}
            overrideSettings={localSettings}
            cashierName="Cajero de Turno"
          />
        </div>
      </div>
    </div>

    <!-- Footer Actions -->
    <footer class="modal-footer no-print">
      <div class="footer-left">
        <button type="button" class="btn btn-secondary btn-sm" onclick={handleReset}>
          ↺ Valores por Defecto
        </button>
      </div>
      <div class="footer-right">
        <button type="button" class="btn btn-secondary" onclick={onclose}>
          Cancelar
        </button>
        <button type="button" class="btn btn-primary" onclick={handleSave}>
          💾 Guardar Cambios
        </button>
      </div>
    </footer>
  </div>
</div>

<style>
  .settings-modal-box {
    max-width: 920px;
    width: 95vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    padding: 20px;
  }

  .header-titles h2 {
    font-size: 1.25rem;
    margin: 0;
    color: var(--text-primary);
  }

  .header-subtitle {
    font-size: 0.82rem;
    color: var(--text-secondary);
    margin: 3px 0 0 0;
  }

  .feedback-banner {
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid var(--color-general, #047857);
    color: var(--color-general, #047857);
    padding: 8px 14px;
    border-radius: var(--radius-sm, 8px);
    font-weight: 600;
    font-size: 0.88rem;
    margin-bottom: 12px;
    text-align: center;
  }

  .modal-body-split {
    display: grid;
    grid-template-columns: 1fr 340px;
    gap: 20px;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 4px;
  }

  @media (max-width: 800px) {
    .modal-body-split {
      grid-template-columns: 1fr;
    }
  }

  .settings-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .form-section-title {
    font-size: 0.85rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-general, #047857);
    border-bottom: 1px solid var(--border-glass);
    padding-bottom: 4px;
    margin-top: 8px;
  }

  .form-row {
    display: flex;
    gap: 12px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .form-group label {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .form-group input {
    background: rgba(255, 255, 255, 0.7);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm, 8px);
    padding: 8px 12px;
    font-size: 0.88rem;
    color: var(--text-primary);
    outline: none;
    transition: border-color var(--transition-fast, 0.15s);
  }

  .form-group input:focus {
    border-color: var(--color-general, #047857);
    background: #ffffff;
  }

  .toggle-card {
    background: rgba(4, 120, 87, 0.06);
    border: 1px solid rgba(4, 120, 87, 0.15);
    border-radius: var(--radius-sm, 8px);
    padding: 12px;
  }

  .toggle-label {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    cursor: pointer;
  }

  .toggle-label input[type="checkbox"] {
    width: 20px;
    height: 20px;
    margin-top: 2px;
    accent-color: var(--color-general, #047857);
    cursor: pointer;
  }

  .toggle-text strong {
    display: block;
    font-size: 0.9rem;
    color: var(--text-primary);
  }

  .toggle-text p {
    font-size: 0.8rem;
    color: var(--text-secondary);
    margin: 2px 0 0 0;
  }

  /* Preview Side */
  .preview-panel {
    display: flex;
    flex-direction: column;
    background: rgba(0, 0, 0, 0.03);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm, 8px);
    padding: 12px;
    min-height: 0;
  }

  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--text-secondary);
  }

  .btn-toggle-test {
    background: var(--color-general, #047857);
    color: #ffffff;
    border: none;
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    transition: opacity var(--transition-fast, 0.15s);
  }

  .btn-toggle-test:hover {
    opacity: 0.9;
  }

  .receipt-preview-container {
    flex: 1;
    overflow-y: auto;
    display: flex;
    justify-content: center;
    padding-bottom: 10px;
  }

  /* Footer */
  .modal-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid var(--border-glass);
  }

  .footer-right {
    display: flex;
    gap: 10px;
  }
</style>
