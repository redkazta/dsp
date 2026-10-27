/**
 * Ciclo del reflejo: el badge **es** el cronómetro de la pieza.
 *
 *   Reflectivo en: 2      foto sin flash
 *   Reflectivo en: 1      foto sin flash
 *              ↓
 *   Normal en: 2          foto con flash
 *   Normal en: 1          foto con flash
 *              ↓
 *   …y vuelve a empezar
 *
 * No hay un segundo reloj: este ciclo también decide cuándo pasa el
 * carrusel a la siguiente pieza (`rotates: true`), así que badge y
 * movimiento nunca se desincronizan.
 *
 * Contrato con el HTML:
 *
 * ```html
 * <div data-reflect data-reflect-flash="1" data-reflect-rotates>
 *   <span class="reflect-badge" data-reflect-badge>
 *     <span class="reflect-badge-label" data-reflect-label>Reflectivo en:</span>
 *   </span>
 *   … fotos ([data-carousel-thumb] / [data-hero-photo]) …
 * </div>
 * ```
 *
 * - `data-reflect-flash` = índice de la foto con reflejo.
 * - `data-reflect-rotates` = al cerrar la fase, avisa para pasar de pieza.
 */
import { COUNT_FROM, RESUME_MS } from './reflect-timing';
import { onTick, sync } from './reflect-clock';

