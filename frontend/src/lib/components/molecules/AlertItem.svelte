<script lang="ts">
  interface Props {
    item: { name: string; sku: string; department: string; stock: number };
  }
  let { item }: Props = $props();
</script>

<div class="alert-item animate-fade-in">
  <div class="alert-info">
    <strong>{item.name}</strong>
    <span class="sku-dept">SKU: {item.sku} | Depto: {item.department}</span>
  </div>
  <span class="alert-stock" class:badge-zero={item.stock === 0} class:badge-low={item.stock > 0}>
    Stock: {item.stock}
  </span>
</div>

<style>
  .alert-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    padding: 8px 12px;
    box-sizing: border-box;
    width: 100%;
  }

  .alert-info {
    display: flex;
    flex-direction: column;
    text-align: left;
  }

  .alert-info strong {
    font-size: 0.85rem;
    color: var(--text-primary);
  }

  .sku-dept {
    font-size: 0.72rem;
    color: var(--text-muted);
  }

  .alert-stock {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 4px;
  }

  .badge-zero {
    background: rgba(244, 63, 94, 0.12);
    color: var(--color-danger);
    border: 1px solid rgba(244, 63, 94, 0.2);
  }

  .badge-low {
    background: rgba(245, 158, 11, 0.12);
    color: var(--color-cafe);
    border: 1px solid rgba(245, 158, 11, 0.2);
  }
</style>
