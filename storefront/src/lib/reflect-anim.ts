/**
 * Cuenta atrás del reflejo en las piezas reflectivas.
 *
 * Se apoya en el carrusel que ya tiene cada componente (hero, tarjetas,
 * ficha) y muestra "Reflectivo en… 2" → "1" → enciende la foto del flash,
 * espera un momento y vuelve a la portada para empezar otra vez.
 *
 * Contrato con el HTML:
 *
 * ```html
 * <div data-reflect data-reflect-flash="1" data-reflect-ms="2000">
 *   <span class="reflect-badge" data-reflect-badge data-label="Reflectivo">
 *     <span class="reflect-badge-text" data-reflect-text>Reflectivo</span>
 *   </span>
 *   … fotos ([data-carousel-dot] / [data-carousel-thumb]) …
 * </div>
 * ```
 *
 * - `data-reflect-flash` = índice de la foto con reflejo.
 * - `data-reflect-ms` = un segundo de la cuenta (por defecto 1000).
 * - Respeta `prefers-reduced-motion`: deja la foto del reflejo fija.
 */

// Los scripts de Astro comparten el scope del bundle: el IIFE evita
// colisiones con `carousel.ts`. Además el mismo módulo se importa desde
// varios componentes (hero, tarjetas, ficha): sin este candado se
// ejecutaba dos veces y cada copia abría su propio intervalo, alternando
// las fotos entre sí y dejando el badge encendido.
(() => {
  const FLAG = '__dspReflectAnim';
  const w = window as unknown as Record<string, boolean>;
  if (w[FLAG]) return;
  w[FLAG] = true;

  /** Un segundo de la cuenta atrás. */
  const DEFAULT_MS = 1000;

  /** Margen tras una interacción manual antes de retomar el ciclo. */
  const RESUME_MS = 6000;

  /** Cuánto se queda encendida la foto del reflejo antes de volver. */
  const HOLD_MS = 2200;

  /** Desde qué número arranca la cuenta. */
  const COUNT_FROM = 2;

  type ReflectScope = {
    root: HTMLElement;
    badge: HTMLElement | null;
    text: HTMLElement | null;
    /** Número del cuenta atrás (se crea una vez). */
    count: HTMLElement | null;
    label: string;
    /** Un segundo de la cuenta. */
    ms: number;
    /** Desde cuántos segundos arranca ("Reflectivo en… 3 · 2 · 1"). */
    seconds: number;
    flashIndex: number;
    plainIndex: number;
    /** Segundos que faltan para encender; 0 = reflejo encendido. */
    remaining: number;
    /** 1 = mostrando el reflejo, 0 = foto normal. */
    flipped: boolean;
    timer?: number;
  };

  const scopes = new Map<HTMLElement, ReflectScope>();

  function register(root: HTMLElement): ReflectScope | null {
    const existing = scopes.get(root);
    if (existing) return existing;

    const flashIndex = Number(root.dataset.reflectFlash);
    if (!Number.isInteger(flashIndex) || flashIndex < 0) return null;

    const plainRaw = Number(root.dataset.reflectPlain);
    const ms = Number(root.dataset.reflectMs);

    const badge = root.querySelector<HTMLElement>('[data-reflect-badge]');
    const text = badge?.querySelector<HTMLElement>('[data-reflect-text]') ?? null;

    const scope: ReflectScope = {
      root,
      badge,
      text,
      count: null,
      label: badge?.dataset.label ?? '',
      ms: Number.isFinite(ms) && ms > 0 ? ms : DEFAULT_MS,
      seconds: COUNT_FROM,
      flashIndex,
      plainIndex: Number.isInteger(plainRaw) && plainRaw >= 0 ? plainRaw : 0,
      remaining: 0,
      flipped: false,
    };

    scopes.set(root, scope);
    return scope;
  }

  /** Lleva el carrusel a la foto `index`. */
  function showPhoto(scope: ReflectScope, index: number) {
    const { root } = scope;

    // Solo controles que el carrusel ya escucha (`lib/carousel.ts`).
    const target = root.querySelector<HTMLElement>(
      `[data-carousel-dot="${index}"], [data-carousel-thumb="${index}"]`
    );

    if (target) {
      // Evita que el listener de abajo confunda este click con uno del usuario.
      (target as HTMLElement & { __reflectAuto?: boolean }).__reflectAuto = true;
      target.click();

      root.querySelectorAll<HTMLElement>('img').forEach((el) => {
        el.classList.remove('is-flash-photo');
      });

      if (index === scope.flashIndex) {
        root
          .querySelector<HTMLElement>(`.card-slide:nth-child(${index + 1}) img`)
          ?.classList.add('is-flash-photo');
      }
      return;
    }

    // Carruseles con control propio (hero): el componente escucha este evento.
    root.dispatchEvent(new CustomEvent('reflect:photo', { detail: { index }, bubbles: true }));
  }

  /**
   * Pinta el número del cuenta atrás.
   * `0` significa que el reflejo ya se encendió: ahí se quita el número.
   */
  function paintCount(scope: ReflectScope, value: number, animate = true) {
    const { badge, text, label } = scope;
    if (!badge || !text) return;

    if (value <= 0) {
      badge.classList.remove('is-counting');
      if (scope.count) scope.count.remove();
      scope.count = null;
      // El texto pasa a "Reflectivo" (sin "en…") mientras está encendido.
      if (label) text.textContent = label;
      return;
    }

    badge.classList.add('is-counting');

    // Crea el número la primera vez y lo reutiliza para no perder la animación.
    if (!scope.count) {
      // Texto base ("Reflectivo en…") + número que se actualiza después.
      text.textContent = '';
      const base = document.createElement('span');
      base.textContent = scope.label;

      scope.count = document.createElement('span');
      scope.count.className = 'reflect-badge-count';

      text.append(base, scope.count);
    }

    scope.count.textContent = String(value);

    if (animate) {
      scope.count.classList.remove('is-ticking');
      void scope.count.offsetWidth; // reinicia la animación en cada número
      scope.count.classList.add('is-ticking');
    }
  }

  /** Pone la pieza en su foto normal y reinicia la cuenta. */
  function reset(scope: ReflectScope, animate = false) {
    scope.flipped = false;
    scope.remaining = scope.seconds;
    scope.badge?.classList.remove('is-lit');
    showPhoto(scope, scope.plainIndex);
    paintCount(scope, scope.remaining, animate);
  }

  /**
   * ¿La pieza está en pantalla?
   *
   * Un rect en cero (imagen aún sin cargar, altura sin resolver, contenedor
   * oculto) NO significa "fuera de pantalla": antes se descartaba y el
   * carrusel nunca arrancaba. En ese caso se considera visible.
   */
  function onScreen(el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return true;
    if (rect.bottom === 0 && rect.top === 0) return true;
    return rect.bottom > 0 && rect.top < window.innerHeight;
  }

  /**
   * El ciclo solo se detiene si la pestaña está oculta.
   *
   * Antes también se pausaba con el hover, pero en escritorio el puntero
   * está sobre alguna tarjeta casi siempre: esa pieza nunca se encendía.
   * El reflejo dura 2 s y no impide leer, así que ya no frena por hover.
   */
  function busy() {
    return document.hidden;
  }

  /**
   * Ciclo: 2 → 1 → encendido → (espera) → vuelve a 2.
   *
   * El `setInterval` corre un tick por segundo y cada tick decide qué toca
   * según `remaining`; cuando el reflejo está encendido se pausa `HOLD_MS`.
   */
  function schedule(scope: ReflectScope) {
    window.clearInterval(scope.timer);

    scope.timer = window.setInterval(() => {
      if (busy() || !onScreen(scope.root)) return;

      // Reflejo encendido: aún no toca volver.
      if (scope.flipped) return;

      scope.remaining -= 1;
      paintCount(scope, scope.remaining);

      if (scope.remaining > 0) return;

      // Llegó a cero: se enciende la foto del reflejo.
      scope.flipped = true;
      scope.badge?.classList.add('is-lit');
      showPhoto(scope, scope.flashIndex);

      window.setTimeout(() => {
        if (busy()) return;
        reset(scope, true);
      }, HOLD_MS);
    }, scope.ms);
  }

  function init() {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    document.querySelectorAll<HTMLElement>('[data-reflect]').forEach((root) => {
      const scope = register(root);
      if (!scope) return;

      // Con movimiento reducido queda fija la toma con el reflejo encendido.
      if (reduce) {
        scope.flipped = true;
        scope.badge?.classList.add('is-lit');
        paintCount(scope, 0, false);
        showPhoto(scope, scope.flashIndex);
        return;
      }

      reset(scope, false);

      // `schedule` ya limpia el intervalo previo: un refresh no duplica.
      schedule(scope);
    });
  }

  // Cambio manual de foto: se detiene el ciclo unos segundos para no pelearse
  // con quien está mirando la prenda.
  document.addEventListener('click', (e) => {
    const target = e.target as (HTMLElement & { __reflectAuto?: boolean }) | null;
    if (!target?.closest('[data-reflect]')) return;
    if (!target.closest('[data-carousel-dir], [data-carousel-dot], [data-carousel-thumb]')) return;

    // El controlador también pulsa esos botones: no es el usuario.
    if (target.__reflectAuto) {
      target.__reflectAuto = false;
      return;
    }

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
