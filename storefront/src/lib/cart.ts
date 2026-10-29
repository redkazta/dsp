/**
 * Cart utilities - carrito persistente en localStorage.
 *
 * Solo guarda qué variante y cuántas piezas: el precio que se cobra
 * se recalcula en el servidor (`/api/checkout`). Lo que se muestra aquí
 * es referencial y se refresca con `refreshCartPrices()`.
 *
 * El carrito vive en el navegador, así que "tiempo real" aquí significa
 * entre pestañas del mismo navegador: `BroadcastChannel` + el evento
 * `storage` (que el navegador emite en las demás pestañas al escribir).
 */

export interface CartItem {
  variantId: string;
  productId: string;
  name: string;
  variantName: string;
  price: number;
  qty: number;
  image?: string;
  size?: string | null;
  color?: string | null;
}

export { formatMXN } from './pricing';
import { FREE_SHIPPING_THRESHOLD, STANDARD_SHIPPING, shippingCostFor } from './pricing';

export { FREE_SHIPPING_THRESHOLD, STANDARD_SHIPPING, shippingCostFor };

const KEY = 'dsp_cart';
const SYNC_KEY = 'dsp_cart_sync';
const CHANNEL = 'dsp:cart';

// ---------------------------------------------------------------------------
// Sincronización entre pestañas
// ---------------------------------------------------------------------------

let channel: BroadcastChannel | null = null;
let syncBound = false;

function tabId(): string {
  const w = window as Window & { __dspCartTab?: string };
  w.__dspCartTab ??=
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `tab-${Math.random().toString(36).slice(2)}`;
  return w.__dspCartTab;
}

/**
 * Arranca la escucha entre pestañas (idempotente, una vez por página).
 *
 * No hay nada que pedir al servidor: el carrito es local, así que el aviso
 * llega con la propia lista ya escrita en `localStorage`.
 */
export function startCartSync(): void {
  if (typeof window === 'undefined' || syncBound) return;
  syncBound = true;
  tabId();

  if (typeof window.BroadcastChannel !== 'undefined') {
    channel = new window.BroadcastChannel(CHANNEL);
    channel.onmessage = (e) => {
      if (e.data?.from && e.data.from === tabId()) return;
      emitCartUpdate();
    };
  }

  // Red de seguridad: `storage` no depende de que la otra pestaña tenga el
  // canal abierto (y `dsp_cart_sync` sirve para cambios de otra pestaña
  // que no toquen la clave principal, p. ej. `replaceCart`).
  window.addEventListener('storage', (e) => {
    if (e.key === KEY || e.key === SYNC_KEY) emitCartUpdate();
  });
}

/**
 * `cart:updated` con la lista leída AHORA de localStorage.
 * Se relee a propósito: el evento debe reflejar el estado real, no una
 * copia que pueda haber quedado vieja.
 */
function emitCartUpdate(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('cart:updated', { detail: getCart() }));
}

/** Avisa a las demás pestañas de que el carrito cambió aquí. */
function broadcastCart(): void {
  if (typeof window === 'undefined') return;
  channel?.postMessage({ type: 'changed', from: tabId() });
  try {
    localStorage.setItem(SYNC_KEY, String(Date.now()));
  } catch {
    /* modo privado restrictivo: el canal ya avisó */
  }
}

/**
 * Detalle de la última pieza añadida (para los avisos flotantes).
 * `StoreDrawer` no sabe qué se acaba de añadir —solo ve el carrito entero—
 * así que `addToCart` deja aquí el nombre y la variante.
 */
export interface LastAdded {
  name: string;
  variantName?: string;
  image?: string;
}

let lastAdded: LastAdded | null = null;

/** Última pieza quitada del carrito (para el aviso de "eliminado"). */
let lastRemoved: LastAdded | null = null;

export function takeLastAdded(): LastAdded | null {
  const value = lastAdded;
  lastAdded = null;
  return value;
}

export function takeLastRemoved(): LastAdded | null {
  const value = lastRemoved;
  lastRemoved = null;
  return value;
}

export function getCart(): CartItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
  broadcastCart();
  emitCartUpdate();
}

export function addToCart(item: CartItem): CartItem[] {
  const cart = getCart();
  const existing = cart.find((i) => i.variantId === item.variantId);
  if (existing) {
    existing.qty += item.qty;
  } else {
    cart.push(item);
  }
  lastAdded = {
    name: item.name,
    variantName: item.variantName,
    image: item.image,
  };
  saveCart(cart);
  return cart;
}

export function removeFromCart(variantId: string): CartItem[] {
  const current = getCart();
  const target = current.find((i) => i.variantId === variantId);
  const cart = current.filter((i) => i.variantId !== variantId);

  if (target) {
    lastRemoved = {
      name: target.name,
      variantName: target.variantName,
      image: target.image,
    };
  }

  saveCart(cart);
  return cart;
}

export function updateQty(variantId: string, qty: number): CartItem[] {
  const cart = getCart();
  const item = cart.find((i) => i.variantId === variantId);
  if (item) {
    item.qty = Math.min(99, Math.max(1, qty));
    saveCart(cart);
  }
  return cart;
}

export function clearCart(): void {
  saveCart([]);
}

export function cartCount(): number {
  return getCart().reduce((n, i) => n + i.qty, 0);
}

export function cartSubtotal(): number {
  return getCart().reduce((n, i) => n + i.price * i.qty, 0);
}

/**
 * Refresca precio y nombre de cada pieza contra `product_variants`.
 * Devuelve los artículos del carrito que ya no existen (huérfanos).
 */
export async function refreshCartPrices(): Promise<{
  cart: CartItem[];
  removed: string[];
}> {
  const cart = getCart();
  if (cart.length === 0) return { cart, removed: [] };

  const { supabase } = await import('./supabase');
  const { data, error } = await supabase
    .from('product_variants')
    .select('id, name, size, color, price, is_deleted, products(id, name, is_active, is_deleted, product_images(url, position))')
    .in('id', cart.map((i) => i.variantId));

  if (error) return { cart, removed: [] };

  const byId = new Map((data ?? []).map((row: any) => [row.id, row]));
  const removed: string[] = [];

  const next = cart
    .map((item) => {
      const row = byId.get(item.variantId) as any;
      const product = row ? (Array.isArray(row.products) ? row.products[0] : row.products) : null;

      if (!row || row.is_deleted || !product || product.is_deleted || !product.is_active) {
        removed.push(item.variantId);
        return null;
      }

      const images = [...(product.product_images ?? [])].sort(
        (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)
      );

      return {
        ...item,
        name: product.name,
        variantName: row.name ?? item.variantName,
        price: Number(row.price),
        size: row.size ?? item.size ?? null,
        color: row.color ?? item.color ?? null,
        image: images[0]?.url ?? item.image,
      } as CartItem;
    })
    .filter(Boolean) as CartItem[];

  if (removed.length > 0 || JSON.stringify(next) !== JSON.stringify(cart)) {
    saveCart(next);
  }

  return { cart: next, removed };
}
