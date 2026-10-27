/**
 * Animación del reflejo en las piezas reflectivas.
 *
 * No es un carrusel propio: se apoya en el que ya tiene cada componente
 * (hero, tarjetas del catálogo, galería de la ficha) y solo alterna entre la
 * foto normal y la del flash cada 2 segundos.
 *
 * Contrato con el HTML:
 *
 * ```html
 * <div data-reflect data-reflect-flash="1" data-reflect-ms="2000">
 *   … fotos [data-reflect-target="0"] / [data-reflect-target="1"] …
 * </div>
 * ```
 *
 * - `data-reflect-flash` = índice de la foto con reflejo (la que se "enciende").
 * - El cambio se hace pulsando el botón `[data-reflect-target="N"]` (o el
 *   `[data-carousel-thumb]` / `[data-carousel-dot]` con ese índice). Así
 *   flechas, puntos y miniaturas siguen sincronizados sin duplicar lógica.
 * - Se pausa en hover (desktop), con el foco de teclado, en pestañas ocultas
 *   y cuando la pieza sale de pantalla.
 * - Respeta `prefers-reduced-motion`.
 */

// Los scripts de Astro comparten el scope del bundle: el IIFE evita
// colisiones con `carousel.ts` (mismo `focused`, `scopes`…).
(() => {
  const DEFAULT_MS = 2000;

  /** Margen tras una interacción manual antes de retomar el ciclo. */
  const RESUME_MS = 6000;

  type ReflectScope = {
    root: HTMLElement;
    ms: number;
    flashIndex: number;
    plainIndex: number;
    /** 1 = mostrando el reflejo, 0 = foto normal. */
    flipped: boolean;
    timer?: number;
  };

  const scopes = new Map<HTMLElement, ReflectScope>();
  let hoverCount = 0;
  let focused = false;

  function register(root: HTMLElement): ReflectScope | null {
    const existing = scopes.get(root);
    if (existing) return existing;

    const flashIndex = Number(root.dataset.reflectFlash);
    if (!Number.isInteger(flashIndex) || flashIndex < 0) return null;

    const plainRaw = Number(root.dataset.reflectPlain);
    const ms = Number(root.dataset.reflectMs);

    const scope: ReflectScope = {
      root,
      ms: Number.isFinite(ms) && ms > 0 ? ms : DEFAULT_MS,
      flashIndex,
      plainIndex: Number.isInteger(plainRaw) && plainRaw >= 0 ? plainRaw : 0,
      flipped: false,
    };

    scopes.set(root, scope);
    return scope;
  }

  /** Lleva el carrusel a la foto `index`. */
  function showPhoto(scope: ReflectScope, index: number) {
    const { root } = scope;

    const target = root.querySelector<HTMLElement>(
      `[data-reflect-target="${index}"], [data-carousel-thumb="${index}"], [data-carousel-dot="${index}"]`
    );

    if (target) {
      target.click();
      return;
    }

    // Carruseles con control propio (hero): el componente escucha este evento.
    root.dispatchEvent(new CustomEvent('reflect:photo', { detail: { index }, bubbles: true }));
  }

  function onScreen(el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < window.innerHeight;
  }

  function busy() {
    return focused || hoverCount > 0 || document.hidden;
  }

  function schedule(scope: ReflectScope) {
    window.clearInterval(scope.timer);

    scope.timer = window.setInterval(() => {
      if (busy() || !onScreen(scope.root)) return;

      scope.flipped = !scope.flipped;
      scope.root.dataset.reflectState = scope.flipped ? 'on' : 'off';

      showPhoto(scope, scope.flipped ? scope.flashIndex : scope.plainIndex);
    }, scope.ms);
  }

  function init() {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    document.querySelectorAll<HTMLElement>('[data-reflect]').forEach((root) => {
      const scope = register(root);
      if (!scope) return;

      // Con movimiento reducido queda fija la toma con el reflejo encendido.
      if (reduce) {
        root.dataset.reflectState = 'on';
        showPhoto(scope, scope.flashIndex);
        return;
      }

      schedule(scope);
    });
  }

  // ---------- Interacción ----------
  document.addEventListener(
    'pointerenter',
    (e) => {
      if ((e.target as HTMLElement | null)?.closest('[data-reflect]')) hoverCount++;
    },
    true
  );

  document.addEventListener(
    'pointerleave',
    (e) => {
      if ((e.target as HTMLElement | null)?.closest('[data-reflect]')) {
        hoverCount = Math.max(0, hoverCount - 1);
      }
    },
    true
  );

  document.addEventListener('focusin', (e) => {
    if ((e.target as HTMLElement | null)?.closest('[data-reflect]')) focused = true;
  });

  document.addEventListener('focusout', () => {
    focused = false;
  });

  // Cambio manual de foto: se detiene el ciclo unos segundos para no pelearse
  // con quien está mirando la prenda.
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    if (!target?.closest('[data-reflect]')) return;
    if (!target.closest('[data-carousel-dir], [data-carousel-dot], [data-carousel-thumb]')) return;

    document.querySelectorAll<HTMLElement>('[data-reflect]').forEach((root) => {
      const scope = scopes.get(root);
      if (!scope) return;

      window.clearInterval(scope.timer);
      window.setTimeout(() => schedule(scope), RESUME_MS);
    });
  });

  // La página se repinta a veces (drawer, filtros): se registran los nuevos.
  document.addEventListener('reflect:refresh', init);

  init();
})();
