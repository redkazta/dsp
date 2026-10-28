/**
 * Wishlist por usuario.
 *
 * Regla de oro (y de privacidad):
 *
 *   ┌────────────┬────────────────────────────────────────────┐
 *   │ Sin sesión │ solo localStorage (`dsp_wishlist`)         │
 *   │ Con sesión │ solo servidor (`wishlist_items` vía API)   │
 *   └────────────┴────────────────────────────────────────────┘
 *
 * Al cerrar sesión **no** se copia la lista de la cuenta al navegador: si el
 * visitante no tenía favoritos propios, ve una lista vacía. Al iniciar sesión
 * sí se fusionan los favoritos guardados sin cuenta (y se borran del navegador
 * para no dejarlos duplicados).
 */

import type { WishlistItem } from './wishlist-local';
import {
  getLocalWishlist,
  isLocalWishlisted,
  removeLocalWishlist,
  toggleLocalWishlist,
} from './wishlist-local';
import {
  deleteWishlistRemote,
  fetchWishlist,
  mergeWishlist,
  toggleWishlistRemote,
} from './wishlist-api';
import {
  REMOTE_CHANGE_EVENT,
  broadcastWishlistChange,
  startWishlistSync,
  stopRealtime,
} from './wishlist-sync';

export type { WishlistItem };

/** Clave de localStorage: una sola fuente para leer y limpiar. */
export const LOCAL_WISHLIST_KEY = 'dsp_wishlist';

function emit(items: WishlistItem[]) {
  window.dispatchEvent(new CustomEvent('wishlist:updated', { detail: items }));
}

async function localItems(): Promise<WishlistItem[]> {
  return getLocalWishlist();
}

/** Lista actual según la sesión. Nunca mezcla las dos fuentes. */
export async function currentWishlist(isAuth: boolean): Promise<WishlistItem[]> {
  if (!isAuth) return localItems();

  try {
    return await fetchWishlist();
  } catch {
    return [];
  }
}

/**
 * ¿Hay sesión? El HTML del layout lo deja en `<html data-auth="1">`.
 * También se puede forzar con `setSessionState()` tras cerrar sesión sin
 * recargar la página.
 */
let sessionOverride: boolean | null = null;

export function setSessionState(isAuth: boolean) {
  sessionOverride = isAuth;
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.auth = isAuth ? '1' : '0';
  }
}

export async function hasSession(): Promise<boolean> {
  if (sessionOverride !== null) return sessionOverride;

  if (typeof document !== 'undefined' && document.documentElement.dataset.auth) {
    return document.documentElement.dataset.auth === '1';
  }

  const { getUser } = await import('./auth');
  return Boolean(await getUser());
}

// ---------------------------------------------------------------------------
// Tiempo real
// ---------------------------------------------------------------------------

let syncStarted = false;
let applyingRemote = false;

/**
 * Arranca la sincronización en vivo (canal entre pestañas + Realtime).
 * Idempotente: llamarlo en varias páginas no duplica canales.
 *
 * Invariante: aquí NO se emite `wishlist:added`/`wishlist:removed`, para
 * que un cambio hecho en otro dispositivo no dispare avisos flotantes que
 * el usuario no provocó en esta pantalla.
 */
async function ensureSync(): Promise<void> {
  if (syncStarted) return;
  syncStarted = true;

  const isAuth = await hasSession();
  startWishlistSync(isAuth);

  window.addEventListener(REMOTE_CHANGE_EVENT, async () => {
    // Una ráfaga de eventos (toggle + insert) solo provoca una relectura.
    if (applyingRemote) return;
    applyingRemote = true;
    try {
      emit(await currentWishlist(await hasSession()));
    } finally {
      applyingRemote = false;
    }
  });
}

/**
 * Arranque del cliente en cualquier página.
 *
 * - Visitante: pinta lo que tenga en el navegador.
 * - Usuario: pinta lo del servidor y, si venía de usar la tienda sin cuenta,
 *   fusiona esos favoritos y limpia el almacenamiento local.
 */
export async function initWishlistView(
  serverItems: WishlistItem[],
  opts: { isAuth: boolean }
): Promise<WishlistItem[]> {
  // A partir de aquí esta página escucha a las demás pestañas y dispositivos.
  void ensureSync();

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
    localStorage.removeItem(LOCAL_WISHLIST_KEY);
    emit(items);
    return items;
  } catch {
    emit(serverItems);
    return serverItems;
  }
}

/**
 * Evento disparado al cerrar sesión (`wishlist:session-ended`).
 * Lo usan el drawer y los botones de corazón para volver a modo visitante.
 */
export const SESSION_ENDED_EVENT = 'wishlist:session-ended';

/**
 * Se llama al cerrar sesión.
 *
 * Importante: NO copia los favoritos de la cuenta al navegador. Simplemente
 * vuelve a leer el almacenamiento local del visitante (normalmente vacío).
 */
export function endWishlistSession(): WishlistItem[] {
  const local = getLocalWishlist();

  // A partir de aquí la página se comporta como visitante sin recargar.
  setSessionState(false);
  stopRealtime();

  emit(local);
  window.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT, { detail: local }));
  return local;
}

/**
 * Agrega o quita. Devuelve true si quedó guardado.
 * Actualiza la lista y avisa con eventos (`wishlist:added` / `wishlist:removed`).
 */
export async function toggleWishlist(item: WishlistItem): Promise<boolean> {
  if (!(await hasSession())) {
    const active = toggleLocalWishlist(item);
    broadcastWishlistChange(getLocalWishlist().length);
    emit(await localItems());
    return active;
  }

  const { items, active } = await toggleWishlistRemote(item.productId);
  emit(items);
  broadcastWishlistChange(items.length);
  window.dispatchEvent(
    new CustomEvent(active ? 'wishlist:added' : 'wishlist:removed', {
      detail: { productId: item.productId, name: item.name },
    })
  );
  return Boolean(active);
}

export async function removeFromWishlist(productId: string, name = '') {
  if (!(await hasSession())) {
    // `removeLocalWishlist` ya emite `wishlist:removed` (rescatando el
    // nombre guardado si no llega) y `wishlist:updated`.
    removeLocalWishlist(productId, name);
    broadcastWishlistChange(getLocalWishlist().length);
    return;
  }

  const { items } = await deleteWishlistRemote(productId);
  emit(items);
  broadcastWishlistChange(items.length);

  // Igual que `toggleWishlist`: quien quita un favorito confirma con aviso.
  window.dispatchEvent(
    new CustomEvent('wishlist:removed', { detail: { productId, name } })
  );
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