(() => {
  const FLAG = '__dspReflectAnim';
  const w = window as unknown as Record<string, boolean>;
  if (w[FLAG]) return;
  w[FLAG] = true;

  /** Las dos etiquetas del ciclo. */
  type Phase = 'reflect' | 'normal';

  type ReflectScope = {
    root: HTMLElement;
    badge: HTMLElement | null;
    text: HTMLElement | null;
    count: HTMLElement | null;
    /** Textos: "Reflectivo en:" y "Normal en:". */
    labelReflect: string;
    labelNormal: string;
    flashIndex: number;
    plainIndex: number;
    /** Fase actual del ciclo. */
    phase: Phase;
    /** Número que se está mostrando. */
    remaining: number;
    /** Si al cerrar la fase avisa al carrusel para pasar de pieza. */
    rotates: boolean;
    /** Cancela la suscripción al reloj compartido. */
    unsubscribe?: () => void;
  };

  const scopes = new Map<HTMLElement, ReflectScope>();

  /**
   * `true` mientras el propio ciclo cambia la foto.
   * Evita que ese cambio se confunda con el usuario o con un avance ajeno.
   */
  let settling = false;

  function register(root: HTMLElement): ReflectScope | null {
    const existing = scopes.get(root);
    if (existing) return existing;

    const flashIndex = Number(root.dataset.reflectFlash);
    if (!Number.isInteger(flashIndex) || flashIndex < 0) return null;

    const plainRaw = Number(root.dataset.reflectPlain);
    const badge = root.querySelector<HTMLElement>('[data-reflect-badge]');

    const scope: ReflectScope = {
      root,
      badge,
      text: badge?.querySelector<HTMLElement>('[data-reflect-label]') ?? null,
      count: badge?.querySelector<HTMLElement>('[data-reflect-count]') ?? null,
      labelReflect: badge?.dataset.label ?? 'Reflectivo en:',
      labelNormal: badge?.dataset.labelNormal ?? 'Normal en:',
      flashIndex,
      plainIndex: Number.isInteger(plainRaw) && plainRaw >= 0 ? plainRaw : 0,
      phase: 'reflect',
      remaining: COUNT_FROM,
      rotates: root.hasAttribute('data-reflect-rotates'),
    };

    scopes.set(root, scope);
    return scope;
  }

  /** Cambia la foto **dentro de la pieza**. */
  function showPhoto(scope: ReflectScope, index: number) {
    // El click del thumb vuelve a entrar aquí: se corta la recursión.
    if (settling) return;

    const { root } = scope;

    // Hero: las fotos están apiladas en el propio `.hero-media`.
    const stacked = [...root.querySelectorAll<HTMLElement>('[data-hero-photo]')];
    if (stacked.length > 1) {
      stacked.forEach((photo, i) => photo.classList.toggle('is-active', i === index));
      root.classList.toggle('is-flash-photo', index === scope.flashIndex);
      return;
    }

    // Tarjetas y ficha: se pulsa el control del carrusel (misma pieza).
    //
    // Hay dos formas según el componente: miniaturas (`data-carousel-thumb`)
    // en la ficha, y puntos (`data-carousel-dot`) en las tarjetas. Antes solo
    // se buscaban miniaturas, así que **en /tienda no había ningún control que
    // pulsar y las fotos nunca cambiaban**.
    //
    // Además, en la ficha el badge vive en `.pdp-reflect`, fuera del track:
    // sus controles son hermanos y hay que buscarlos en el carrusel que lo
    // envuelve.
    const host = root.closest<HTMLElement>('[data-carousel-scope]') ?? root;

    const findControl = (sel: string) =>
      root.querySelector<HTMLElement>(sel) ?? host.querySelector<HTMLElement>(sel);

    const control =
      findControl(`[data-carousel-thumb="${index}"]`) ??
      findControl(`[data-carousel-dot="${index}"]`) ??
      findControl(`[data-carousel-dir="${Number(index) === 0 ? '-1' : '1'}"]`);

    if (control) {
      (control as HTMLElement & { __reflectAuto?: boolean }).__reflectAuto = true;
      settling = true;

      try {
        control.click();
      } finally {
        window.setTimeout(() => {
          settling = false;
        }, 0);
      }

      host.querySelectorAll<HTMLElement>('img').forEach((el) => {
        el.classList.remove('is-flash-photo');
      });

      if (index === scope.flashIndex) {
        host
          .querySelector<HTMLElement>(
            `.card-slide:nth-child(${index + 1}) img, .pdp-slide:nth-child(${index + 1}) img`
          )
          ?.classList.add('is-flash-photo');
      }
    }
  }

  /** Pinta etiqueta, número y estado del badge. */
  function paint(scope: ReflectScope, animate = true) {
    const { badge, text } = scope;
    if (!badge || !text) return;

    const reflecting = scope.phase === 'reflect';

    badge.classList.toggle('is-lit', reflecting);
    text.textContent = reflecting ? scope.labelReflect : scope.labelNormal;

    if (scope.count) {
      const next = String(scope.remaining);
      if (scope.count.textContent !== next) {
        scope.count.textContent = next;

        if (animate) {
          scope.count.classList.remove('is-ticking');
          void scope.count.offsetWidth;
          scope.count.classList.add('is-ticking');
        }
      }
    }
  }

  /** Reinicia el ciclo en la fase del reflejo. */
  function restart(scope: ReflectScope) {
    scope.phase = 'reflect';
    scope.remaining = COUNT_FROM;
    showPhoto(scope, scope.plainIndex);
    paint(scope, false);
  }

  /**
   * Un tick por segundo. Cada fase dura `COUNT_FROM` ticks:
   *
   *   2 → 1 → (cambia de fase y de foto)
   */
  /**
   * El badge ya no tiene reloj propio: se suscribe al **mismo** reloj que el
   * carrusel, así que la cuenta y el avance de piezas no pueden derivar.
   */
  function schedule(scope: ReflectScope) {
    // Una sola suscripción por pieza.
    scope.unsubscribe?.();

    scope.unsubscribe = onTick(() => {
      if (document.hidden) return;

      const rect = scope.root.getBoundingClientRect();
      const visible =
        (rect.width === 0 && rect.height === 0) ||
        (rect.bottom > 0 && rect.top < window.innerHeight);
      if (!visible) return;

      scope.remaining -= 1;

      if (scope.remaining > 0) {
        paint(scope);
        return;
      }

      // Se acabó la fase: cambio de foto y de etiqueta.
      if (scope.phase === 'reflect') {
        // Reflejo → normal: aparece la foto con flash.
        scope.phase = 'normal';
        scope.remaining = COUNT_FROM;
        showPhoto(scope, scope.flashIndex);
        paint(scope);
        return;
      }

      // Normal → reflejo: vuelve la portada. Cierra la vuelta; el carrusel
      // avanza por su cuenta al oír el mismo latido.
      scope.phase = 'reflect';
      scope.remaining = COUNT_FROM;
      showPhoto(scope, scope.plainIndex);
      paint(scope);
    });
  }

  function init() {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    document.querySelectorAll<HTMLElement>('[data-reflect]').forEach((root) => {
      const scope = register(root);
      if (!scope) return;

      if (reduce) {
        // Sin animación: se queda la foto con reflejo y la etiqueta fija.
        scope.phase = 'normal';
        showPhoto(scope, scope.flashIndex);
        paint(scope, false);
        return;
      }

      restart(scope);
      schedule(scope);
    });
  }

  // La página se repinta (filtros, favoritos): se registran las piezas nuevas.
  document.addEventListener('reflect:refresh', init);

  // Si el usuario cambia de foto a mano, se le da margen antes de retomar.
  document.addEventListener('click', (e) => {
    const target = e.target as (HTMLElement & { __reflectAuto?: boolean }) | null;
    if (!target?.closest('[data-reflect]')) return;
    if (!target.closest('[data-carousel-dir], [data-carousel-dot], [data-carousel-thumb]')) return;

    // El propio ciclo acaba de pulsar ese control: no es el usuario.
    if (target.__reflectAuto || settling) {
      target.__reflectAuto = false;
      return;
    }

    // El usuario navegó: se reinicia el ciclo común para que badge y
    // carrusel vuelvan a empezar juntos.
    sync();

    scopes.forEach((scope) => {
      scope.unsubscribe?.();
      restart(scope);

      window.setTimeout(() => schedule(scope), RESUME_MS);
    });
  });

  init();
})();
