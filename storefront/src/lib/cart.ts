/**
 * Cart utilities - carrito persistente en localStorage.
 *
 * Solo guarda qué variante y cuántas piezas: el precio que se cobra
 * se recalcula en el servidor (`/api/orders`). Lo que se muestra aquí
 * es referencial y se refresca con `refreshCartPrices()`.
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
  window.dispatchEvent(new CustomEvent('cart:updated', { detail: items }));
}

export function addToCart(item: CartItem): CartItem[] {
  const cart = getCart();
  const existing = cart.find((i) => i.variantId === item.variantId);
  if (existing) {
    existing.qty += item.qty;
  } else {
    cart.push(item);
  }
  saveCart(cart);
  return cart;
}

export function removeFromCart(variantId: string): CartItem[] {
  const cart = getCart().filter((i) => i.variantId !== variantId);
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
