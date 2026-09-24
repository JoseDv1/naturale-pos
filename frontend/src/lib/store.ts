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
export interface ProductVariant {
  id: string;
  productId?: string;
  name: string;
  sku?: string | null;
  price: number;
  cost?: number;
  stock?: number;
  active?: boolean;
}

export interface ProductModifier {
  id?: string;
  productId?: string;
  name: string;
  price: number;
  cost?: number;
  isDefault?: boolean;
  active?: boolean;
}

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
    imageUrl?: string | null;
    variants?: ProductVariant[];
    modifiers?: ProductModifier[];
  };
  variant?: ProductVariant | null;
  selectedModifiers?: ProductModifier[];
  notes?: string | null;
  unitPrice?: number;
  quantity: number;
}

export const cart = writable<CartItem[]>([]);

// Derived cart total
export const cartTotal = derived(cart, ($cart) => {
  return $cart.reduce((sum, item) => {
    const base = item.variant ? Number(item.variant.price) : Number(item.product.price);
    const unitPrice = item.unitPrice !== undefined ? Number(item.unitPrice) : base;
    return sum + unitPrice * item.quantity;
  }, 0);
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

// Shift / Cash Drawer session store
export interface ShiftTotals {
  initialCash: number;
  cashSales: number;
  cardSales: number;
  transferSales: number;
  internalSales: number;
  expenses: number;
  expectedCash: number;
}

export interface Shift {
  id: string;
  userId: string;
  openedAt: string;
  closedAt?: string | null;
  initialCash: number;
  expectedCash?: number | null;
  actualCash?: number | null;
  difference?: number | null;
  status: 'OPEN' | 'CLOSED';
  notes?: string | null;
  user?: {
    id: string;
    name: string;
    username: string;
  };
}

export interface CurrentShiftState {
  shift: Shift | null;
  realTimeTotals: ShiftTotals | null;
}

export const currentShift = writable<CurrentShiftState | null>(null);

// -----------------------------------------------------------------------------
// Configuración de Impresión Térmica (80mm)
// -----------------------------------------------------------------------------
export interface ReceiptSettings {
  storeName: string;
  storeSubtitle: string;
  taxId: string;
  address: string;
  phone: string;
  legalNotice: string;
  footerMessage: string;
  website: string;
  autoPrint: boolean;
  paperWidth: '80mm' | '58mm';
}

export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
  storeName: 'NATURALE',
  storeSubtitle: 'Tienda Saludable & Café Orgánico',
  taxId: 'NIT: 901.234.567-8',
  address: 'Calle 10 # 4-20, Centro',
  phone: 'Tel / WhatsApp: +57 300 123 4567',
  legalNotice: 'Régimen Simplificado - No responsable de IVA',
  footerMessage: '¡Gracias por apoyar el comercio saludable y local!',
  website: 'www.naturalepos.co',
  autoPrint: false,
  paperWidth: '80mm',
};

function createReceiptSettingsStore() {
  const getStored = (): ReceiptSettings => {
    if (typeof window === 'undefined') return DEFAULT_RECEIPT_SETTINGS;
    try {
      const raw = localStorage.getItem('naturale_receipt_settings');
      if (!raw) return DEFAULT_RECEIPT_SETTINGS;
      return { ...DEFAULT_RECEIPT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_RECEIPT_SETTINGS;
    }
  };

  const { subscribe, set, update } = writable<ReceiptSettings>(getStored());

  return {
    subscribe,
    set: (value: ReceiptSettings) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('naturale_receipt_settings', JSON.stringify(value));
      }
      set(value);
    },
    update: (fn: (curr: ReceiptSettings) => ReceiptSettings) => {
      update((curr) => {
        const next = fn(curr);
        if (typeof window !== 'undefined') {
          localStorage.setItem('naturale_receipt_settings', JSON.stringify(next));
        }
        return next;
      });
    },
    reset: () => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('naturale_receipt_settings', JSON.stringify(DEFAULT_RECEIPT_SETTINGS));
      }
      set(DEFAULT_RECEIPT_SETTINGS);
    },
  };
}

export const receiptSettings = createReceiptSettingsStore();

