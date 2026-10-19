/**
 * Lógica de la wishlist lista para el cliente (localStorage).
 *
 * El HTML se pinta en SSR con la wishlist del usuario; este módulo se
 * encarga de que el navegador pueda marcarla, agregar y quitar, y se
 * mantenga sincronizada en todas las pestañas.
 */

export interface WishlistItem {
  productId: string;
  slug: string | null;
  name: string;
  price: number;
  image: string | null;
}

const KEY = 'dsp_wishlist';

export function getLocalWishlist(): WishlistItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(items: WishlistItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('wishlist:updated', { detail: items }));
}

export function isLocalWishlisted(productId: string) {
  return getLocalWishlist().some((i) => i.productId === productId);
}

/** Quita favoritos que ya no existen o ya se compraron (por id de producto). */
export function pruneLocalWishlist(validIds: string[]) {
  const valid = new Set(validIds);
  const current = getLocalWishlist();
  const next = current.filter((i) => valid.has(String(i.productId)));
  if (next.length !== current.length) writeLocal(next);
  return next;
}

/** Helpers para páginas sin sesión (la sesión usa el API). */
export function toggleLocalWishlist(item: WishlistItem): boolean {
  const local = getLocalWishlist();
  const exists = local.some((i) => i.productId === item.productId);
  const next = exists ? local.filter((i) => i.productId !== item.productId) : [item, ...local];
  writeLocal(next);

  window.dispatchEvent(new CustomEvent(exists ? 'wishlist:removed' : 'wishlist:added', { detail: { productId: item.productId, name: item.name } }));
  return !exists;
}

export function removeLocalWishlist(productId: string) {
  writeLocal(getLocalWishlist().filter((i) => i.productId !== productId));
  window.dispatchEvent(new CustomEvent('wishlist:updated', { detail: getLocalWishlist() }));
  window.dispatchEvent(new CustomEvent('wishlist:removed', { detail: { productId } }));
}
