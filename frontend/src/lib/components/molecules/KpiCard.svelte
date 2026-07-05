<script lang="ts">
  interface Props {
    icon?: string;
    title: string;
    value: string;
    desc?: string;
    textClass?: string;
    borderClass?: string;
    isNegative?: boolean;
    animate?: boolean;
  }

  let {
    icon,
    title,
    value,
    desc,
    textClass = '',
    borderClass = '',
    isNegative = false,
    animate = true
  }: Props = $props();
</script>

<div class="kpi-card glass-panel {borderClass} {animate ? 'animate-scale-up' : ''}" class:negative={isNegative}>
  {#if icon}
    <div class="kpi-icon">{icon}</div>
  {/if}
  <div class="kpi-content">
    <span class="kpi-title">{title}</span>
    <strong class="kpi-value {textClass}">{value}</strong>
    {#if desc}
      <span class="kpi-desc">{desc}</span>
    {/if}
  </div>
</div>

<style>
  .kpi-card {
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    box-sizing: border-box;
    width: 100%;
  }

  .kpi-icon {
    font-size: 2.2rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    padding: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border-glass);
  }

  .kpi-content {
    display: flex;
    flex-direction: column;
  }

  .kpi-title {
    font-size: 0.8rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
  }

  .kpi-value {
    font-size: 1.45rem;
    font-weight: 700;
  }

  .kpi-desc {
    font-size: 0.72rem;
    color: var(--text-muted);
    margin-top: 2px;
  }

  /* Reports variants (borders) */
  .border-general { border-left: 4px solid var(--color-general); }
  .border-cafe { border-left: 4px solid var(--color-cafe); }
  .border-market { border-left: 4px solid var(--color-market); }
  .border-danger { border-left: 4px solid var(--color-danger); }
  .border-net { 
    border-left: 4px solid #3b82f6; 
  }
  .border-net .kpi-value {
    color: #60a5fa;
  }
  .border-net.negative {
    border-left-color: var(--color-danger);
  }
  .border-net.negative .kpi-value {
    color: var(--color-danger);
  }
</style>
