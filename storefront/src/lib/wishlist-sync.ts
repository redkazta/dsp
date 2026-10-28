/**
 * Sincronización de favoritos en tiempo real.
 *
 * Cubre los dos huecos que un `fetch` aislado no resuelve:
 *
 *   ┌────────────────────┬─────────────────────────────────────────────┐
 *   │ Otras pestañas del │ `BroadcastChannel` (+ `storage` como red de  │
 *   │ mismo navegador    │ seguridad entre pestañas)                    │
 *   │ Otros dispositivos │ Realtime de Supabase sobre `wishlist_items`, │
 *   │ con la misma cuenta│ protegido por RLS: solo llegan las del dueño │
 *   └────────────────────┴─────────────────────────────────────────────┘
 *
 * El módulo NO decide el estado: cuando llega un aviso, `wishlist.ts`
 * relee la fuente real (`currentWishlist()`) y emite `wishlist:updated`,
 * que es lo que ya escuchan la ficha, las tarjetas, `/favoritos` y el panel.
 *
 * El canal de Realtime solo se abre con sesión: un visitante nunca abre
 * WebSockets contra Supabase.
 */

/** Nombre del canal entre pestañas. */
const CHANNEL = 'dsp:wishlist';

/**
 * Evento interno: otra pestaña u otro dispositivo cambió la lista.
 * Lo consume `wishlist.ts`, no los componentes.
 */
export const REMOTE_CHANGE_EVENT = 'wishlist:remote-change';

type RealtimeHandle = {
  disconnect: () => void;
};

let channel: BroadcastChannel | null = null;
let realtime: RealtimeHandle | null = null;
let bound = false;

/**
 * El cliente de Supabase se carga solo cuando hay sesión real.
 * Así el módulo se puede importar en entornos sin navegador (SSR, tests)
 * sin arrastrar `@supabase/ssr`.
 */
async function getClient() {
  const { supabase } = await import('./supabase');
  return supabase;
}

function emitRemoteChange(source: 'broadcast' | 'storage' | 'realtime') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(REMOTE_CHANGE_EVENT, { detail: { source } }));
}

/** Abre el canal entre pestañas y la escucha de `storage` (idempotente). */
function openBroadcast() {
  if (typeof window === 'undefined' || channel) return;

  if (typeof window.BroadcastChannel !== 'undefined') {
    channel = new window.BroadcastChannel(CHANNEL);
    channel.onmessage = (e) => {
      // `from` evita reaccionar a lo que uno mismo acaba de escribir.
      if (e.data?.from && e.data.from === window.__dspWishlistTab) return;
      emitRemoteChange('broadcast');
    };
  }

  // `storage` no depende de que la otra pestaña tenga el canal abierto.
  window.addEventListener('storage', (e) => {
    if (e.key === 'dsp_wishlist' || e.key === 'dsp_wishlist_sync') {
      emitRemoteChange('storage');
    }
  });
}

/**
 * Arranca la sincronización una sola vez por página.
 * @param isAuth si hay sesión, además se abre Realtime.
 */
export function startWishlistSync(isAuth: boolean): void {
  if (typeof window === 'undefined') return;

  // Identificador de esta pestaña (para no rebotar los propios avisos).
  window.__dspWishlistTab ??=
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `tab-${Math.random().toString(36).slice(2)}`;

  if (!bound) {
    bound = true;
    openBroadcast();
  }

  if (isAuth) void startRealtime();
  else stopRealtime();
}

/**
 * Avisa a las demás pestañas de que la lista cambió aquí.
 * Se llama tras cualquier mutación (local o contra el API).
 */
export function broadcastWishlistChange(count: number): void {
  if (typeof window === 'undefined') return;

  channel?.postMessage({ type: 'changed', from: window.__dspWishlistTab });

  // `storage` no se dispara en la pestaña que escribe: llega a las demás.
  try {
    localStorage.setItem(
      'dsp_wishlist_sync',
      JSON.stringify({ at: Date.now(), n: count })
    );
  } catch {
    /* modo privado restrictivo: el canal ya avisó */
  }
}

/** Abre el canal de Realtime del usuario actual (idempotente). */
async function startRealtime(): Promise<void> {
  if (typeof window === 'undefined' || realtime) return;

  try {
    const supabase = await getClient();
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return;

    const handle = supabase
      .channel(`wishlist:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wishlist_items',
          filter: `user_id=eq.${userId}`,
        },
        () => emitRemoteChange('realtime')
      )
      .subscribe();

    realtime = {
      disconnect: () => {
        void supabase.removeChannel(handle);
      },
    };
  } catch {
    // Sin Realtime (RLS, red o config): quedan el canal local y el focus.
    realtime = null;
  }
}

/** Cierra el canal de Realtime (al cerrar sesión). */
export function stopRealtime(): void {
  if (!realtime) return;
  realtime.disconnect();
  realtime = null;
}

/** Solo para pruebas: deja el módulo como recién cargado. */
export function __resetWishlistSync(): void {
  channel?.close();
  channel = null;
  stopRealtime();
  bound = false;
}
