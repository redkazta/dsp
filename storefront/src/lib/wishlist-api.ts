/**
 * Cliente de `/api/wishlist` (sin dependencias de navegador).
 *
 * Lo usan tanto la UI del navegador (wishlist.ts) como las páginas SSR,
 * para que exista un solo lugar donde se habla con el endpoint.
 */

import type { WishlistItem } from './wishlist-local';

interface WishlistResponse {
  items: WishlistItem[];
  active?: boolean;
  guest?: boolean;
}

async function api(
  method: 'GET' | 'POST' | 'DELETE',
  body?: unknown,
  query = ''
): Promise<WishlistResponse> {
  const res = await fetch(`/api/wishlist${query}`, {
    method,
    // Content-Type explícito también cuando no hay cuerpo: Astro solo exige
    // mismo `Origin` para peticiones sin tipo, y un proxy puede borrar el body.
    headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? 'No se pudo actualizar favoritos');
  return json as WishlistResponse;
}

/** Lista del usuario. Lanza si falla la red o no hay sesión. */
export async function fetchWishlist(): Promise<WishlistItem[]> {
  const { items } = await api('GET');
  return items;
}

/** Fusiona favoritos guardados sin cuenta. */
export async function mergeWishlist(items: WishlistItem[]): Promise<WishlistItem[]> {
  const { items: merged } = await api('POST', { merge: items });
  return merged;
}

/** Alterna un producto. Devuelve la lista y si quedó guardado. */
export async function toggleWishlistRemote(productId: string) {
  return api('POST', { productId });
}

/** Quita un producto. */
export async function deleteWishlistRemote(productId: string) {
  // El id va también en la query: si el proxy descarta el body del DELETE,
  // el servidor aún lo recibe. El body se mantiene como respaldo.
  return api('DELETE', { productId }, `?productId=${encodeURIComponent(productId)}`);
}
