<script lang="ts">
  import { onDestroy } from 'svelte';
  import { user, cart, cartTotal, products, categories, refreshTrigger, triggerRefresh, selectedTable, activeTab, currentShift, receiptSettings } from '../store';
  import { getProducts, getCategories } from '../api/products';
  import { 
    saveTableOrder as apiSaveTableOrder, 
    checkoutTable as apiCheckoutTable, 
    cancelTableOrder as apiCancelTableOrder,
    getTables,
    mergeTables as apiMergeTables,
    transferTableItems as apiTransferTableItems,
    partialCheckoutTable as apiPartialCheckoutTable
  } from '../api/tables';
  import { createSale } from '../api/sales';
  import { attachHardwareScannerListener } from '../services/scannerListener';
  import { playScanSuccess, playScanError, isSoundEnabled, setSoundEnabled } from '../services/sound';
  import ProductCard from '../components/organisms/ProductCard.svelte';
  import CartItem from '../components/organisms/CartItem.svelte';
  import MathCard from '../components/molecules/MathCard.svelte';
  import MethodBtn from '../components/molecules/MethodBtn.svelte';
  import Spinner from '../components/atoms/Spinner.svelte';
  import BarcodeScannerModal from '../components/molecules/BarcodeScannerModal.svelte';
  import ScanToast, { type ToastData } from '../components/atoms/ScanToast.svelte';
  import MergeTableModal from '../components/organisms/MergeTableModal.svelte';
  import SplitTableModal from '../components/organisms/SplitTableModal.svelte';
  import OpenShiftModal from '../components/organisms/OpenShiftModal.svelte';
  import ThermalReceipt80mm from '../components/molecules/ThermalReceipt80mm.svelte';
  import ReceiptSettingsModal from '../components/organisms/ReceiptSettingsModal.svelte';
  import PreReceiptModal from '../components/organisms/PreReceiptModal.svelte';
  import CustomizeRecipeModal from '../components/organisms/CustomizeRecipeModal.svelte';
  import { printThermalReceipt } from '../services/printer';

  // State variables
  let searchQuery = $state('');
  let showOpenShiftModal = $state(false);
  let showReceiptSettingsModal = $state(false);
  let showPreReceiptModal = $state(false);
  let preReceiptTableData = $state<any>(null);
  let selectedCategory = $state('');
  let activeDept = $state('CAFE'); // Default to CAFE
  let wasTableSale = $state(false);
  let isSavingTable = $state(false);
  let isExitingTable = false;

  // Recipe customization modal state
  let showCustomizeModal = $state(false);
  let productToCustomize = $state<any>(null);
  let variantToCustomize = $state<any>(null);
  let initialModifiersForModal = $state<any[]>([]);
  let initialNotesForModal = $state<string>('');
  let initialQuantityForModal = $state<number>(1);
  let editingCartIndex = $state<number | null>(null);

  // Table merge & split modal state
  let showCheckoutMergeModal = $state(false);
  let showCheckoutSplitModal = $state(false);
  let activeCheckoutTableObj = $state<any | null>(null);
  let allTablesList = $state<any[]>([]);

  
  // Checkout Modal State
  let showPaymentModal = $state(false);
  let payments = $state<Array<{ method: string; amount: number }>>([]);
  let currentMethod = $state('CASH');
  let currentAmountInput = $state('');
  let cashChange = $state(0);
  let errorMessage = $state('');
  let successReceipt = $state<any>(null);

  // Barcode & Camera Scanner State
  let barcodeSearchInput = $state<HTMLInputElement>();
  let showCameraScanner = $state(false);
  let currentToast = $state<ToastData | null>(null);
  let toastTimeout: any = null;
  let soundOn = $state(isSoundEnabled());

  // Variant Selection Modal State
  let showVariantModal = $state(false);
  let selectedProductForVariant = $state<any | null>(null);

  let initPromise = $state<Promise<any>>(
    Promise.all([getProducts(), getCategories()]).then(([prods, cats]) => {
      products.set(prods);
      categories.set(cats);
    })
  );

  // Re-load data when triggered
  $effect(() => {
    if ($refreshTrigger) {
      loadData();
    }
  });

  function loadData() {
    initPromise = Promise.all([getProducts(), getCategories()]).then(([prods, cats]) => {
      products.set(prods);
      categories.set(cats);
    });
  }

  function showToast(message: string, type: 'success' | 'error' | 'warning', subtext?: string) {
    if (toastTimeout) clearTimeout(toastTimeout);
    currentToast = { message, type, subtext };
    toastTimeout = setTimeout(() => {
      currentToast = null;
    }, 2800);
  }

  // Handle scanned barcode (from hardware scanner, camera, or search input Enter)
  function handleBarcodeScanned(code: string) {
    const cleanCode = code.trim().toLowerCase();
    if (!cleanCode) return;

    // 1. Search for matching variant SKU across all products
    for (const prod of $products) {
      if (prod.variants && prod.variants.length > 0) {
        const matchingVar = prod.variants.find(
          (v: any) => v.active !== false && v.sku && v.sku.toLowerCase() === cleanCode
        );
        if (matchingVar) {
          addToCart(prod, matchingVar);
          return;
        }
      }
    }

    // 2. Search exact product SKU
    const product = $products.find((p) => p.sku.toLowerCase() === cleanCode);

    if (!product) {
      playScanError();
      showToast('Código no encontrado', 'warning', `SKU: ${code.trim()}`);
      return;
    }

    // If product has variants, open variant selector modal
    if (product.variants && product.variants.length > 0) {
      selectedProductForVariant = product;
      showVariantModal = true;
      playScanSuccess();
      showToast('Selecciona variante', 'success', product.name);
      return;
    }

    addToCart(product, null);
  }

  function handleSearchKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      const query = searchQuery.trim();
      if (!query) return;

      e.preventDefault();

      // Check variant SKU first
      for (const prod of $products) {
        if (prod.variants && prod.variants.length > 0) {
          const matchingVar = prod.variants.find(
            (v: any) => v.active !== false && v.sku && v.sku.toLowerCase() === query.toLowerCase()
          );
          if (matchingVar) {
            addToCart(prod, matchingVar);
            searchQuery = '';
            return;
          }
        }
      }

      // Try exact product SKU
      const exact = $products.find((p) => p.sku.toLowerCase() === query.toLowerCase());
      if (exact) {
        if (exact.variants && exact.variants.length > 0) {
          selectedProductForVariant = exact;
          showVariantModal = true;
        } else {
          addToCart(exact, null);
        }
        searchQuery = '';
        return;
      }

      // If single search result match
      if (filteredProducts.length === 1) {
        const single = filteredProducts[0];
        if (single.variants && single.variants.length > 0) {
          selectedProductForVariant = single;
          showVariantModal = true;
        } else {
          addToCart(single, null);
        }
        searchQuery = '';
        return;
      }

      // Otherwise attempt scan lookup
      handleBarcodeScanned(query);
      searchQuery = '';
    }
  }

  // Register global hardware barcode scanner listener
  $effect(() => {
    const cleanup = attachHardwareScannerListener({
      onScan: (barcode) => {
        handleBarcodeScanned(barcode);
      },
    });

    return () => {
      cleanup();
    };
  });

  // Filter products based on search, department, and category
  let filteredProducts = $derived($products.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.variants && p.variants.some((v: any) =>
        (v.active !== false) && (
          v.name.toLowerCase().includes(q) ||
          (v.sku && v.sku.toLowerCase().includes(q))
        )
      ));
    const matchesDept = p.department === activeDept;
    const matchesCategory = selectedCategory ? p.categoryId === selectedCategory : true;
    return matchesSearch && matchesDept && matchesCategory;
  }));

  function openCustomizeModal(product: any, variant: any = null, cartIndex: number | null = null) {
    productToCustomize = product;
    variantToCustomize = variant;
    editingCartIndex = cartIndex;
    if (cartIndex !== null && $cart[cartIndex]) {
      const it = $cart[cartIndex];
      initialModifiersForModal = it.selectedModifiers || [];
      initialNotesForModal = it.notes || '';
      initialQuantityForModal = it.quantity || 1;
    } else {
      initialModifiersForModal = [];
      initialNotesForModal = '';
      initialQuantityForModal = 1;
    }
    showCustomizeModal = true;
  }

  function handleConfirmCustomization(result: {
    variant: any;
    selectedModifiers: any[];
    notes: string;
    unitPrice: number;
    quantity: number;
  }) {
    if (editingCartIndex !== null && $cart[editingCartIndex]) {
      $cart[editingCartIndex].variant = result.variant;
      $cart[editingCartIndex].selectedModifiers = result.selectedModifiers;
      $cart[editingCartIndex].notes = result.notes;
      $cart[editingCartIndex].unitPrice = result.unitPrice;
      $cart[editingCartIndex].quantity = result.quantity;
      cart.set([...$cart]);
    } else {
      cart.set([
        ...$cart,
        {
          product: productToCustomize,
          variant: result.variant,
          selectedModifiers: result.selectedModifiers,
          notes: result.notes,
          unitPrice: result.unitPrice,
          quantity: result.quantity,
        },
      ]);
    }
    showCustomizeModal = false;
    productToCustomize = null;
    variantToCustomize = null;
    editingCartIndex = null;
  }

  // Handle clicking a product card in catalog
  function handleProductCardClick(product: any) {
    if (product.modifiers && product.modifiers.length > 0) {
      openCustomizeModal(product);
    } else if (product.variants && product.variants.length > 0) {
      selectedProductForVariant = product;
      showVariantModal = true;
    } else {
      addToCart(product, null);
    }
  }

  // Cart operations
  function addToCart(product: any, variant: any = null) {
    const isCafeInfinite = product.department === 'CAFE' && (
      product.stock >= 900 || (variant && (variant.stock ?? 0) >= 900)
    );
    const availableStock = variant ? Number(variant.stock || 0) : Number(product.stock || 0);

    if (availableStock <= 0 && !isCafeInfinite) {
      playScanError();
      showToast('¡Producto sin stock!', 'error', variant ? `${product.name} (${variant.name})` : product.name);
      return;
    }

    const existing = $cart.find(
      (item) => item.product.id === product.id && (item.variant?.id || null) === (variant?.id || null)
    );

    if (existing) {
      if (!isCafeInfinite && existing.quantity >= availableStock) {
        playScanError();
        showToast('Stock máximo alcanzado', 'warning', `${product.name}${variant ? ` (${variant.name})` : ''} (Stock: ${availableStock})`);
        return;
      }
      existing.quantity += 1;
      cart.set([...$cart]);
    } else {
      cart.set([...$cart, { product, variant: variant || null, quantity: 1 }]);
    }

    const price = variant ? Number(variant.price) : Number(product.price);
    const sku = variant?.sku || product.sku;
    playScanSuccess();
    showToast(
      `+1 ${product.name}${variant ? ` (${variant.name})` : ''}`,
      'success',
      `$${price.toLocaleString()} • SKU: ${sku}`
    );
  }

  function updateQuantity(productId: string, variantId: string | null, delta: number, itemIndex?: number) {
    let item: any;
    if (itemIndex !== undefined && $cart[itemIndex]) {
      item = $cart[itemIndex];
    } else {
      item = $cart.find(
        (i) => i.product.id === productId && (i.variant?.id || null) === (variantId || null)
      );
    }
    if (!item) return;
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      removeFromCart(productId, variantId, itemIndex);
      return;
    }

    const isCafeInfinite = item.product.department === 'CAFE' && (
      item.product.stock >= 900 || (item.variant && (item.variant.stock ?? 0) >= 900)
    );
    const availableStock = item.variant ? Number(item.variant.stock || 0) : Number(item.product.stock || 0);

    if (!isCafeInfinite && newQty > availableStock) {
      showToast('Stock insuficiente', 'warning', `Máximo disponible: ${availableStock}`);
      return;
    }
    item.quantity = newQty;
    cart.set([...$cart]);
  }

  function setQuantity(productId: string, variantId: string | null, targetQty: number, itemIndex?: number) {
    let item: any;
    if (itemIndex !== undefined && $cart[itemIndex]) {
      item = $cart[itemIndex];
    } else {
      item = $cart.find(
        (i) => i.product.id === productId && (i.variant?.id || null) === (variantId || null)
      );
    }
    if (!item) return;

    if (isNaN(targetQty) || targetQty <= 0) {
      removeFromCart(productId, variantId, itemIndex);
      return;
    }

    const isCafeInfinite = item.product.department === 'CAFE' && (
      item.product.stock >= 900 || (item.variant && (item.variant.stock ?? 0) >= 900)
    );
    const availableStock = item.variant ? Number(item.variant.stock || 0) : Number(item.product.stock || 0);

    if (!isCafeInfinite && targetQty > availableStock) {
      showToast('Stock insuficiente', 'warning', `Máximo disponible: ${availableStock}`);
      item.quantity = Math.max(1, availableStock);
      cart.set([...$cart]);
      return;
    }

    item.quantity = Math.floor(targetQty);
    cart.set([...$cart]);
  }

  function setUnitPrice(productId: string, variantId: string | null, targetPrice: number | null, itemIndex?: number) {
    let item: any;
    if (itemIndex !== undefined && $cart[itemIndex]) {
      item = $cart[itemIndex];
    } else {
      item = $cart.find(
        (i) => i.product.id === productId && (i.variant?.id || null) === (variantId || null)
      );
    }
    if (!item) return;

    if (targetPrice === null || isNaN(targetPrice) || targetPrice < 0) {
      delete item.unitPrice;
    } else {
      item.unitPrice = Math.round(targetPrice);
    }
    cart.set([...$cart]);
  }

  function removeFromCart(productId: string, variantId: string | null, itemIndex?: number) {
    if (itemIndex !== undefined && $cart[itemIndex]) {
      $cart.splice(itemIndex, 1);
      cart.set([...$cart]);
      return;
    }
    cart.set(
      $cart.filter(
        (item) => !(item.product.id === productId && (item.variant?.id || null) === (variantId || null))
      )
    );
  }

  function clearCart() {
    cart.set([]);
  }

  // Calculate payment details
  let subtotal = $derived($cartTotal);
  let total = $derived(subtotal);
  let paidAmount = $derived(payments.reduce((sum, p) => sum + p.amount, 0));
  let remainingToPay = $derived(Math.max(0, total - paidAmount));

  function openCheckout() {
    if (!$currentShift?.shift || $currentShift.shift.status !== 'OPEN') {
      showOpenShiftModal = true;
      return;
    }
    if ($cart.length === 0) {
      alert('El carrito está vacío.');
      return;
    }
    payments = [];
    currentMethod = 'CASH';
    currentAmountInput = remainingToPay.toString();
    cashChange = 0;
    errorMessage = '';
    showPaymentModal = true;
    wasTableSale = !!$selectedTable;
  }

  const round2 = (num: number): number => Math.round((num + Number.EPSILON) * 100) / 100;

  function addPayment() {
    errorMessage = '';
    const amt = round2(parseFloat(currentAmountInput));
    if (isNaN(amt) || amt <= 0) {
      errorMessage = 'Monto inválido';
      return;
    }

    const rem = round2(remainingToPay);
    if (currentMethod === 'CASH' && amt > rem) {
      // Cash payment exceeds remaining -> calculate change
      cashChange = round2(amt - rem);
      payments = [...payments, { method: 'CASH', amount: rem }];
    } else if (amt > rem) {
      errorMessage = 'El monto de tarjeta/transferencia no puede exceder el restante';
      return;
    } else {
      payments = [...payments, { method: currentMethod, amount: amt }];
      cashChange = 0;
    }

    currentAmountInput = round2(remainingToPay).toString();
  }

  function removePayment(index: number) {
    payments = payments.filter((_, i) => i !== index);
    cashChange = 0;
    currentAmountInput = round2(remainingToPay).toString();
  }

  async function processSale() {
    if (!$currentShift?.shift || $currentShift.shift.status !== 'OPEN') {
      errorMessage = 'Debes tener un turno de caja abierto para procesar ventas.';
      showOpenShiftModal = true;
      return;
    }
    if (round2(remainingToPay) > 0.01) {
      errorMessage = 'Falta completar el pago total';
      return;
    }

    errorMessage = '';
    try {
      let data;
      if ($selectedTable) {
        // Sync table order items to table before checking out so database total matches exactly
        const itemsPayload = $cart.map((item) => ({
          productId: item.product.id,
          variantId: item.variant?.id || null,
          quantity: item.quantity,
          price: item.unitPrice !== undefined ? Number(item.unitPrice) : (item.variant ? Number(item.variant.price) : Number(item.product.price)),
          notes: item.notes || null,
        }));
        await apiSaveTableOrder($selectedTable.id, itemsPayload);
        data = await apiCheckoutTable($selectedTable.id, payments);
      } else {
        const bodyPayload = {
          userId: $user?.id,
          total: $cartTotal,
          items: $cart.map((item) => ({
            productId: item.product.id,
            variantId: item.variant?.id || null,
            quantity: item.quantity,
            price: item.unitPrice !== undefined ? Number(item.unitPrice) : (item.variant ? Number(item.variant.price) : Number(item.product.price)),
            notes: item.notes || null,
          })),
          payments: payments,
        };
        data = await createSale(bodyPayload);
      }

      const soldTable = $selectedTable ? { name: $selectedTable.name } : null;

      // Extract verified items from backend response or fallback to deep copy of cart
      const saleItems = (data?.sale?.items && Array.isArray(data.sale.items) && data.sale.items.length > 0)
        ? data.sale.items
        : JSON.parse(JSON.stringify($cart));

      const salePayments = (data?.sale?.payments && Array.isArray(data.sale.payments) && data.sale.payments.length > 0)
        ? data.sale.payments
        : [...payments];

      successReceipt = {
        ...(data?.sale || {}),
        id: data?.sale?.id || 'REC-' + Date.now(),
        total: data?.sale?.total ?? $cartTotal,
        createdAt: data?.sale?.createdAt || new Date().toISOString(),
        items: saleItems,
        payments: salePayments,
        change: cashChange,
        table: soldTable || data?.sale?.table,
      };
      clearCart();
      
      // Reset selected table
      if ($selectedTable) {
        isExitingTable = true;
        selectedTable.set(null);
      }
      
      triggerRefresh();

      if ($receiptSettings.autoPrint) {
        setTimeout(() => {
          printThermalReceipt('printable-thermal-receipt');
        }, 350);
      }
    } catch (e: any) {
      errorMessage = e.message || 'Error al procesar la venta';
    }
  }

  async function saveAndExitTable(destinationTab: string = 'tables') {
    if (!$selectedTable || isSavingTable) return;
    isSavingTable = true;
    isExitingTable = true;
    try {
      const tableId = $selectedTable.id;
      const currentCart = $cart;
      if (currentCart.length > 0) {
        const itemsPayload = currentCart.map((item) => ({
          productId: item.product.id,
          variantId: item.variant?.id || null,
          quantity: item.quantity,
          price: item.unitPrice !== undefined ? Number(item.unitPrice) : (item.variant ? Number(item.variant.price) : Number(item.product.price)),
          notes: item.notes || null,
        }));
        await apiSaveTableOrder(tableId, itemsPayload);
      } else {
        await apiCancelTableOrder(tableId);
      }
      selectedTable.set(null);
      cart.set([]);
      triggerRefresh();
      activeTab.set(destinationTab);
    } catch (e: any) {
      isExitingTable = false;
      alert(e.message || 'Error al guardar la orden de la mesa');
    } finally {
      isSavingTable = false;
    }
  }

  async function saveTableOrder() {
    await saveAndExitTable('tables');
  }

  async function exitTableMode() {
    await saveAndExitTable('tables');
  }

  // Auto-save if component is unmounted or user navigates to another tab while table is open
  onDestroy(() => {
    if (isExitingTable) return;
    if ($selectedTable) {
      const tableToSave = $selectedTable;
      const currentCart = [...$cart];
      if (currentCart.length > 0) {
        const itemsPayload = currentCart.map((item) => ({
          productId: item.product.id,
          variantId: item.variant?.id || null,
          quantity: item.quantity,
          price: item.unitPrice !== undefined ? Number(item.unitPrice) : (item.variant ? Number(item.variant.price) : Number(item.product.price)),
          notes: item.notes || null,
        }));
        apiSaveTableOrder(tableToSave.id, itemsPayload)
          .then(() => triggerRefresh())
          .catch((err) => console.error('Error auto-saving table on exit:', err));
      } else {
        apiCancelTableOrder(tableToSave.id)
          .then(() => triggerRefresh())
          .catch((err) => console.error('Error auto-cancelling empty table on exit:', err));
      }
      selectedTable.set(null);
      cart.set([]);
    }
  });

  // Warn before closing browser or refreshing if cart has unsaved table changes
  $effect(() => {
    if (!$selectedTable) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if ($cart.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  });

  async function openTableMerge() {
    if (!$selectedTable) return;
    try {
      // 1. Auto-save current cart if there are items
      if ($cart.length > 0) {
        const itemsPayload = $cart.map(item => ({
          productId: item.product.id,
          variantId: item.variant?.id || null,
          quantity: item.quantity,
          price: item.unitPrice !== undefined ? Number(item.unitPrice) : (item.variant ? Number(item.variant.price) : Number(item.product.price)),
          notes: item.notes || null,
        }));
        await apiSaveTableOrder($selectedTable.id, itemsPayload);
      }
      // 2. Fetch full table details
      const tables = await getTables();
      allTablesList = tables;
      const current = tables.find((t: any) => t.id === $selectedTable!.id);
      if (!current) throw new Error('Mesa no encontrada');
      activeCheckoutTableObj = current;
      showCheckoutMergeModal = true;
    } catch (e: any) {
      alert(e.message || 'Error al preparar fusión de mesa');
    }
  }

  async function openTableSplit() {
    if (!$selectedTable) return;
    try {
      // 1. Auto-save current cart if there are items
      if ($cart.length > 0) {
        const itemsPayload = $cart.map(item => ({
          productId: item.product.id,
          variantId: item.variant?.id || null,
          quantity: item.quantity,
          price: item.unitPrice !== undefined ? Number(item.unitPrice) : (item.variant ? Number(item.variant.price) : Number(item.product.price)),
          notes: item.notes || null,
        }));
        await apiSaveTableOrder($selectedTable.id, itemsPayload);
      }
      // 2. Fetch full table details
      const tables = await getTables();
      allTablesList = tables;
      const current = tables.find((t: any) => t.id === $selectedTable!.id);
      if (!current) throw new Error('Mesa no encontrada');
      activeCheckoutTableObj = current;
      showCheckoutSplitModal = true;
    } catch (e: any) {
      alert(e.message || 'Error al preparar división de mesa');
    }
  }

  async function openTablePreReceipt() {
    if (!$selectedTable) return;
    try {
      if ($cart.length > 0) {
        const itemsPayload = $cart.map(item => ({
          productId: item.product.id,
          variantId: item.variant?.id || null,
          quantity: item.quantity,
          price: item.unitPrice !== undefined ? Number(item.unitPrice) : (item.variant ? Number(item.variant.price) : Number(item.product.price)),
          notes: item.notes || null,
        }));
        await apiSaveTableOrder($selectedTable.id, itemsPayload);
      }

      preReceiptTableData = {
        id: $selectedTable.id,
        name: $selectedTable.name,
        currentSale: {
          id: $selectedTable.currentSaleId || 'PRE-' + Date.now().toString().slice(-6),
          createdAt: new Date().toISOString(),
          total: $cartTotal,
          user: { name: $user?.name || 'Cajero' },
          items: $cart.map((i) => ({
            quantity: i.quantity,
            price: i.unitPrice !== undefined ? Number(i.unitPrice) : (i.variant ? Number(i.variant.price) : Number(i.product.price)),
            product: i.product,
            variant: i.variant,
            notes: i.notes,
          })),
        },
      };
      showPreReceiptModal = true;
    } catch (e: any) {
      alert(e.message || 'Error al preparar pre-cuenta de la mesa');
    }
  }

  async function handleCheckoutMerge(sourceId: string, targetTableId: string) {
    await apiMergeTables(sourceId, targetTableId);
    triggerRefresh();
    selectedTable.set(null);
    cart.set([]);
    showCheckoutMergeModal = false;
    activeCheckoutTableObj = null;
    activeTab.set('tables');
  }

  async function handleCheckoutTransfer(sourceId: string, targetTableId: string, items: any[]) {
    const res = await apiTransferTableItems(sourceId, targetTableId, items);
    triggerRefresh();
    if (res.source && res.source.status === 'OCCUPIED' && res.source.currentSale) {
      const remainingItems = res.source.currentSale.items.map((i: any) => ({
        product: i.product,
        variant: i.variant || null,
        quantity: i.quantity,
        unitPrice: i.price !== undefined ? Number(i.price) : undefined,
        notes: i.notes || null,
      }));
      cart.set(remainingItems);
      selectedTable.set({
        id: res.source.id,
        name: res.source.name,
        status: res.source.status,
        currentSaleId: res.source.currentSaleId,
      });
    } else {
      selectedTable.set(null);
      cart.set([]);
      activeTab.set('tables');
    }
    showCheckoutSplitModal = false;
    activeCheckoutTableObj = null;
  }

  async function handleCheckoutPartialPay(tableId: string, payload: any) {
    const res = await apiPartialCheckoutTable(tableId, payload);
    triggerRefresh();
    if (res.table && res.table.status === 'OCCUPIED' && res.table.currentSale) {
      const remainingItems = res.table.currentSale.items.map((i: any) => ({
        product: i.product,
        variant: i.variant || null,
        quantity: i.quantity,
        unitPrice: i.price !== undefined ? Number(i.price) : undefined,
        notes: i.notes || null,
      }));
      cart.set(remainingItems);
      selectedTable.set({
        id: res.table.id,
        name: res.table.name,
        status: res.table.status,
        currentSaleId: res.table.currentSaleId,
      });
    } else {
      selectedTable.set(null);
      cart.set([]);
      activeTab.set('tables');
    }
    showCheckoutSplitModal = false;
    activeCheckoutTableObj = null;

    // Show receipt modal for partial checkout
    successReceipt = res.sale;
    wasTableSale = true;
    showPaymentModal = true;
    if ($receiptSettings.autoPrint) {
      setTimeout(() => {
        printThermalReceipt('printable-thermal-receipt');
      }, 350);
    }
    return res;
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
    {#await initPromise}
      <div style="flex: 1; display: flex; align-items: center; justify-content: center; min-height: 400px; width: 100%;">
        <Spinner size="40px" />
      </div>
    {:then}
      <!-- Header with Search & Tabs -->
      <div class="catalog-header glass-panel">
        <div class="search-bar-row">
          <div class="search-bar-container">
            <span class="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Buscar por nombre o escanear código / SKU..."
              aria-label="Buscar por nombre o escanear código"
              bind:value={searchQuery}
              bind:this={barcodeSearchInput}
              onkeydown={handleSearchKeyDown}
              class="search-input"
            />
            {#if searchQuery}
              <button class="clear-search-btn" onclick={() => searchQuery = ''} type="button" aria-label="Limpiar búsqueda">✕</button>
            {/if}
          </div>

          <button
            class="btn btn-general btn-scanner"
            onclick={() => showCameraScanner = true}
            title="Abrir lector de códigos de barras con cámara"
            type="button"
          >
            📷 Escanear
          </button>

          <button
            class="btn btn-secondary btn-sound"
            class:muted={!soundOn}
            onclick={() => { soundOn = !soundOn; setSoundEnabled(soundOn); }}
            title={soundOn ? 'Sonido activado (Click para silenciar)' : 'Sonido silenciado (Click para activar)'}
            type="button"
            aria-label={soundOn ? 'Silenciar sonidos' : 'Activar sonidos'}
          >
            {soundOn ? '🔊' : '🔇'}
          </button>
        </div>

        <div class="tabs-and-filters">
          <div class="dept-tabs">
            <button
              type="button"
              class="tab-btn"
              class:active={activeDept === 'CAFE'}
              onclick={() => { activeDept = 'CAFE'; selectedCategory = ''; }}
            >
              ☕ Café
            </button>
            <button
              type="button"
              class="tab-btn"
              class:active={activeDept === 'MARKET'}
              onclick={() => { activeDept = 'MARKET'; selectedCategory = ''; }}
            >
              🍏 Mercado Saludable
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
          <ProductCard product={p} onclick={() => handleProductCardClick(p)} />
        {:else}
          <div class="no-results flex-center glass-panel animate-fade-in">
            <p>No se encontraron productos en esta sección.</p>
          </div>
        {/each}
      </div>
    {:catch error}
      <div class="error-banner animate-fade-in" style="margin: 20px;">
        Error al cargar catálogo de productos: {error.message}
      </div>
    {/await}
  </div>

  <!-- Right Side: Shopping Cart -->
  <div class="cart-section glass-panel">
    {#if $selectedTable}
      <div class="table-mode-banner">
        <div class="table-title-row">
          <span class="table-name-label">📌 Cuenta: <strong>{$selectedTable.name}</strong></span>
        </div>
        <div class="table-banner-actions">
          <button
            type="button"
            class="btn-table-tool btn-pre-receipt-tool"
            onclick={openTablePreReceipt}
            title="Imprimir Pre-Cuenta para el cliente"
            aria-label="Imprimir Pre-Cuenta para el cliente"
          >
            🧾 Pre-Cuenta
          </button>
          <button
            type="button"
            class="btn-table-tool"
            onclick={openTableMerge}
            title="Fusionar o mover esta mesa"
            aria-label="Fusionar o mover esta mesa"
          >
            🔀 Mover / Unir
          </button>
          <button
            type="button"
            class="btn-table-tool"
            onclick={openTableSplit}
            title="Dividir cuenta o transferir productos"
            aria-label="Dividir cuenta o transferir productos"
          >
            ✂️ Dividir
          </button>
          <button
            type="button"
            class="btn-exit-table"
            onclick={exitTableMode}
            disabled={isSavingTable}
            title="Salir de la mesa (guarda automáticamente)"
            aria-label="Salir de la mesa"
          >
            {isSavingTable ? 'Guardando... ⏳' : 'Volver ↩'}
          </button>
        </div>
      </div>
    {/if}

    <div class="cart-header">
      <h2>Carrito de Compra</h2>
      <button class="btn btn-secondary" onclick={clearCart} disabled={$cart.length === 0}>
        Vaciar
      </button>
    </div>

    <div class="cart-items scroll-y">
      {#each $cart as item, index (item.product.id + (item.variant?.id || '') + (item.notes || '') + index)}
        {@const fullProduct = $products.find((p) => p.id === item.product.id) || item.product}
        {@const hasRecipe = Boolean(
          (fullProduct?.modifiers && fullProduct.modifiers.length > 0) ||
          (item.product?.modifiers && item.product.modifiers.length > 0)
        )}
        <CartItem
          {item}
          onupdateqty={(prodId, varId, delta) => updateQuantity(prodId, varId, delta, index)}
          onsetqty={(prodId, varId, qty) => setQuantity(prodId, varId, qty, index)}
          onsetprice={(prodId, varId, price) => setUnitPrice(prodId, varId, price, index)}
          onremove={(prodId, varId) => removeFromCart(prodId, varId, index)}
          oncustomize={hasRecipe ? () => openCustomizeModal(fullProduct, item.variant, index) : undefined}
        />
      {:else}
        <div class="empty-cart flex-center">
          🛒 Carrito Vacío
        </div>
      {/each}
    </div>

    <div class="cart-footer">
      {#if !$currentShift?.shift || $currentShift.shift.status !== 'OPEN'}
        <div class="shift-gate-prompt animate-fade-in" role="alert">
          <span class="gate-icon">⚠️</span>
          <div class="gate-text">
            <strong>Caja Cerrada</strong>
            <p>Se requiere un turno abierto con base inicial para cobrar.</p>
          </div>
          <button type="button" class="btn btn-primary btn-sm" onclick={() => (showOpenShiftModal = true)}>
            Abrir Caja
          </button>
        </div>
      {/if}

      <div class="total-row">
        <span>Total a Pagar</span>
        <span class="total-amount">${$cartTotal.toLocaleString()}</span>
      </div>
      {#if $selectedTable}
        <div class="table-action-buttons">
          <button
            type="button"
            class="btn btn-market save-table-btn"
            onclick={saveTableOrder}
            disabled={isSavingTable}
            title="Guardar cambios y volver a mesas"
          >
            {isSavingTable ? 'Guardando... ⏳' : 'Guardar Mesa 💾'}
          </button>
          <button
            type="button"
            class="btn btn-general checkout-btn"
            onclick={openCheckout}
            disabled={$cart.length === 0 || isSavingTable}
          >
            Cobrar Mesa 💳
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
{#snippet addPaymentSection()}
  <div class="add-payment-section">
    <h3>Agregar Método de Pago</h3>
    <div class="payment-inputs">
      <div class="method-selector">
        <MethodBtn method="CASH" currentMethod={currentMethod} label="💵 Efectivo" onclick={(m) => { currentMethod = m; currentAmountInput = remainingToPay.toString(); }} />
        <MethodBtn method="CARD" currentMethod={currentMethod} label="💳 Tarjeta" onclick={(m) => { currentMethod = m; currentAmountInput = remainingToPay.toString(); }} />
        <MethodBtn method="TRANSFER" currentMethod={currentMethod} label="📲 Transferencia" onclick={(m) => { currentMethod = m; currentAmountInput = remainingToPay.toString(); }} />
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
{/snippet}

{#snippet registeredPaymentsList()}
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
          <button type="button" class="remove-payment-btn" onclick={() => removePayment(i)} aria-label="Eliminar pago">✕</button>
        </div>
      {:else}
        <p class="no-payments">No se han agregado pagos aún.</p>
      {/each}
    </div>
  </div>
{/snippet}

{#snippet successReceiptView()}
  <div class="receipt-container animate-scale-up">
    <!-- Quick Action Bar (Screen only, hidden on print) -->
    <div class="receipt-actions-panel no-print">
      <div class="receipt-header-status">
        <span class="success-icon">🎉</span>
        <div>
          <h2 class="success-title">¡Venta Registrada!</h2>
          <p class="ticket-sub">Ticket: #{successReceipt.id.slice(0, 8).toUpperCase()}</p>
        </div>
      </div>

      <div class="receipt-settings-bar">
        <label class="auto-print-label" title="Imprimir automáticamente ticket al completar cobro">
          <input
            type="checkbox"
            checked={$receiptSettings.autoPrint}
            onchange={(e) => receiptSettings.update(s => ({ ...s, autoPrint: e.currentTarget.checked }))}
          />
          <span>Auto-imprimir al cobrar</span>
        </label>
        <button
          type="button"
          class="btn-config-receipt"
          onclick={() => (showReceiptSettingsModal = true)}
          title="Configurar datos del ticket (Nombre, NIT, dirección, pie de página)"
        >
          ⚙️ Ajustes Ticket
        </button>
      </div>

      <div class="receipt-main-buttons">
        <button
          type="button"
          class="btn btn-general btn-print-receipt"
          onclick={() => printThermalReceipt('printable-thermal-receipt')}
        >
          🖨️ Imprimir Ticket (80mm)
        </button>
        <button
          type="button"
          class="btn btn-secondary btn-close-receipt"
          onclick={closePaymentModal}
        >
          Nueva Venta ➔
        </button>
      </div>
    </div>

    <!-- Thermal 80mm Printable & Preview component -->
    <div class="receipt-paper-wrapper">
      <ThermalReceipt80mm
        sale={successReceipt}
        cashierName={$user?.name}
        tableName={successReceipt.table?.name || $selectedTable?.name}
      />
    </div>
  </div>
{/snippet}

{#snippet paymentModal()}
  {#if showPaymentModal}
    <div class="modal-overlay flex-center animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title">
      <div class="modal-container glass-panel animate-scale-up">
        {#if !successReceipt}
          <div class="modal-header">
            <h2 id="payment-modal-title">Registrar Pago Dividido</h2>
            <button type="button" class="close-modal-btn" onclick={closePaymentModal} aria-label="Cerrar ventana de pago">✕</button>
          </div>

          {#if errorMessage}
            <div class="error-banner">{errorMessage}</div>
          {/if}

          <div class="payment-math-container">
            <MathCard label="Total Venta" value={"$" + $cartTotal.toLocaleString()} valueClass="text-general" />
            <MathCard label="Registrado" value={"$" + paidAmount.toLocaleString()} valueClass="text-market" />
            <MathCard label="Restante" value={"$" + remainingToPay.toLocaleString()} valueClass={remainingToPay > 0 ? 'text-danger' : 'text-market'} />
          </div>

          <!-- Add Payment Section -->
          {#if remainingToPay > 0}
            {@render addPaymentSection()}
          {/if}

          <!-- List of Registered Payments -->
          {@render registeredPaymentsList()}

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
          {@render successReceiptView()}
        {/if}
      </div>
    </div>
  {/if}
{/snippet}

{#snippet variantModal()}
  {#if showVariantModal && selectedProductForVariant}
    <div
      class="modal-overlay flex-center animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="variant-modal-title"
      tabindex="-1"
      onkeydown={(e) => { if (e.key === 'Escape') { showVariantModal = false; selectedProductForVariant = null; } }}
    >
      <div class="modal-container glass-panel variant-modal animate-scale-up">
        <div class="modal-header">
          <div>
            <h2 id="variant-modal-title">Seleccionar Variante</h2>
            <p class="variant-modal-sub">{selectedProductForVariant.name}</p>
          </div>
          <button type="button" class="close-modal-btn" onclick={() => { showVariantModal = false; selectedProductForVariant = null; }} aria-label="Cerrar selección de variante">✕</button>
        </div>

        <div class="variant-options-grid scroll-y">
          {#each (selectedProductForVariant.variants || []).filter((v: any) => v.active !== false) as v}
            {@const isInfinite = selectedProductForVariant.department === 'CAFE' && ((selectedProductForVariant.stock >= 900) || (v.stock >= 900))}
            {@const isOutOfStock = !isInfinite && Number(v.stock || 0) <= 0}
            <button
              type="button"
              class="variant-option-card"
              class:out-of-stock={isOutOfStock}
              disabled={isOutOfStock}
              onclick={() => {
                const prod = selectedProductForVariant;
                showVariantModal = false;
                selectedProductForVariant = null;
                if (prod?.modifiers && prod.modifiers.length > 0) {
                  openCustomizeModal(prod, v);
                } else {
                  addToCart(prod, v);
                }
              }}
            >
              <div class="v-card-top">
                <span class="v-name">{v.name}</span>
                {#if v.sku}
                  <span class="v-sku">{v.sku}</span>
                {/if}
              </div>
              <div class="v-card-bottom">
                <span class="v-price">${Number(v.price).toLocaleString()}</span>
                <span class="v-stock" class:out={isOutOfStock}>
                  {#if isInfinite}
                    Ilimitado
                  {:else if isOutOfStock}
                    Agotado
                  {:else}
                    Stock: {v.stock}
                  {/if}
                </span>
              </div>
            </button>
          {/each}
        </div>

        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-secondary"
            onclick={() => { showVariantModal = false; selectedProductForVariant = null; }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  {/if}
{/snippet}

{@render paymentModal()}
{@render variantModal()}

<!-- Visual scan notification toast -->
<ScanToast toast={currentToast} />

<!-- Camera Barcode Scanner Modal -->
{#if showCameraScanner}
  <BarcodeScannerModal
    title="Escanear Producto para Caja"
    mode="continuous"
    onscan={(code) => handleBarcodeScanned(code)}
    onclose={() => showCameraScanner = false}
  />
{/if}

{#if showCheckoutMergeModal && activeCheckoutTableObj}
  <MergeTableModal
    sourceTable={activeCheckoutTableObj}
    tables={allTablesList}
    onmerge={handleCheckoutMerge}
    onclose={() => { showCheckoutMergeModal = false; activeCheckoutTableObj = null; }}
  />
{/if}

{#if showCheckoutSplitModal && activeCheckoutTableObj}
  <SplitTableModal
    table={activeCheckoutTableObj}
    tables={allTablesList}
    userId={$user?.id || ''}
    ontransfer={handleCheckoutTransfer}
    oncheckout={handleCheckoutPartialPay}
    onclose={() => { showCheckoutSplitModal = false; activeCheckoutTableObj = null; }}
  />
{/if}

{#if showOpenShiftModal}
  <OpenShiftModal
    onclose={() => (showOpenShiftModal = false)}
    onsuccess={() => {
      showOpenShiftModal = false;
    }}
  />
{/if}

{#if showReceiptSettingsModal}
  <ReceiptSettingsModal
    onclose={() => (showReceiptSettingsModal = false)}
  />
{/if}

{#if showCustomizeModal && productToCustomize}
  <CustomizeRecipeModal
    product={productToCustomize}
    selectedVariant={variantToCustomize}
    initialModifiers={initialModifiersForModal}
    initialNotes={initialNotesForModal}
    initialQuantity={initialQuantityForModal}
    onconfirm={handleConfirmCustomization}
    onclose={() => {
      showCustomizeModal = false;
      productToCustomize = null;
      variantToCustomize = null;
      editingCartIndex = null;
    }}
  />
{/if}

{#if showPreReceiptModal && preReceiptTableData}
  <PreReceiptModal
    table={preReceiptTableData}
    onclose={() => {
      showPreReceiptModal = false;
      preReceiptTableData = null;
    }}
  />
{/if}


<style>
  .checkout-layout {
    display: flex;
    height: calc(100vh - 32px);
    max-height: calc(100vh - 32px);
    min-height: 520px;
    width: 100%;
    gap: 16px;
    padding: 4px;
    box-sizing: border-box;
    overflow: hidden;
  }

  /* Catalog Area */
  .catalog-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 14px;
    height: 100%;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
  }

  .catalog-header {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex-shrink: 0;
  }

  .search-bar-row {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
  }

  .search-bar-container {
    position: relative;
    flex: 1;
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
    padding-right: 32px;
  }

  .clear-search-btn {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 0.9rem;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .clear-search-btn:hover {
    color: var(--text-primary);
  }

  .btn-scanner {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.88rem;
    padding: 0 16px;
    height: 42px;
    white-space: nowrap;
  }

  .btn-sound {
    font-size: 1.1rem;
    padding: 0 12px;
    height: 42px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--border-glass);
    cursor: pointer;
    border-radius: var(--radius-sm);
  }
  .btn-sound.muted {
    opacity: 0.5;
    filter: grayscale(1);
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
    min-height: 0;
    overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    grid-auto-rows: max-content;
    align-content: start;
    gap: 14px;
    padding-bottom: 20px;
    padding-right: 4px;
  }

  .scroll-y {
    overflow-y: auto;
  }



  .no-results {
    grid-column: 1 / -1;
    height: 150px;
    color: var(--text-secondary);
  }

  /* Cart Section */
  .cart-section {
    width: 380px;
    height: 100%;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    overflow: hidden;
  }

  .cart-header {
    padding: 18px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border-glass);
    background: rgba(255, 255, 255, 0.4);
    flex-shrink: 0;
  }

  .cart-header h2 {
    font-size: 1.15rem;
    font-weight: 600;
  }

  .cart-items {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .empty-cart {
    height: 100%;
    min-height: 140px;
    color: var(--text-secondary);
    font-size: 1.1rem;
    opacity: 0.5;
  }

  .cart-footer {
    padding: 18px;
    border-top: 1px solid var(--border-glass);
    background: rgba(255, 255, 255, 0.75);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.03);
    flex-shrink: 0;
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

  .shift-gate-prompt {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    margin-bottom: 12px;
    background: rgba(231, 76, 60, 0.12);
    border: 1px solid rgba(231, 76, 60, 0.35);
    border-radius: var(--radius-sm);
  }

  .gate-icon {
    font-size: 1.2rem;
  }

  .gate-text {
    flex: 1;
    font-size: 0.8rem;
  }

  .gate-text strong {
    color: #e74c3c;
    display: block;
    font-size: 0.84rem;
  }

  .gate-text p {
    margin: 2px 0 0 0;
    color: var(--text-secondary);
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
    border: 1px solid rgba(180, 83, 9, 0.25);
    color: #78350f;
    font-weight: 600;
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

  /* Receipt and Thermal Print styles */
  .receipt-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-height: 82vh;
    overflow-y: auto;
    padding-right: 4px;
  }

  .receipt-actions-panel {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-md);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .receipt-header-status {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .success-icon {
    font-size: 2.2rem;
    line-height: 1;
    filter: drop-shadow(0 0 10px rgba(16, 185, 129, 0.35));
  }

  .success-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-general);
  }

  .ticket-sub {
    margin: 2px 0 0 0;
    font-size: 0.85rem;
    color: var(--text-secondary);
    font-family: monospace;
  }

  .receipt-settings-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(0, 0, 0, 0.25);
    padding: 8px 12px;
    border-radius: var(--radius-sm);
  }

  .auto-print-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.82rem;
    color: var(--text-secondary);
    cursor: pointer;
    user-select: none;
  }

  .auto-print-label input[type="checkbox"] {
    accent-color: var(--color-general);
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .btn-config-receipt {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    padding: 4px 10px;
    font-size: 0.78rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-config-receipt:hover {
    background: rgba(255, 255, 255, 0.16);
    border-color: var(--border-glass-hover);
  }

  .receipt-main-buttons {
    display: flex;
    gap: 10px;
  }

  .btn-print-receipt {
    flex: 1.3;
    font-weight: 700;
    height: 42px;
    font-size: 0.95rem;
  }

  .btn-close-receipt {
    flex: 1;
    height: 42px;
    font-size: 0.9rem;
  }

  .receipt-paper-wrapper {
    display: flex;
    justify-content: center;
    background: rgba(0, 0, 0, 0.35);
    border-radius: var(--radius-md);
    padding: 16px 8px;
    border: 1px solid var(--border-glass);
  }

  .table-mode-banner {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--color-cafe-glow);
    border-bottom: 1px solid rgba(180, 83, 9, 0.25);
    padding: 10px 14px;
    border-top-left-radius: var(--radius-md);
    border-top-right-radius: var(--radius-md);
    flex-shrink: 0;
  }

  .table-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .table-name-label {
    font-size: 0.95rem;
    font-weight: 600;
    color: #78350f;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .table-name-label strong {
    font-weight: 700;
    color: #451a03;
  }

  .table-banner-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    flex-wrap: wrap;
  }

  .btn-table-tool {
    flex: 1;
    min-width: fit-content;
    text-align: center;
    justify-content: center;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: rgba(180, 83, 9, 0.12);
    border: 1px solid rgba(180, 83, 9, 0.35);
    color: #78350f;
    padding: 6px 8px;
    font-size: 0.78rem;
    font-weight: 600;
    border-radius: var(--radius-sm, 6px);
    cursor: pointer;
    transition: var(--transition-fast);
    outline: none;
    white-space: nowrap;
  }

  .btn-table-tool:hover {
    background: rgba(180, 83, 9, 0.22);
    border-color: rgba(180, 83, 9, 0.5);
  }

  .btn-pre-receipt-tool {
    background: rgba(16, 185, 129, 0.12);
    border-color: rgba(16, 185, 129, 0.4);
    color: #065f46;
    font-weight: 700;
  }

  .btn-pre-receipt-tool:hover {
    background: rgba(16, 185, 129, 0.25);
    border-color: rgba(16, 185, 129, 0.6);
  }

  .btn-exit-table {
    flex: 1;
    min-width: fit-content;
    text-align: center;
    justify-content: center;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(180, 83, 9, 0.4);
    color: #78350f;
    padding: 6px 8px;
    font-size: 0.78rem;
    font-weight: 600;
    border-radius: var(--radius-sm, 6px);
    cursor: pointer;
    transition: var(--transition-fast);
    outline: none;
    white-space: nowrap;
  }

  .btn-exit-table:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.9);
  }

  .btn-exit-table:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .table-action-buttons {
    display: flex;
    gap: 10px;
    width: 100%;
  }

  .table-action-buttons .btn {
    flex: 1;
    min-width: 0;
    width: auto;
    height: 48px;
    font-size: 1rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .save-table-btn {
    height: 48px;
    font-size: 1rem;
  }
  .save-table-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Variant Selector Modal */
  .variant-modal {
    max-width: 560px;
    max-height: 85vh;
  }

  .variant-modal-sub {
    margin: 4px 0 0 0;
    font-size: 0.88rem;
    color: var(--text-secondary);
  }

  .variant-options-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
    max-height: 50vh;
    padding: 4px;
  }

  .variant-option-card {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius-md, 10px);
    cursor: pointer;
    text-align: left;
    transition: var(--transition-fast);
    min-height: 85px;
  }

  .variant-option-card:hover:not(:disabled) {
    border-color: var(--color-general);
    background: rgba(4, 120, 87, 0.08);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .variant-option-card.out-of-stock {
    opacity: 0.45;
    cursor: not-allowed;
    background: rgba(0, 0, 0, 0.05);
  }

  .v-card-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 8px;
  }

  .v-name {
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--text-primary);
  }

  .v-sku {
    font-size: 0.72rem;
    color: var(--text-muted);
    background: rgba(255, 255, 255, 0.06);
    padding: 2px 5px;
    border-radius: 4px;
    white-space: nowrap;
  }

  .v-card-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .v-price {
    font-weight: 700;
    font-size: 1.05rem;
    color: var(--color-general);
  }

  .v-stock {
    font-size: 0.78rem;
    color: var(--text-secondary);
  }

  .v-stock.out {
    color: var(--color-danger);
    font-weight: 600;
  }

  @media (max-width: 900px) {
    .checkout-layout {
      flex-direction: column;
      height: auto;
      max-height: none;
      min-height: 100%;
      overflow-y: visible;
    }

    .catalog-section {
      height: auto;
      max-height: none;
      overflow: visible;
    }

    .products-grid {
      max-height: 50vh;
    }

    .cart-section {
      width: 100%;
      height: auto;
      max-height: none;
      overflow: visible;
    }

    .cart-footer {
      position: sticky;
      bottom: 0;
      background: var(--bg-glass);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      z-index: 10;
    }
  }
</style>
