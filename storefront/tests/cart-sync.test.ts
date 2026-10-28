import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Sincronización del carrito entre pestañas.
 *
 * El carrito es local (localStorage), así que "tiempo real" aquí significa
 * `BroadcastChannel` + evento `storage`. Se fija el contrato:
 *  - una mutación avisa a las demás pestañas,
 *  - `cart:updated` refleja lo que hay en localStorage, no una copia vieja,
 *  - no hay aviso flotante falso para cambios remotos (`takeLastAdded` vacío).
 */

class FakeChannel {
  static instances: FakeChannel[] = [];
  onmessage: ((e: MessageEvent) => void) | null = null;
  posted: unknown[] = [];
  constructor(public name: string) {
    FakeChannel.instances.push(this);
  }
  postMessage(data: unknown) {
    this.posted.push(data);
  }
}

function makeWindow() {
  const listeners = new Map<string, Set<(e: any) => void>>();
  const win: any = {
    BroadcastChannel: FakeChannel,
    addEventListener(type: string, fn: (e: any) => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    dispatchEvent(e: any) {
      listeners.get(e.type)?.forEach((fn) => fn(e));
      return true;
    },
  };
  return win;
}

describe('cart: sincronización entre pestañas', () => {
  let win: any;
  let store: Record<string, string>;
  let cart: typeof import('../src/lib/cart');

  beforeEach(async () => {
    vi.resetModules();
    FakeChannel.instances = [];
    store = {};

    win = makeWindow();
    vi.stubGlobal('window', win);
    vi.stubGlobal('localStorage', {
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      getItem: (k: string) => store[k] ?? null,
      removeItem: (k: string) => {
        delete store[k];
      },
    });
    vi.stubGlobal('crypto', { randomUUID: () => 'tab-a' });

    cart = await import('../src/lib/cart');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const item = (variantId: string) => ({
    variantId,
    productId: 'p1',
    name: 'Camisa',
    variantName: 'M',
    price: 100,
    qty: 1,
  });

  it('abre un solo canal aunque se arranque varias veces', () => {
    cart.startCartSync();
    cart.startCartSync();
    cart.startCartSync();
    expect(FakeChannel.instances).toHaveLength(1);
    expect(FakeChannel.instances[0].name).toBe('dsp:cart');
  });

  it('añadir avisa a las demás pestañas y emite cart:updated', () => {
    cart.startCartSync();

    const received: unknown[] = [];
    win.addEventListener('cart:updated', (e: any) => received.push(e.detail));

    cart.addToCart(item('v1') as any);

    expect(FakeChannel.instances[0].posted.at(-1)).toMatchObject({ type: 'changed' });
    expect(received).toHaveLength(1);
    expect((received[0] as any[])[0].variantId).toBe('v1');
  });

  it('un aviso de otra pestaña repinta con la lista real de localStorage', () => {
    cart.startCartSync();

    // Otra pestaña escribió directamente en el almacenamiento.
    store['dsp_cart'] = JSON.stringify([{ ...item('v9'), qty: 4 }]);

    const received: any[] = [];
    win.addEventListener('cart:updated', (e: any) => received.push(e.detail));

    FakeChannel.instances[0].onmessage!({
      data: { type: 'changed', from: 'otra-pestana' },
    } as MessageEvent);

    expect(received).toHaveLength(1);
    expect(received[0][0].qty).toBe(4);
  });

  it('ignora el eco de sus propios mensajes', () => {
    cart.startCartSync();

    const received: unknown[] = [];
    win.addEventListener('cart:updated', (e: any) => received.push(e.detail));

    FakeChannel.instances[0].onmessage!({
      data: { type: 'changed', from: 'tab-a' },
    } as MessageEvent);

    expect(received).toHaveLength(0);
  });

  it('un cambio remoto no deja un "producto añadido" pendiente', () => {
    cart.startCartSync();

    store['dsp_cart'] = JSON.stringify([{ ...item('v9'), qty: 2 }]);
    FakeChannel.instances[0].onmessage!({
      data: { type: 'changed', from: 'otra-pestana' },
    } as MessageEvent);

    // `StoreDrawer` usa esto para decidir si muestra el aviso flotante.
    expect(cart.takeLastAdded()).toBeNull();
  });

  it('saveCart emite la lista leída del almacenamiento, no la copia recibida', () => {
    cart.startCartSync();

    const received: any[] = [];
    win.addEventListener('cart:updated', (e: any) => received.push(e.detail));

    // Se guarda algo y el almacenamiento manda.
    cart.saveCart([item('v1') as any]);
    expect(received.at(-1)[0].variantId).toBe('v1');
  });
});
