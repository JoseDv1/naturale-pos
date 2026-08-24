<script lang="ts">
  import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
  import Spinner from '../atoms/Spinner.svelte';

  interface Props {
    title?: string;
    mode?: 'single' | 'continuous';
    onscan: (barcode: string) => void;
    onclose: () => void;
  }

  let {
    title = 'Lector de Códigos de Barras',
    mode = 'continuous',
    onscan,
    onclose
  }: Props = $props();

  let scanMode = $state<'single' | 'continuous'>('continuous');

  $effect(() => {
    scanMode = mode;
  });
  let html5QrCode: Html5Qrcode | null = null;
  let isScanning = $state(false);
  let isLoadingCamera = $state(true);
  let cameraError = $state('');
  let cameras = $state<Array<{ id: string; label: string }>>([]);
  let selectedCameraId = $state('');
  let torchOn = $state(false);
  let torchSupported = $state(false);
  let lastScannedCode = $state('');
  let lastScannedTime = $state(0);

  const containerId = 'barcode-reader-viewfinder';

  $effect(() => {
    startScanner();

    return () => {
      stopScanner();
    };
  });

  async function startScanner() {
    isLoadingCamera = true;
    cameraError = '';

    try {
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        cameraError = 'No se detectó ninguna cámara en este dispositivo.';
        isLoadingCamera = false;
        return;
      }

      cameras = devices;
      if (!selectedCameraId) {
        // Prefer back camera if available
        const backCam = devices.find(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('trasera') ||
          d.label.toLowerCase().includes('environment')
        );
        selectedCameraId = backCam ? backCam.id : devices[0].id;
      }

      html5QrCode = new Html5Qrcode(containerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.ITF,
        ],
        verbose: false
      });

      const qrConfig = {
        fps: 15,
        qrbox: { width: 280, height: 180 },
        aspectRatio: 1.333334
      };

      await html5QrCode.start(
        selectedCameraId,
        qrConfig,
        (decodedText) => {
          handleDecodedBarcode(decodedText);
        },
        () => {
          // Ignore individual frame non-detections
        }
      );

      isScanning = true;
      isLoadingCamera = false;

      // Check torch support
      try {
        const capabilities = html5QrCode.getRunningTrackCapabilities?.();
        if (capabilities && (capabilities as any).torch) {
          torchSupported = true;
        }
      } catch (e) {
        torchSupported = false;
      }

    } catch (err: any) {
      console.error('Camera init error:', err);
      cameraError = err?.message || 'Error al iniciar la cámara. Verifica los permisos del navegador.';
      isLoadingCamera = false;
    }
  }

  async function handleCameraChange(newCameraId: string) {
    selectedCameraId = newCameraId;
    await stopScanner();
    await startScanner();
  }

  async function toggleTorch() {
    if (!html5QrCode || !isScanning) return;
    try {
      torchOn = !torchOn;
      await html5QrCode.applyVideoConstraints({
        advanced: [{ torch: torchOn } as any]
      });
    } catch (e) {
      console.error('Torch error:', e);
    }
  }

  function handleDecodedBarcode(code: string) {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    const now = Date.now();
    // In continuous mode, prevent duplicate trigger within 1.4s for identical barcode
    if (cleanCode === lastScannedCode && (now - lastScannedTime) < 1400) {
      return;
    }

    lastScannedCode = cleanCode;
    lastScannedTime = now;

    onscan(cleanCode);

    if (scanMode === 'single') {
      closeModal();
    }
  }

  async function stopScanner() {
    if (html5QrCode && isScanning) {
      try {
        await html5QrCode.stop();
      } catch (e) {
        // Ignore stop error
      }
      isScanning = false;
    }
  }

  function closeModal() {
    stopScanner();
    onclose();
  }
</script>

