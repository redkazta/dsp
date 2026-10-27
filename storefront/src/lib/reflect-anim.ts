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
// colisiones con `carousel.ts`. Además el mismo módulo se importa desde
// varios componentes (hero, tarjetas, ficha): sin este candado se
// ejecutaba dos veces y cada copia abría su propio intervalo, alternando
// las fotos entre sí y dejando el badge encendido.
(() => {
  const FLAG = '__dspReflectAnim';
  const w = window as unknown as Record<string, boolean>;
  if (w[FLAG]) return;
  w[FLAG] = true;

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

    // Solo controles que el carrusel ya escucha (`lib/carousel.ts`).
    // Un botón inventado no dispara nada.
    const target = root.querySelector<HTMLElement>(
      `[data-carousel-dot="${index}"], [data-carousel-thumb="${index}"]`
    );

    if (target) {
      // `programmatic` evita que el listener de abajo confunda este click
      // con uno del usuario y detenga el ciclo.
      (target as HTMLElement & { __reflectAuto?: boolean }).__reflectAuto = true;
      target.click();

      // El CSS scoped no puede leer `[data-reflect-state]` (lo pone el JS),
      // así que el destello va con una clase en la foto visible.
      root.querySelectorAll<HTMLElement>('img, .reflect-badge').forEach((el) => {
        el.classList.remove('is-flash-photo', 'is-lit');
      });

      if (index === scope.flashIndex) {
        const photo = root.querySelector<HTMLElement>(
          `.card-slide:nth-child(${index + 1}) img`
        );
        photo?.classList.add('is-flash-photo');
        root.querySelector('.reflect-badge')?.classList.add('is-lit');
      }
      return;
    }

    // Carruseles con control propio (hero): el componente escucha este evento.
    root.dispatchEvent(new CustomEvent('reflect:photo', { detail: { index }, bubbles: true }));
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

  function schedule(scope: ReflectScope) {
    window.clearInterval(scope.timer);

    scope.timer = window.setInterval(() => {
      if (busy() || !onScreen(scope.root)) return;

      scope.flipped = !scope.flipped;
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
        showPhoto(scope, scope.flashIndex);
        return;
      }

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
