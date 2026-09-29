<script lang="ts">
  interface Props {
    label: string;
    amount: number;
  }
  let { label, amount }: Props = $props();
</script>

<div class="pay-method-bar">
  <span>{label}</span>
  <strong>${amount.toLocaleString('es-CO')}</strong>
</div>

<style>
  .pay-method-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border-glass);
    padding: 8px 14px;
    border-radius: var(--radius-sm);
    box-sizing: border-box;
    width: 100%;
    transition: background var(--transition-fast), border-color var(--transition-fast);
  }

  .pay-method-bar:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(16, 185, 129, 0.3);
  }

  .pay-method-bar span {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .pay-method-bar strong {
    font-size: 0.95rem;
    color: var(--text-primary);
  }
</style>
