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
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
    background: #112217;
    color: #ffffff;
    border: 1px solid rgba(255, 255, 255, 0.15);
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
    border-left: 4px solid #10b981;
  }

  .scan-toast-container.error {
    border-left: 4px solid #ef4444;
  }

  .scan-toast-container.warning {
    border-left: 4px solid #f59e0b;
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
    color: #ffffff;
  }

  .toast-subtitle {
    font-size: 0.8rem;
    color: #e5ede7;
    opacity: 0.95;
  }
</style>
