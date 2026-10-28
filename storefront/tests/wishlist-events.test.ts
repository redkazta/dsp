import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Contrato de los eventos de favoritos.
 *
 * Todos los avisos flotantes (`lib/flash-toast.ts`) cuelgan de
 * `wishlist:added` / `wishlist:removed` (ver `StoreDrawer`). Si una
 * función de mutación no emite su evento, el usuario quita un favorito y
 * no ve ninguna confirmación — que es exactamente el bug que había:
 * `removeFromWishlist` no emitía nada y solo `toggleWishlist` lo hacía.
 */

function fakeWindow() {
  const listeners = new Map<string, Set<(e: any) => void>>();
  const store: Record<string, string> = {};

  const win: any = {
    addEventListener(type: string, fn: (e: any) => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    dispatchEvent(e: any) {
      listeners.get(e.type)?.forEach((fn) => fn(e));
      return true;
    },
    __events: [] as any[],
  };

  // Se registran todos los eventos emitidos para poder afirmar sobre ellos.
  const original = win.dispatchEvent;
  win.dispatchEvent = (e: any) => {
    win.__events.push({ type: e.type, detail: e.detail });
    return original(e);
  };

  return { win, store };
}

describe('eventos de favoritos', () => {
  let win: any;
  let store: Record<string, string>;
  let wishlist: typeof import('../src/lib/wishlist');

  beforeEach(async () => {
    vi.resetModules();
    const ctx = fakeWindow();
    win = ctx.win;
    store = ctx.store;

    vi.stubGlobal('window', win);
    vi.stubGlobal('document', {
      documentElement: { dataset: { auth: '0' } },
      visibilityState: 'visible',
    });
    vi.stubGlobal('localStorage', {
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      getItem: (k: string) => store[k] ?? null,
      removeItem: (k: string) => {
        delete store[k];
      },
    });

    wishlist = await import('../src/lib/wishlist');
    wishlist.setSessionState(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const item = {
    productId: 'p-1',
    slug: 'camisa',
    name: 'Camisa D$P!',
    price: 100,
    image: null,
  };

  it('toggleWishlist emite wishlist:added al guardar', async () => {
    const active = await wishlist.toggleWishlist(item);
    expect(active).toBe(true);

    const added = win.__events.find((e: any) => e.type === 'wishlist:added');
    expect(added).toBeTruthy();
    expect(added.detail).toMatchObject({ productId: 'p-1', name: 'Camisa D$P!' });
  });

  it('removeFromWishlist SÍ emite wishlist:removed con el nombre', async () => {
    await wishlist.toggleWishlist(item);
    win.__events.length = 0;

    await wishlist.removeFromWishlist('p-1', 'Camisa D$P!');

    const removed = win.__events.find((e: any) => e.type === 'wishlist:removed');
    expect(removed).toBeTruthy();
    expect(removed.detail).toMatchObject({ productId: 'p-1', name: 'Camisa D$P!' });
  });

  it('removeFromWishlist sin nombre rescata el nombre guardado', async () => {
    await wishlist.toggleWishlist(item);
    win.__events.length = 0;

    await wishlist.removeFromWishlist('p-1');

    const removed = win.__events.find((e: any) => e.type === 'wishlist:removed');
    expect(removed).toBeTruthy();
    // El aviso puede mostrar el detalle aunque el llamador no lo pase.
    expect(removed.detail.name).toBe('Camisa D$P!');
  });

  it('el favorito desaparece de la lista tras quitarlo', async () => {
    await wishlist.toggleWishlist(item);
    await wishlist.removeFromWishlist('p-1', 'Camisa D$P!');

    expect(await wishlist.isInWishlist('p-1')).toBe(false);
  });
});
