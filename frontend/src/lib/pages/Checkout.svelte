<script lang="ts">
  import { onMount } from 'svelte';
  import { user, cart, cartTotal, products, categories, refreshTrigger, triggerRefresh, selectedTable, activeTab } from '../store';

  // State variables
  let searchQuery = $state('');
  let selectedCategory = $state('');
  let activeDept = $state('MARKET'); // 'MARKET' | 'CAFE'
  let wasTableSale = $state(false);
  
  // Checkout Modal State
  let showPaymentModal = $state(false);
  let payments = $state<Array<{ method: string; amount: number }>>([]);
  let currentMethod = $state('CASH');
  let currentAmountInput = $state('');
  let cashChange = $state(0);
  let errorMessage = $state('');
  let successReceipt = $state<any>(null);

  // Barcode input handler
  let barcodeSearchInput = $state<HTMLInputElement>();

  onMount(() => {
    loadData();
  });

  // Re-load data when triggered
  $effect(() => {
    if ($refreshTrigger) {
      loadData();
    }
  });

  async function loadData() {
    try {
      const prodRes = await fetch('/api/products');
      const catRes = await fetch('/api/categories');
      if (prodRes.ok && catRes.ok) {
        products.set(await prodRes.json());
        categories.set(await catRes.json());
      }
    } catch (e) {
      console.error('Error loading inventory data:', e);
    }
  }

  // Filter products based on search, department, and category
  let filteredProducts = $derived($products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.sku.includes(searchQuery);
    const matchesDept = p.department === activeDept;
    const matchesCategory = selectedCategory ? p.categoryId === selectedCategory : true;
    return matchesSearch && matchesDept && matchesCategory;
  }));

  // Cart operations
  function addToCart(product: any) {
    if (product.stock <= 0 && !(product.department === 'CAFE' && product.stock >= 900)) {
      alert('¡Producto sin stock!');
      return;
    }

    cart.update((currentCart) => {
      const existing = currentCart.find((item) => item.product.id === product.id);
      if (existing) {
        const isCafeInfinite = product.department === 'CAFE' && product.stock >= 900;
        if (!isCafeInfinite && existing.quantity >= product.stock) {
          alert('No puedes vender más de lo disponible en stock.');
          return currentCart;
        }
        return currentCart.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...currentCart, { product, quantity: 1 }];
    });

    // Reset SKU search if used
    searchQuery = '';
    if (barcodeSearchInput) barcodeSearchInput.focus();
  }

  function updateQuantity(productId: string, delta: number) {
    cart.update((currentCart) => {
      return currentCart.map((item) => {
        if (item.product.id === productId) {
          const newQty = item.quantity + delta;
          const isCafeInfinite = item.product.department === 'CAFE' && item.product.stock >= 900;
          if (newQty <= 0) return null;
          if (!isCafeInfinite && newQty > item.product.stock) {
            alert('No puedes superar el stock disponible.');
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(Boolean) as any[];
    });
  }

  function removeFromCart(productId: string) {
    cart.update((currentCart) => currentCart.filter((item) => item.product.id !== productId));
  }

  function clearCart() {
    cart.set([]);
  }

  // Checkout operations
  function openCheckout() {
    if ($cart.length === 0) return;
    errorMessage = '';
    successReceipt = null;
    payments = [];
    wasTableSale = $selectedTable !== null;
    currentAmountInput = remainingToPay.toString();
    cashChange = 0;
    showPaymentModal = true;
  }

  let totalPaid = $derived(payments.reduce((sum, p) => sum + p.amount, 0));
  let remainingToPay = $derived(Math.max(0, $cartTotal - totalPaid));

  function addPayment() {
    errorMessage = '';
    const amt = parseFloat(currentAmountInput);
    if (isNaN(amt) || amt <= 0) {
      errorMessage = 'Monto inválido';
      return;
    }

    if (currentMethod === 'CASH' && amt > remainingToPay) {
      // Cash payment exceeds remaining -> calculate change
      cashChange = amt - remainingToPay;
      payments = [...payments, { method: 'CASH', amount: remainingToPay }];
    } else if (amt > remainingToPay) {
      errorMessage = 'El monto de tarjeta/transferencia no puede exceder el restante';
      return;
    } else {
      payments = [...payments, { method: currentMethod, amount: amt }];
      cashChange = 0;
    }

    currentAmountInput = remainingToPay.toString();
  }

  function removePayment(index: number) {
    payments = payments.filter((_, i) => i !== index);
    cashChange = 0;
    currentAmountInput = remainingToPay.toString();
  }

  async function processSale() {
    if (remainingToPay > 0.01) {
      errorMessage = 'Falta completar el pago total';
      return;
    }

    errorMessage = '';
    try {
      const url = $selectedTable 
        ? `/api/tables/${$selectedTable.id}/checkout`
        : '/api/sales';
        
      const bodyPayload = $selectedTable
        ? { payments }
        : {
            userId: $user?.id,
            total: $cartTotal,
            items: $cart.map((item) => ({
              productId: item.product.id,
              quantity: item.quantity,
              price: item.product.price,
            })),
            payments: payments,
          };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (res.ok) {
        successReceipt = {
          id: data.sale.id,
          total: data.sale.total,
          createdAt: data.sale.createdAt,
          items: [...$cart],
          payments: [...payments],
          change: cashChange,
        };
        clearCart();
        
        // Reset selected table
        if ($selectedTable) {
          selectedTable.set(null);
        }
        
        triggerRefresh();
      } else {
        errorMessage = data.error || 'Error al procesar la venta';
      }
    } catch (e) {
      errorMessage = 'Error en el servidor al registrar la venta';
    }
  }

  async function saveTableOrder() {
    if (!$selectedTable) return;
    try {
      const res = await fetch(`/api/tables/${$selectedTable.id}/save`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: $cart.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
            price: item.product.price,
          })),
        }),
      });

      if (res.ok) {
        selectedTable.set(null);
        cart.set([]);
        triggerRefresh();
        activeTab.set('tables');
      } else {
        const err = await res.json();
        alert(err.error || 'Error al guardar la orden de la mesa');
      }
    } catch (e) {
      alert('Error de conexión al guardar la orden');
    }
  }

  async function exitTableMode() {
    if ($selectedTable && $cart.length === 0) {
      try {
        await fetch(`/api/tables/${$selectedTable.id}/cancel`, { method: 'POST' });
      } catch (e) {
        console.error('Error freeing empty table on exit:', e);
      }
    }
    selectedTable.set(null);
    cart.set([]);
    triggerRefresh();
    activeTab.set('tables');
  }

  function closePaymentModal() {
    showPaymentModal = false;
    const redirect = wasTableSale && successReceipt;
    successReceipt = null;
    if (redirect) {
      activeTab.set('tables');
    }
  }
