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
 * <div data-reflect data-reflect-flash="1" data-reflect-ms="1000">
 *   <span class="reflect-badge" data-reflect-badge data-label="Reflectivo en…">
 *     <span class="reflect-badge-label" data-reflect-label>Reflectivo en…</span>
 *     <span class="reflect-badge-dot"></span>
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

  /**
   * Cuánto se queda encendida la foto del reflejo.
   *
   * Cuenta + encendido = 2 s + 2.5 s = 4.5 s, que es justo el intervalo
   * del carrusel (`DEFAULT_INTERVAL` en `carousel.ts`). Así el reflejo se
   * apaga justo cuando el carrusel pasa a la siguiente pieza, en vez de
   * derivar y desincronizarse.
   */
  const HOLD_MS = 2500;

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
    /** Ticks que le quedan al reflejo encendido antes de volver. */
    holdLeft: number;
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
    const text = badge?.querySelector<HTMLElement>('[data-reflect-label]') ?? null;

    // El número viene ya en el HTML (evita el salto al hidratar).
    const count = badge?.querySelector<HTMLElement>('[data-reflect-count]') ?? null;

    const scope: ReflectScope = {
      root,
      badge,
      text,
      count,
      label: badge?.dataset.label ?? '',
      ms: Number.isFinite(ms) && ms > 0 ? ms : DEFAULT_MS,
      seconds: COUNT_FROM,
      flashIndex,
      plainIndex: Number.isInteger(plainRaw) && plainRaw >= 0 ? plainRaw : 0,
      remaining: 0,
      holdLeft: 0,
      flipped: false,
    };

    scopes.set(root, scope);
    return scope;
  }

  /**
   * Detiene el avance automático del carrusel mientras el reflejo cambia la
   * foto. Sin esto, `carousel.ts` y el hero movían el carrusel por debajo y
   * el reflejo aterrizaba en la foto equivocada.
   */
  function holdCarousel(scope: ReflectScope, hold: boolean) {
    const event = hold ? 'carousel:pause' : 'carousel:resume';

    // El carrusel del catálogo escucha el evento con el scope como detalle.
    scope.root.dispatchEvent(
      new CustomEvent(event, { bubbles: true, detail: scope.root })
    );

    // El hero tiene su propio avance (`hero:pause` / `hero:resume`).
    scope.root.dispatchEvent(
      new CustomEvent(hold ? 'hero:pause' : 'hero:resume', { bubbles: true })
    );
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
   * Pinta el cuenta atrás. La estructura es siempre la misma:
   *
   *   Reflectivo en…        ← etiqueta
   *         2               ← número
   *
   * El número NO se quita al encenderse: el badge se ve igual en los tres
   * estados (2 → 1 → encendido), solo cambia el color. Antes el número
   * desaparecía al llegar a cero y el badge quedaba más bajo, lo que hacía
   * que "Reflectivo" se viera distinto.
   */
  function paintCount(scope: ReflectScope, value: number, animate = true) {
    const { badge, text } = scope;
    if (!badge || !text) return;

    badge.classList.add('is-counting');
    text.textContent = scope.label;

    // El número viene del HTML; si no está (favoritos, carrito) se crea.
    if (!scope.count) {
      scope.count = document.createElement('span');
      scope.count.className = 'reflect-badge-count';
      scope.count.dataset.reflectCount = '';
      badge.insertBefore(scope.count, badge.querySelector('.reflect-badge-dot'));
    }

    const seconds = value > 0 ? value : scope.seconds;
    if (scope.count.textContent !== String(seconds)) {
      scope.count.textContent = String(seconds);

      if (animate) {
        scope.count.classList.remove('is-ticking');
        void scope.count.offsetWidth; // reinicia la animación en cada número
        scope.count.classList.add('is-ticking');
      }
    }
  }

  /** Pone la pieza en su foto normal y reinicia la cuenta. */
  function reset(scope: ReflectScope, animate = false) {
    scope.flipped = false;
    scope.remaining = scope.seconds;
    scope.badge?.classList.remove('is-lit');
    showPhoto(scope, scope.plainIndex);
    paintCount(scope, scope.remaining, animate);
    // El carrusel recupera su avance automático.
    holdCarousel(scope, false);
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
   * Ciclo cerrado, una sola fase activa a la vez:
   *
   *   t=0   "Reflectivo en… 2"   (foto normal)
   *   t=1s  "Reflectivo en… 1"   (foto normal)
   *   t=2s  ENCENDIDO            (foto con flash, badge dorado)
   *   t=4.2s vuelve a t=0
   *
   * Antes el número se repintaba al arrancar y el primer tick lo bajaba
   * enseguida: se veía un "2" suelto al encenderse y otro al reiniciar.
   * Ahora cada fase dura `ms` y el encendido espera `HOLD_MS`.
   */
  function schedule(scope: ReflectScope) {
    window.clearInterval(scope.timer);

    scope.timer = window.setInterval(() => {
      if (busy() || !onScreen(scope.root)) return;

      // Mientras el usuario interactúa con el carrusel no se le encima.
      if (scope.root.dataset.reflectUserHold) return;

      // 1) Está encendido: ya cumplió su tiempo, vuelve a la portada.
      if (scope.flipped) {
        scope.holdLeft -= 1;
        if (scope.holdLeft > 0) return;

        reset(scope, false);
        return;
      }

      // 2) Cuenta atrás: 2 → 1 → (encender en el siguiente paso).
      scope.remaining -= 1;

      if (scope.remaining > 0) {
        paintCount(scope, scope.remaining);
        return;
      }

      // 3) Llegó a cero: se enciende la foto del reflejo y el carrusel se
      //    queda quieto para que el encendido se vea completo.
      scope.flipped = true;
      scope.holdLeft = Math.max(1, Math.round(HOLD_MS / scope.ms));

      holdCarousel(scope, true);
      scope.badge?.classList.add('is-lit');
      showPhoto(scope, scope.flashIndex);
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
        paintCount(scope, scope.seconds, false);
        showPhoto(scope, scope.flashIndex);
        return;
      }

      reset(scope, false);

      // `schedule` ya limpia el intervalo previo: un refresh no duplica.
      schedule(scope);
    });
  }

  /**
   * El carrusel cambió de foto (autoplay, flecha o dedo).
   *
   * Se reinicia la cuenta en ese instante para que el reflejo arranque
   * alineado con el movimiento y no con su propio reloj: antes ambos ciclos
   * tenían periodos distintos y se iban separando poco a poco.
   */
  document.addEventListener('carousel:changed', (e) => {
    const scopeEl = (e.target as HTMLElement | null)?.closest?.('[data-carousel-scope]');
    if (!scopeEl) return;

    scopes.forEach((scope, root) => {
      if (!scopeEl.contains(root) && !root.contains(scopeEl)) return;
      if (scope.flipped) return; // no cortar un encendido en curso
      reset(scope, false);
    });
  });

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
