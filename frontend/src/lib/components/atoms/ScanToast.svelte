<script lang="ts">
  export interface ToastData {
    message: string;
    subtext?: string;
    type: 'success' | 'error' | 'warning';
  }

  interface Props {
    toast: ToastData | null;
  }

  let { toast }: Props = $props();
</script>

{#if toast}
  <div
    class="scan-toast-container animate-fade-in"
    class:success={toast.type === 'success'}
    class:error={toast.type === 'error'}
    class:warning={toast.type === 'warning'}
    role="status"
    aria-live="polite"
  >
    <div class="toast-icon">
      {#if toast.type === 'success'}
        ✅
      {:else if toast.type === 'error'}
        ❌
      {:else}
        ⚠️
      {/if}
    </div>
    <div class="toast-content">
      <span class="toast-title">{toast.message}</span>
      {#if toast.subtext}
        <span class="toast-subtitle">{toast.subtext}</span>
      {/if}
    </div>
  </div>
{/if}

<style>
  .scan-toast-container {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2000;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 20px;
    border-radius: var(--radius-md, 10px);
    backdrop-filter: blur(12px);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.45);
    border: 1px solid var(--border-glass, rgba(255, 255, 255, 0.1));
    pointer-events: none;
    max-width: 90vw;
    animation: slideUpToast 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes slideUpToast {
    from {
      opacity: 0;
      transform: translate(-50%, 15px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0) scale(1);
    }
  }

  .scan-toast-container.success {
    background: rgba(16, 185, 129, 0.18);
    border-color: rgba(16, 185, 129, 0.4);
    color: #a7f3d0;
  }

  .scan-toast-container.error {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.45);
    color: #fecaca;
  }

  .scan-toast-container.warning {
    background: rgba(245, 158, 11, 0.18);
    border-color: rgba(245, 158, 11, 0.4);
    color: #fef08a;
  }

  .toast-icon {
    font-size: 1.4rem;
    line-height: 1;
  }

  .toast-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .toast-title {
    font-size: 0.95rem;
    font-weight: 600;
    line-height: 1.2;
  }

  .toast-subtitle {
    font-size: 0.8rem;
    opacity: 0.85;
  }
</style>
