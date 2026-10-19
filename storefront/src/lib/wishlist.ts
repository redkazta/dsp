/**
 * Wishlist por usuario.
 *
 * Con sesión, las operaciones pasan por `/api/wishlist` (el navegador nunca
 * escribe `wishlist_items` directo). Sin sesión vive en localStorage y se
 * fusiona con la nube al iniciar sesión.
 */

import type { WishlistItem } from './wishlist-local';
import { isLocalWishlisted, removeLocalWishlist, toggleLocalWishlist } from './wishlist-local';
import {
  deleteWishlistRemote,
  fetchWishlist,
  mergeWishlist,
  toggleWishlistRemote,
} from './wishlist-api';

export type { WishlistItem };

function emit(items: WishlistItem[]) {
  window.dispatchEvent(new CustomEvent('wishlist:updated', { detail: items }));
}

async function localItems(): Promise<WishlistItem[]> {
  const { getLocalWishlist } = await import('./wishlist-local');
  return getLocalWishlist();
}

/**
 * Arranque del cliente: toma la lista inicial que pintó el servidor y
 * la fusiona con lo que el visitante guardó sin cuenta.
 */
export async function initWishlistView(
  serverItems: WishlistItem[],
  opts: { isAuth: boolean }
): Promise<WishlistItem[]> {
  if (!opts.isAuth) {
    const local = await localItems();
    emit(local);
    return local;
  }

  const local = await localItems();
  if (local.length === 0) {
    emit(serverItems);
    return serverItems;
  }

  try {
    const items = await mergeWishlist(local);
    localStorage.removeItem('dsp_wishlist');
    emit(items);
    return items;
  } catch {
    emit(serverItems);
    return serverItems;
  }
}

/**
 * Agrega o quita. Devuelve true si quedó guardado.
 * Actualiza la lista y avisa con eventos (`wishlist:added` / `wishlist:removed`).
 */
export async function toggleWishlist(item: WishlistItem): Promise<boolean> {
  if (!(await hasSession())) {
    const active = toggleLocalWishlist(item);
    emit(await localItems());
    return active;
  }

  const { items, active } = await toggleWishlistRemote(item.productId);
  emit(items);
  window.dispatchEvent(
    new CustomEvent(active ? 'wishlist:added' : 'wishlist:removed', {
      detail: { productId: item.productId, name: item.name },
    })
  );
  return Boolean(active);
}

export async function removeFromWishlist(productId: string) {
  if (!(await hasSession())) {
    removeLocalWishlist(productId);
    return;
  }

  const { items } = await deleteWishlistRemote(productId);
  emit(items);
}

export async function isInWishlist(productId: string): Promise<boolean> {
  if (!(await hasSession())) return isLocalWishlisted(productId);

  // El botón ya viene pintado por SSR; si la API falla, no bloqueamos la UI.
  try {
    const items: WishlistItem[] = await fetchWishlist();
    return items.some((i: WishlistItem) => i.productId === productId);
  } catch {
    return false;
  }
}

/**
 * ¿Hay sesión? El HTML del layout lo deja en `<html data-auth="1">`,
 * así no hace falta pedirle la sesión a Supabase en cada click.
 */
export async function hasSession(): Promise<boolean> {
  if (typeof document !== 'undefined' && document.documentElement.dataset.auth) {
    return document.documentElement.dataset.auth === '1';
  }
  const { getUser } = await import('./auth');
  return Boolean(await getUser());
}
