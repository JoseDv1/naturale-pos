<script lang="ts">
  interface Props {
    label: string;
    amount: number;
  }
  let { label, amount }: Props = $props();
</script>

<div class="pay-method-bar">
  <span>{label}</span>
  <strong>${amount.toLocaleString()}</strong>
</div>

<style>
  .pay-method-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(255, 255, 255, 0.01);
    border: 1px solid var(--border-glass);
    padding: 12px 16px;
    border-radius: var(--radius-sm);
    box-sizing: border-box;
    width: 100%;
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
