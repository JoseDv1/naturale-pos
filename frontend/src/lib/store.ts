import { writable, derived } from 'svelte/store';

// User session store
export const user = writable<{
  id: string;
  username: string;
  name: string;
  role: string;
} | null>(null);

// Active Tab navigation
export const activeTab = writable<string>('checkout');

// Product and Category lists cache
export const products = writable<any[]>([]);
export const categories = writable<any[]>([]);

// Shopping cart store
export interface CartItem {
  product: {
    id: string;
    sku: string;
    name: string;
    price: number;
    cost: number;
    stock: number;
    department: string;
    isRawMaterial: boolean;
  };
  quantity: number;
}

export const cart = writable<CartItem[]>([]);

// Derived cart total
export const cartTotal = derived(cart, ($cart) => {
  return $cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
});

// Trigger updates in other views (e.g. re-fetch data)
export const refreshTrigger = writable<number>(0);
export function triggerRefresh() {
  refreshTrigger.update((n) => n + 1);
}

// Active selected table store (for cafe table orders)
export interface SelectedTable {
  id: string;
  name: string;
  status: string;
  currentSaleId: string | null;
}
export const selectedTable = writable<SelectedTable | null>(null);