<div class="scanner-modal-overlay flex-center animate-fade-in" role="dialog" aria-modal="true">
  <div class="scanner-modal-container glass-panel animate-scale-up">
    <!-- Header -->
    <div class="scanner-header">
      <div class="header-title-group">
        <span class="scanner-badge-icon">📷</span>
        <h2>{title}</h2>
      </div>
      <button class="btn-close-scanner" onclick={closeModal} aria-label="Cerrar escáner">✕</button>
    </div>

    <!-- Mode Selector & Controls -->
    <div class="scanner-controls-bar">
      <div class="mode-toggle-group">
        <button
          class="mode-btn"
          class:active={scanMode === 'continuous'}
          onclick={() => scanMode = 'continuous'}
          type="button"
        >
          🔄 Continuo
        </button>
        <button
          class="mode-btn"
          class:active={scanMode === 'single'}
          onclick={() => scanMode = 'single'}
          type="button"
        >
          🎯 Único
        </button>
      </div>

      {#if cameras.length > 1}
        <select
          class="camera-select"
          bind:value={selectedCameraId}
          onchange={(e) => handleCameraChange((e.target as HTMLSelectElement).value)}
        >
          {#each cameras as cam}
            <option value={cam.id}>{cam.label || `Cámara ${cam.id.slice(0, 4)}`}</option>
          {/each}
        </select>
      {/if}

      {#if torchSupported}
        <button
          class="btn-torch"
          class:active={torchOn}
          onclick={toggleTorch}
          type="button"
          title="Encender/Apagar Linterna"
        >
          🔦 {torchOn ? 'ON' : 'OFF'}
        </button>
      {/if}
    </div>

    <!-- Viewfinder Area -->
    <div class="scanner-viewport-wrapper">
      {#if isLoadingCamera}
        <div class="camera-loading-state flex-center">
          <Spinner size="42px" />
          <p>Conectando con la cámara...</p>
        </div>
      {/if}

      {#if cameraError}
        <div class="camera-error-state flex-center">
          <span class="error-icon">⚠️</span>
          <p>{cameraError}</p>
          <button class="btn btn-secondary" onclick={startScanner} style="margin-top: 12px;">
            Reintentar
          </button>
        </div>
      {/if}

      <!-- Target container for html5-qrcode -->
      <div id={containerId} class="reader-container" class:hidden={isLoadingCamera || !!cameraError}></div>

      {#if isScanning && !cameraError}
        <!-- Custom Laser and Corner Framing Overlay -->
        <div class="scanner-overlay-reticle" aria-hidden="true">
          <div class="reticle-box">
            <div class="reticle-corner top-left"></div>
            <div class="reticle-corner top-right"></div>
            <div class="reticle-corner bottom-left"></div>
            <div class="reticle-corner bottom-right"></div>
            <div class="laser-scanner-line"></div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Footer Guide -->
    <div class="scanner-footer">
      {#if lastScannedCode}
        <div class="last-scanned-banner animate-fade-in">
          <span>Último código leído:</span>
          <strong>{lastScannedCode}</strong>
        </div>
      {:else}
        <p class="guide-text">Apunta la cámara al código de barras o QR del producto</p>
      {/if}
      <button class="btn btn-secondary close-btn-bottom" onclick={closeModal}>
        Listo / Cerrar
      </button>
    </div>
  </div>
</div>

<style>
  .scanner-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(3, 7, 18, 0.85);
    backdrop-filter: blur(8px);
    z-index: 1500;
  }

  .scanner-modal-container {
    width: 100%;
    max-width: 480px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-sizing: border-box;
    border-radius: var(--radius-lg, 16px);
  }

  .scanner-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-title-group {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .scanner-badge-icon {
    font-size: 1.4rem;
  }

  .header-title-group h2 {
    font-size: 1.2rem;
    font-weight: 600;
    margin: 0;
  }

  .btn-close-scanner {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 1.25rem;
    cursor: pointer;
    outline: none;
    padding: 4px 8px;
    border-radius: 4px;
    transition: var(--transition-fast);
  }
  .btn-close-scanner:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.08);
  }

  .scanner-controls-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    justify-content: space-between;
  }

  .mode-toggle-group {
    display: flex;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    padding: 3px;
  }

  .mode-btn {
    border: none;
    background: transparent;
    color: var(--text-secondary);
    padding: 6px 12px;
    border-radius: 5px;
    font-size: 0.82rem;
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .mode-btn.active {
    background: rgba(255, 255, 255, 0.12);
    color: var(--text-primary);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  .camera-select {
    flex: 1;
    font-size: 0.8rem;
    padding: 6px 10px;
    max-width: 180px;
  }

  .btn-torch {
    border: 1px solid var(--border-glass);
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-secondary);
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    font-size: 0.82rem;
    cursor: pointer;
    transition: var(--transition-fast);
  }
  .btn-torch.active {
    background: #f59e0b;
    color: #000;
    font-weight: 600;
  }

  .scanner-viewport-wrapper {
    position: relative;
    width: 100%;
    min-height: 260px;
    max-height: 320px;
    background: #000;
    border-radius: var(--radius-md);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border-glass);
  }

  .reader-container {
    width: 100% !important;
    height: 100% !important;
  }

  :global(#barcode-reader-viewfinder video) {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
    border-radius: var(--radius-md);
  }

  :global(#barcode-reader-viewfinder__scan_region) {
    min-height: 240px !important;
  }

  .camera-loading-state,
  .camera-error-state {
    flex-direction: column;
    padding: 24px;
    text-align: center;
    gap: 12px;
    color: var(--text-secondary);
  }

  .error-icon {
    font-size: 2.2rem;
  }

  .hidden {
    display: none;
  }

  /* Reticle & Laser Overlay */
  .scanner-overlay-reticle {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .reticle-box {
    position: relative;
    width: 240px;
    height: 150px;
  }

  .reticle-corner {
    position: absolute;
    width: 20px;
    height: 20px;
    border: 3px solid var(--color-market, #10b981);
  }

  .top-left {
    top: 0;
    left: 0;
    border-right: none;
    border-bottom: none;
    border-top-left-radius: 6px;
  }

  .top-right {
    top: 0;
    right: 0;
    border-left: none;
    border-bottom: none;
    border-top-right-radius: 6px;
  }

  .bottom-left {
    bottom: 0;
    left: 0;
    border-right: none;
    border-top: none;
    border-bottom-left-radius: 6px;
  }

  .bottom-right {
    bottom: 0;
    right: 0;
    border-left: none;
    border-top: none;
    border-bottom-right-radius: 6px;
  }

  .laser-scanner-line {
    position: absolute;
    top: 0;
    left: 4px;
    right: 4px;
    height: 2px;
    background: linear-gradient(90deg, transparent, #10b981, #34d399, #10b981, transparent);
    box-shadow: 0 0 10px #10b981;
    animation: laserScan 2s infinite ease-in-out;
  }

  @keyframes laserScan {
    0% {
      top: 5%;
      opacity: 0.3;
    }
    50% {
      top: 90%;
      opacity: 1;
    }
    100% {
      top: 5%;
      opacity: 0.3;
    }
  }

  .scanner-footer {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .guide-text {
    font-size: 0.85rem;
    color: var(--text-secondary);
    text-align: center;
    margin: 0;
  }

  .last-scanned-banner {
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.3);
    padding: 8px 14px;
    border-radius: var(--radius-sm);
    display: flex;
    justify-content: space-between;
    font-size: 0.88rem;
    color: #a7f3d0;
  }

  .close-btn-bottom {
    width: 100%;
    height: 40px;
  }
</style>