</script>

<div class="checkout-layout">
  <!-- Left Side: Product Grid -->
  <div class="catalog-section">
    <!-- Header with Search & Tabs -->
    <div class="catalog-header glass-panel">
      <div class="search-bar-container">
        <span class="search-icon">🔍</span>
        <input
          type="text"
          placeholder="Buscar producto por nombre o escanear código SKU..."
          bind:value={searchQuery}
          bind:this={barcodeSearchInput}
          class="search-input"
        />
      </div>

      <div class="tabs-and-filters">
        <div class="dept-tabs">
          <button
            class="tab-btn"
            class:active={activeDept === 'MARKET'}
            onclick={() => { activeDept = 'MARKET'; selectedCategory = ''; }}
          >
            🍏 Mercado Saludable
          </button>
          <button
            class="tab-btn"
            class:active={activeDept === 'CAFE'}
            onclick={() => { activeDept = 'CAFE'; selectedCategory = ''; }}
          >
            ☕ Café
          </button>
        </div>

        <select bind:value={selectedCategory} class="category-select">
          <option value="">Todas las Categorías</option>
          {#each $categories as cat}
            <option value={cat.id}>{cat.name}</option>
          {/each}
        </select>
      </div>
    </div>

    <!-- Products Grid -->
    <div class="products-grid scroll-y">
      {#each filteredProducts as p}
        <button class="product-card glass-panel animate-scale-up" onclick={() => addToCart(p)}>
          <div class="product-header">
            <span class="badge" class:badge-market={p.department === 'MARKET'} class:badge-cafe={p.department === 'CAFE'}>
              {p.department === 'MARKET' ? 'Mercado' : 'Café'}
            </span>
            {#if p.isRawMaterial}
              <span class="badge badge-raw">Insumo</span>
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
      {:else}
        <div class="no-results flex-center glass-panel animate-fade-in">
          <p>No se encontraron productos en esta sección.</p>
        </div>
      {/each}
    </div>
  </div>

  <!-- Right Side: Shopping Cart -->
  <div class="cart-section glass-panel">
    {#if $selectedTable}
      <div class="table-mode-banner">
        <span>📌 Cuenta: <strong>{$selectedTable.name}</strong></span>
        <button class="btn-exit-table" onclick={exitTableMode} title="Salir de la mesa sin guardar cambios locales">
          Volver ↩
        </button>
      </div>
    {/if}

    <div class="cart-header">
      <h2>Carrito de Compra</h2>
      <button class="btn btn-secondary" onclick={clearCart} disabled={$cart.length === 0}>
        Vaciar
      </button>
    </div>

    <div class="cart-items scroll-y">
      {#each $cart as item}
        <div class="cart-item animate-fade-in">
          <div class="item-details">
            <span class="item-name">{item.product.name}</span>
            <span class="item-price">${item.product.price.toLocaleString()} c/u</span>
          </div>

          <div class="item-actions">
            <div class="qty-controls">
              <button class="qty-btn" onclick={() => updateQuantity(item.product.id, -1)}>-</button>
              <span class="qty-val">{item.quantity}</span>
              <button class="qty-btn" onclick={() => updateQuantity(item.product.id, 1)}>+</button>
            </div>
            
            <span class="item-subtotal">${(item.product.price * item.quantity).toLocaleString()}</span>
            
            <button class="remove-btn" onclick={() => removeFromCart(item.product.id)}>
              ❌
            </button>
          </div>
        </div>
      {:else}
        <div class="empty-cart flex-center">
          🛒 Carrito Vacío
        </div>
      {/each}
    </div>

    <div class="cart-footer">
      <div class="total-row">
        <span>Total a Pagar</span>
        <span class="total-amount">${$cartTotal.toLocaleString()}</span>
      </div>
      {#if $selectedTable}
        <div class="table-action-buttons">
          <button class="btn btn-general checkout-btn flex-1" onclick={openCheckout} disabled={$cart.length === 0}>
            Cobrar Mesa 💳
          </button>
          <button class="btn btn-market save-table-btn" onclick={saveTableOrder} title="Guardar cambios de la mesa">
            Guardar Mesa 💾
          </button>
        </div>
      {:else}
        <button class="btn btn-general checkout-btn" onclick={openCheckout} disabled={$cart.length === 0}>
          Cobrar y Registrar 💳
        </button>
      {/if}
    </div>
  </div>
</div>

<!-- ==========================================
     CHECKOUT / PAYMENT DIALOG MODAL
     ========================================== -->
{#if showPaymentModal}
  <div class="modal-overlay flex-center animate-fade-in">
    <div class="modal-container glass-panel animate-scale-up">
      {#if !successReceipt}
        <div class="modal-header">
          <h2>Registrar Pago Dividido</h2>
          <button class="close-modal-btn" onclick={closePaymentModal}>✕</button>
        </div>

        {#if errorMessage}
          <div class="error-banner">{errorMessage}</div>
        {/if}

        <div class="payment-math-container">
          <div class="math-card">
            <span>Total Venta</span>
            <strong class="text-general">${$cartTotal.toLocaleString()}</strong>
          </div>
          <div class="math-card">
            <span>Registrado</span>
            <strong class="text-market">${totalPaid.toLocaleString()}</strong>
          </div>
          <div class="math-card">
            <span>Restante</span>
            <strong class:text-danger={remainingToPay > 0} class:text-market={remainingToPay === 0}>
              ${remainingToPay.toLocaleString()}
            </strong>
          </div>
        </div>

        <!-- Add Payment Section -->
        {#if remainingToPay > 0}
          <div class="add-payment-section">
            <h3>Agregar Método de Pago</h3>
            <div class="payment-inputs">
              <div class="method-selector">
                <button
                  type="button"
                  class="method-btn"
                  class:active={currentMethod === 'CASH'}
                  onclick={() => { currentMethod = 'CASH'; currentAmountInput = remainingToPay.toString(); }}
                >
                  💵 Efectivo
                </button>
                <button
                  type="button"
                  class="method-btn"
                  class:active={currentMethod === 'CARD'}
                  onclick={() => { currentMethod = 'CARD'; currentAmountInput = remainingToPay.toString(); }}
                >
                  💳 Tarjeta
                </button>
                <button
                  type="button"
                  class="method-btn"
                  class:active={currentMethod === 'TRANSFER'}
                  onclick={() => { currentMethod = 'TRANSFER'; currentAmountInput = remainingToPay.toString(); }}
                >
                  📲 Transferencia
                </button>
              </div>

              <div class="amount-input-row">
                <input
                  type="number"
                  placeholder="Monto"
                  bind:value={currentAmountInput}
                  min="0.01"
                  step="any"
                />
                <button class="btn btn-general" onclick={addPayment}>
                  Añadir
                </button>
              </div>
            </div>
          </div>
        {/if}

        <!-- List of Registered Payments -->
        <div class="payments-list-section">
          <h3>Pagos Registrados</h3>
          <div class="payments-list">
            {#each payments as pay, i}
              <div class="payment-tag animate-fade-in">
                <span>
                  {#if pay.method === 'CASH'}💵 Efectivo
                  {:else if pay.method === 'CARD'}💳 Tarjeta
                  {:else if pay.method === 'TRANSFER'}📲 Transferencia
                  {/if}
                  : <strong>${pay.amount.toLocaleString()}</strong>
                </span>
                <button class="remove-payment-btn" onclick={() => removePayment(i)}>✕</button>
              </div>
            {:else}
              <p class="no-payments">No se han agregado pagos aún.</p>
            {/each}
          </div>
        </div>

        <!-- Change and Actions -->
        <div class="modal-footer">
          {#if cashChange > 0}
            <div class="change-banner animate-fade-in">
              <span>Cambio a devolver en Efectivo:</span>
              <strong>${cashChange.toLocaleString()}</strong>
            </div>
          {/if}

          <div class="footer-buttons">
            <button class="btn btn-secondary" onclick={closePaymentModal}>
              Cancelar
            </button>
            <button
              class="btn btn-market"
              onclick={processSale}
              disabled={remainingToPay > 0.01}
            >
              Completar Venta ✔
            </button>
          </div>
        </div>
      {:else}
        <!-- SUCCESS RECEIPT VIEW -->
        <div class="receipt-container animate-scale-up">
          <div class="receipt-header">
            <span class="success-icon">🎉</span>
            <h2>¡Venta Registrada!</h2>
            <p>Ticket: {successReceipt.id.slice(0,8).toUpperCase()}</p>
            <span class="date">{new Date(successReceipt.createdAt).toLocaleString()}</span>
          </div>

          <div class="receipt-divider"></div>

          <div class="receipt-items">
            {#each successReceipt.items as item}
              <div class="receipt-item">
                <span>{item.product.name} x{item.quantity}</span>
                <span>${(item.product.price * item.quantity).toLocaleString()}</span>
              </div>
            {/each}
          </div>

          <div class="receipt-divider"></div>

          <div class="receipt-total">
            <span>Total Venta</span>
            <span>${successReceipt.total.toLocaleString()}</span>
          </div>

          <div class="receipt-payments">
            <h4>Detalle de Pago:</h4>
            {#each successReceipt.payments as pay}
              <div class="receipt-payment-row">
                <span>
                  {#if pay.method === 'CASH'}💵 Efectivo
                  {:else if pay.method === 'CARD'}💳 Tarjeta
                  {:else if pay.method === 'TRANSFER'}📲 Transferencia
                  {/if}
                </span>
                <span>${pay.amount.toLocaleString()}</span>
              </div>
            {/each}
            {#if successReceipt.change > 0}
              <div class="receipt-payment-row change-row">
                <span>Cambio Entregado:</span>
                <span>${successReceipt.change.toLocaleString()}</span>
              </div>
            {/if}
          </div>

          <button class="btn btn-general print-btn" onclick={closePaymentModal}>
            Cerrar e Ir a Nueva Venta
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .checkout-layout {
    display: flex;
    height: 100%;
    width: 100%;
    gap: 16px;
    padding: 6px;
  }

  /* Catalog Area */
  .catalog-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    height: 100%;
    overflow: hidden;
  }

  .catalog-header {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .search-bar-container {
    position: relative;
    width: 100%;
  }

  .search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-secondary);
  }

  .search-input {
    width: 100%;
    padding-left: 38px;
  }

  .tabs-and-filters {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }

  .dept-tabs {
    display: flex;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    padding: 4px;
  }

  .tab-btn {
    border: none;
    background: transparent;
    color: var(--text-secondary);
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition-fast);
    outline: none;
  }

  .tab-btn.active {
    background: rgba(255, 255, 255, 0.07);
    color: var(--text-primary);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .category-select {
    width: 200px;
  }

  .products-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    grid-auto-rows: max-content;
    align-content: start;
    gap: 14px;
    padding-bottom: 20px;
  }

  .scroll-y {
    overflow-y: auto;
  }

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

  .badge {
    font-size: 0.72rem;
    padding: 3px 8px;
    border-radius: 4px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .badge-market {
    background: var(--color-market-glow);
    color: var(--color-market);
  }

  .badge-cafe {
    background: var(--color-cafe-glow);
    color: var(--color-cafe);
  }

  .badge-raw {
    background: rgba(99, 102, 241, 0.15);
    color: #a5b4fc;
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

  .no-results {
    grid-column: 1 / -1;
    height: 150px;
    color: var(--text-secondary);
  }

  /* Cart Section */
  .cart-section {
    width: 380px;
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .cart-header {
    padding: 18px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border-glass);
  }

  .cart-header h2 {
    font-size: 1.15rem;
    font-weight: 600;
  }

  .cart-items {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .cart-item {
    padding: 14px 18px;
    border-bottom: 1px solid var(--border-glass);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .item-details {
    display: flex;
    justify-content: space-between;
  }

  .item-name {
    font-weight: 500;
    font-size: 0.92rem;
  }

  .item-price {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .item-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .qty-controls {
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .qty-btn {
    border: none;
    background: transparent;
    color: var(--text-primary);
    width: 28px;
    height: 28px;
    cursor: pointer;
    font-weight: 600;
    outline: none;
  }
  .qty-btn:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .qty-val {
    width: 30px;
    text-align: center;
    font-size: 0.88rem;
    font-weight: 500;
  }

  .item-subtotal {
    font-weight: 600;
    font-size: 0.95rem;
  }

  .remove-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 0.9rem;
    padding: 4px;
    border-radius: 4px;
  }
  .remove-btn:hover {
    background: rgba(244, 63, 94, 0.1);
  }

  .empty-cart {
    height: 100%;
    color: var(--text-secondary);
    font-size: 1.1rem;
    opacity: 0.5;
  }

  .cart-footer {
    padding: 18px;
    border-top: 1px solid var(--border-glass);
    background: rgba(255, 255, 255, 0.01);
  }

  .total-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .total-row span {
    font-size: 1rem;
    color: var(--text-secondary);
  }

  .total-amount {
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .checkout-btn {
    width: 100%;
    height: 48px;
    font-size: 1rem;
  }

  /* Payment Modal styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(3, 7, 18, 0.85);
    z-index: 1000;
  }

  .modal-container {
    width: 100%;
    max-width: 520px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .modal-header h2 {
    font-size: 1.25rem;
    font-weight: 600;
  }

  .close-modal-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 1.2rem;
    cursor: pointer;
    outline: none;
  }

  .payment-math-container {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .math-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    padding: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
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

  .add-payment-section {
    border-top: 1px solid var(--border-glass);
    padding-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .add-payment-section h3, .payments-list-section h3 {
    font-size: 0.85rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .method-selector {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 10px;
  }

  .method-btn {
    border: 1px solid var(--border-glass);
    background: rgba(255, 255, 255, 0.02);
    color: var(--text-secondary);
    padding: 10px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 0.88rem;
    font-weight: 500;
    transition: var(--transition-fast);
    outline: none;
  }

  .method-btn:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .method-btn.active {
    background: var(--color-general-glow);
    color: #a5b4fc;
    border-color: var(--color-general);
  }

  .amount-input-row {
    display: flex;
    gap: 10px;
  }

  .amount-input-row input {
    flex: 1;
  }

  .payments-list-section {
    border-top: 1px solid var(--border-glass);
    padding-top: 16px;
  }

  .payments-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
    min-height: 40px;
    align-items: center;
  }

  .payment-tag {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    padding: 6px 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.88rem;
  }

  .remove-payment-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    font-weight: 600;
    outline: none;
  }
  .remove-payment-btn:hover {
    color: var(--color-danger);
  }

  .no-payments {
    font-size: 0.85rem;
    color: var(--text-muted);
    font-style: italic;
  }

  .change-banner {
    background: var(--color-cafe-glow);
    border: 1px solid rgba(245, 158, 11, 0.2);
    color: #fde047;
    padding: 12px;
    border-radius: var(--radius-sm);
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .footer-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  /* Receipt styles */
  .receipt-container {
    text-align: center;
    padding: 10px 0;
  }

  .success-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: 10px;
    filter: drop-shadow(0 0 10px rgba(16, 185, 129, 0.3));
  }

  .receipt-container h2 {
    font-size: 1.4rem;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .receipt-container p {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .receipt-container .date {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .receipt-divider {
    border-top: 1px dashed var(--border-glass);
    margin: 18px 0;
  }

  .receipt-items {
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 180px;
    overflow-y: auto;
    padding-right: 4px;
  }

  .receipt-item {
    display: flex;
    justify-content: space-between;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .receipt-total {
    display: flex;
    justify-content: space-between;
    font-weight: 700;
    font-size: 1.1rem;
    color: var(--text-primary);
  }

  .receipt-payments {
    text-align: left;
    margin-top: 18px;
  }

  .receipt-payments h4 {
    font-size: 0.8rem;
    color: var(--text-secondary);
    margin-bottom: 6px;
  }

  .receipt-payment-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .change-row {
    color: var(--color-cafe);
    font-weight: 600;
    margin-top: 4px;
    border-top: 1px solid var(--border-glass);
    padding-top: 4px;
  }

  .print-btn {
    margin-top: 24px;
    width: 100%;
    height: 44px;
  }

  .table-mode-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--color-cafe-glow);
    border-bottom: 1px solid rgba(245, 158, 11, 0.2);
    padding: 10px 18px;
    font-size: 0.9rem;
    color: #fde047;
    border-top-left-radius: var(--radius-md);
    border-top-right-radius: var(--radius-md);
  }

  .btn-exit-table {
    background: transparent;
    border: 1px solid rgba(245, 158, 11, 0.3);
    color: #fde047;
    padding: 4px 8px;
    font-size: 0.75rem;
    border-radius: 4px;
    cursor: pointer;
    transition: var(--transition-fast);
    outline: none;
  }
  .btn-exit-table:hover {
    background: rgba(245, 158, 11, 0.1);
  }

  .table-action-buttons {
    display: flex;
    gap: 10px;
    width: 100%;
  }

  .save-table-btn {
    flex: 1;
    height: 48px;
    font-size: 1rem;
  }
</style>
