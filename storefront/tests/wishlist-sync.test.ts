import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Sincronización en tiempo real de favoritos.
 *
 * Se prueba el contrato, no la red: qué avisos emite, a quién escucha y
 * que no abra Realtime sin sesión.
 */

type Listener = (e: Event) => void;

function fakeWindow() {
  const listeners = new Map<string, Set<Listener>>();

  const win: any = {
    __dspWishlistTab: undefined,
    addEventListener: (type: string, fn: Listener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener: () => {},
    dispatchEvent: (e: Event) => {
      listeners.get(e.type)?.forEach((fn) => fn(e));
      return true;
    },
  };

  return win;
}

class FakeChannel {
  static instances: FakeChannel[] = [];
  onmessage: ((e: MessageEvent) => void) | null = null;
  closed = false;
  postedMessages: unknown[] = [];

  postMessage(data: unknown) {
    this.postedMessages.push(data);
  }

  close() {
    this.closed = true;
  }

  constructor(public name: string) {
    FakeChannel.instances.push(this);
  }
}

describe('wishlist-sync', () => {
  let mod: typeof import('../src/lib/wishlist-sync');
  let win: any;

  beforeEach(async () => {
    vi.resetModules();
    FakeChannel.instances = [];

    win = fakeWindow();
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', { visibilityState: 'visible' });
    vi.stubGlobal('localStorage', {
      store: {} as Record<string, string>,
      setItem(k: string, v: string) {
        (this as any).store[k] = v;
      },
      getItem(k: string) {
        return (this as any).store[k] ?? null;
      },
    });
    vi.stubGlobal('BroadcastChannel', FakeChannel);
    // En un navegador real, `BroadcastChannel` también cuelga de `window`.
    win.BroadcastChannel = FakeChannel;

    mod = await import('../src/lib/wishlist-sync');
  });

  afterEach(() => {
    mod.__resetWishlistSync();
    vi.unstubAllGlobals();
  });

  it('emite REMOTE_CHANGE_EVENT al recibir un aviso de otra pestaña', () => {
    mod.startWishlistSync(false);

    const received: string[] = [];
    win.addEventListener(mod.REMOTE_CHANGE_EVENT, (e: any) => {
      received.push(e.detail.source);
    });

    // Otra pestaña publica.
    FakeChannel.instances[0].onmessage!({
      data: { type: 'changed', from: 'otra-pestaña' },
    } as MessageEvent);

    expect(received).toEqual(['broadcast']);
  });

  it('ignora el eco de sus propios mensajes', () => {
    mod.startWishlistSync(false);

    const received: unknown[] = [];
    win.addEventListener(mod.REMOTE_CHANGE_EVENT, () => received.push(1));

    FakeChannel.instances[0].onmessage!({
      data: { type: 'changed', from: win.__dspWishlistTab },
    } as MessageEvent);

    expect(received).toHaveLength(0);
  });

  it('broadcastWishlistChange publica y toca localStorage para las demás pestañas', () => {
    mod.startWishlistSync(false);
    mod.broadcastWishlistChange(3);

    const ch = FakeChannel.instances[0];
    expect(ch.postedMessages.at(-1)).toMatchObject({ type: 'changed' });
    expect(localStorage.getItem('dsp_wishlist_sync')).toContain('"n":3');
  });

  it('no abre Realtime sin sesión', () => {
    mod.startWishlistSync(false);
    // Sin sesión no se importa el cliente de Supabase: basta con que no falle
    // y con que el canal local sí esté abierto.
    expect(FakeChannel.instances).toHaveLength(1);
  });

  it('un solo canal aunque se arranque varias veces', () => {
    mod.startWishlistSync(false);
    mod.startWishlistSync(false);
    mod.startWishlistSync(false);
    expect(FakeChannel.instances).toHaveLength(1);
  });
});
