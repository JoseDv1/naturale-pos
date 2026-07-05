<script lang="ts">
  import Badge from '../atoms/Badge.svelte';

  interface Props {
    product: any;
    onclick: () => void;
  }

  let { product: p, onclick }: Props = $props();
</script>

<button class="product-card glass-panel animate-scale-up" {onclick}>
  <div class="product-header">
    <Badge text={p.department === 'MARKET' ? 'Mercado' : 'Café'} type={p.department === 'MARKET' ? 'market' : 'cafe'} />
    {#if p.isRawMaterial}
      <Badge text="Insumo" type="raw" />
    {/if}
  </div>
  <h3 class="product-name">{p.name}</h3>
  <p class="product-sku">{p.sku}</p>
  
  <div class="product-footer">
    <span class="product-price">${p.price.toLocaleString()}</span>
    <span class="product-stock" class:out={p.stock <= 0 && !(p.department === 'CAFE' && p.stock >= 900)}>
      {#if p.department === 'CAFE' && p.stock >= 900}
        Ilimitado
      {:else}
        Stock: {p.stock}
      {/if}
    </span>
  </div>
</button>

<style>
  .product-card {
    text-align: left;
    padding: 16px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    cursor: pointer;
    background: var(--bg-glass);
    border: 1px solid var(--border-glass);
    outline: none;
    box-sizing: border-box;
    width: 100%;
  }
  
  .product-card:hover {
    border-color: var(--color-general);
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  }

  .product-header {
    display: flex;
    gap: 6px;
    margin-bottom: 10px;
  }

  .product-name {
    font-size: 1rem;
    font-weight: 500;
    margin-bottom: 4px;
    color: var(--text-primary);
    line-height: 1.25;
  }

  .product-sku {
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin-bottom: 14px;
  }

  .product-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid var(--border-glass);
    padding-top: 10px;
  }

  .product-price {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .product-stock {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .product-stock.out {
    color: var(--color-danger);
    font-weight: 600;
  }
</style>
