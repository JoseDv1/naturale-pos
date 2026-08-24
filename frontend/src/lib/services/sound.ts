// Web Audio API POS Sound Engine
let audioCtx: AudioContext | null = null;
let soundEnabled = true;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function setSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

/**
 * Plays a clean, high-frequency POS confirmation beep (success scan)
 */
export function playScanSuccess() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1760, now); // A6 note
    osc.frequency.exponentialRampToValueAtTime(1860, now + 0.07);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  } catch (e) {
    console.error('Audio playback error:', e);
  }
}

/**
 * Plays a low double-tone buzzer (error / product not found / out of stock)
 */
export function playScanError() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // Tone 1 (320Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(320, now);

    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.095);

    // Tone 2 (220Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(220, now + 0.11);

    gain2.gain.setValueAtTime(0.0001, now + 0.11);
    gain2.gain.exponentialRampToValueAtTime(0.2, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.11);
    osc2.stop(now + 0.23);
  } catch (e) {
    console.error('Audio error playback error:', e);
  }
}
