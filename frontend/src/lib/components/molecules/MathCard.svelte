<script lang="ts">
  interface Props {
    label: string;
    value: string;
    valueClass?: string;
  }

  let { label, value, valueClass = '' }: Props = $props();
</script>

<div class="math-card">
  <span>{label}</span>
  <strong class={valueClass}>{value}</strong>
</div>

<style>
  .math-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    padding: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    box-sizing: border-box;
    width: 100%;
  }

  .math-card span {
    font-size: 0.78rem;
    color: var(--text-secondary);
    text-transform: uppercase;
  }

  .math-card strong {
    font-size: 1.2rem;
    font-weight: 700;
  }
</style>
