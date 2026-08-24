/**
 * Hardware Barcode Scanner (HID Keyboard Wedge) Global Listener
 *
 * Captures rapid bursts of keystrokes from USB/Bluetooth handheld scanners
 * and invokes callback when Enter is pressed.
 */

export interface ScannerOptions {
  onScan: (barcode: string) => void;
  maxIntervalMs?: number; // Maximum ms between characters (default: 50ms)
  minLength?: number;     // Minimum length of valid barcode (default: 3)
}

export function attachHardwareScannerListener(options: ScannerOptions): () => void {
  const maxIntervalMs = options.maxIntervalMs ?? 60;
  const minLength = options.minLength ?? 2;

  let buffer: string[] = [];
  let lastKeyTime = 0;

  function handleKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    const isInputOrTextarea = target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    );

    // If Enter key is pressed
    if (event.key === 'Enter') {
      const now = Date.now();
      const interval = now - lastKeyTime;
      const scannedCode = buffer.join('').trim();

      // If we have characters in buffer and they were typed rapidly or captured
      if (scannedCode.length >= minLength) {
        // Scanner burst detected
        event.preventDefault();
        buffer = [];
        options.onScan(scannedCode);
        return;
      }

      // If user pressed Enter in a search input that has text
      if (isInputOrTextarea && target instanceof HTMLInputElement && target.type === 'text') {
        const val = target.value.trim();
        if (val.length >= minLength && target.classList.contains('search-input')) {
          // If targeted search input
          options.onScan(val);
          target.value = '';
          event.preventDefault();
        }
      }

      buffer = [];
      return;
    }

    // Ignore modifier keys, functional keys, etc.
    if (event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }

    const currentTime = Date.now();
    const timeDiff = currentTime - lastKeyTime;

    if (lastKeyTime !== 0 && timeDiff > maxIntervalMs) {
      // Too slow to be a hardware scanner burst; reset buffer
      buffer = [];
    }

    lastKeyTime = currentTime;
    buffer.push(event.key);

    // If this is a hardware scanner burst while not in an input, prevent default to avoid stray characters
    if (!isInputOrTextarea && buffer.length > 2 && timeDiff < maxIntervalMs) {
      event.preventDefault();
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeyDown, true);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', handleKeyDown, true);
    }
  };
}
