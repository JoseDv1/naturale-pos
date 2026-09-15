<script lang="ts">
  import Badge from '../atoms/Badge.svelte';

  interface Props {
    product: any;
    onclick: () => void;
  }

  let { product: p, onclick }: Props = $props();

  let hasVariants = $derived(Boolean(p.variants && p.variants.length > 0));
  let minVariantPrice = $derived(hasVariants ? Math.min(...p.variants.map((v: any) => Number(v.price))) : Number(p.price));
  let maxVariantPrice = $derived(hasVariants ? Math.max(...p.variants.map((v: any) => Number(v.price))) : Number(p.price));
  let totalStock = $derived(hasVariants ? p.variants.reduce((acc: number, v: any) => acc + Number(v.stock || 0), 0) : Number(p.stock));
</script>

{#snippet badges()}
  <Badge text={p.department === 'MARKET' ? 'Mercado' : 'Café'} type={p.department === 'MARKET' ? 'market' : 'cafe'} />
  {#if p.isRawMaterial}
    <Badge text="Insumo" type="raw" />
  {/if}
  {#if hasVariants}
    <span class="variant-count-pill" title={`${p.variants.length} opciones disponibles`}>
      {p.variants.length} var.
    </span>
  {/if}
{/snippet}

<button class="product-card glass-panel animate-scale-up" {onclick}>
  {#if p.imageUrl}
    <div class="product-image-box">
      <img src={p.imageUrl} alt={p.name} class="product-img" loading="lazy" />
      <div class="image-badges-overlay">
        {@render badges()}
      </div>
    </div>
  {:else}
    <div class="product-header">
      {@render badges()}
    </div>
  {/if}

  <div class="product-body">
    <h3 class="product-name">{p.name}</h3>
    <p class="product-sku">{p.sku}</p>
  </div>
  
  <div class="product-footer">
    <div class="price-box">
      {#if hasVariants && minVariantPrice !== maxVariantPrice}
        <span class="product-price-from">Desde</span>
        <span class="product-price">${minVariantPrice.toLocaleString()}</span>
      {:else}
        <span class="product-price">${(hasVariants ? minVariantPrice : Number(p.price)).toLocaleString()}</span>
      {/if}
    </div>
    <span class="product-stock" class:out={totalStock <= 0 && !(p.department === 'CAFE' && totalStock >= 900)}>
      {#if p.department === 'CAFE' && (p.stock >= 900 || totalStock >= 900)}
        Ilimitado
      {:else}
        Stock: {totalStock}
      {/if}
    </span>
  </div>
</button>

<style>
  .product-card {
    text-align: left;
    padding: 14px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    cursor: pointer;
    background: var(--bg-glass);
    border: 1px solid var(--border-glass);
    outline: none;
    box-sizing: border-box;
    width: 100%;
    border-radius: var(--radius-md, 12px);
    transition: transform var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast);
  }
  
  .product-card:hover {
    border-color: var(--color-general);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  }

  .product-image-box {
    position: relative;
    width: 100%;
    height: 110px;
    border-radius: var(--radius-sm, 8px);
    overflow: hidden;
    margin-bottom: 10px;
    background: rgba(0, 0, 0, 0.18);
  }

  .product-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform var(--transition-normal, 0.25s ease);
  }

  .product-card:hover .product-img {
    transform: scale(1.05);
  }

  .image-badges-overlay {
    position: absolute;
    top: 6px;
    left: 6px;
    display: flex;
    gap: 4px;
    z-index: 2;
  }

  .product-header {
    display: flex;
    gap: 6px;
    margin-bottom: 10px;
  }

  .product-body {
    flex: 1;
  }

  .product-name {
    font-size: 0.95rem;
    font-weight: 500;
    margin-bottom: 4px;
    color: var(--text-primary);
    line-height: 1.25;
  }

  .product-sku {
    font-size: 0.72rem;
    color: var(--text-secondary);
    margin-bottom: 10px;
  }

  .product-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid var(--border-glass);
    padding-top: 10px;
  }

  .variant-count-pill {
    font-size: 0.68rem;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(4, 120, 87, 0.15);
    color: var(--color-general);
    border: 1px solid rgba(4, 120, 87, 0.3);
    backdrop-filter: blur(4px);
  }

  .price-box {
    display: flex;
    flex-direction: column;
    line-height: 1.1;
  }

  .product-price-from {
    font-size: 0.68rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.5px;
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
