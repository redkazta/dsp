/**
 * Cart utilities - carrito persistente en localStorage
 * MVP: sin backend, el checkout envía a la API .NET
 */

export interface CartItem {
  variantId: string;
  productId: string;
  name: string;
  variantName: string;
  price: number;
  qty: number;
  image?: string;
}

const KEY = 'dsp_cart';

export function getCart(): CartItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
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
    item.qty = Math.max(1, qty);
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

export function formatMXN(n: number): string {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
