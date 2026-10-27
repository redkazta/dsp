/**
 * Carrusel de imágenes reutilizable.
 *
 * Funciona con cualquier contenedor que tenga:
 *   <div data-carousel-scope>
 *     <div class="track"> …slides… </div>
 *     <button data-carousel-dir="-1"> …
 *     <button data-carousel-dir="1">  …
 *     <span data-carousel-dot="0"> …
 *   </div>
 *
 * - Flechas y puntos NO navegan cuando el carrusel está dentro de un <a>.
 * - Avanza solo cada `interval` ms; se pausa al interactuar (hover, touch,
 *   teclado, o cuando la pestaña no está visible).
 * - Respeta `prefers-reduced-motion`.
 *
 * Se inicializa por delegación en el documento, así que da igual si el HTML
 * del carrusel llegó en el SSR o se pintó después.
 */

const DEFAULT_INTERVAL = 4500;

type Carousel = {
  scope: HTMLElement;
  track: HTMLElement;
  slides: HTMLElement[];
  dots: HTMLElement[];
};

const registry = new Map<HTMLElement, Carousel>();
let focused = false;
let hovering = 0;
let timer: number | undefined;

/**
 * Scopes cuyo autoplay está en pausa (por ejemplo, mientras el reflejo
 * muestra la foto con flash). Sin esto, el avance automático y el reflejo
 * pulsaban los mismos puntos y se peleaban.
 */
const paused = new Set<HTMLElement>();

/**
 * Detiene/reanuda el avance automático de un carrusel concreto.
 *
 * Se expone por evento (`storefront` no puede importar funciones entre
 * scripts de navegador: cada uno es un módulo aparte).
 */
document.addEventListener('carousel:pause', (e) => {
  const scope = (e as CustomEvent<HTMLElement>).detail;
  if (scope instanceof HTMLElement) paused.add(scope);
});

document.addEventListener('carousel:resume', (e) => {
  const scope = (e as CustomEvent<HTMLElement>).detail;
  if (scope instanceof HTMLElement) paused.delete(scope);
});

function readSlideWidth(track: HTMLElement) {
  return Math.max(track.clientWidth, 1);
}

function currentIndex({ track, slides }: Carousel) {
  if (slides.length === 0) return 0;
  const slide = slides[0];
  const step = slide.offsetWidth || readSlideWidth(track);
  return Math.min(slides.length - 1, Math.max(0, Math.round(track.scrollLeft / Math.max(step, 1))));
}

function goTo(carousel: Carousel, index: number, behavior: ScrollBehavior = 'smooth') {
  const { track, slides } = carousel;
  if (slides.length === 0) return;

  const target = slides[Math.max(0, Math.min(index, slides.length - 1))];
  track.scrollTo({ left: target.offsetLeft, behavior });
}

function paint(carousel: Carousel) {
  const index = currentIndex(carousel);

  carousel.dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));

  // Las miniaturas marcan la activa con su propia clase: la clase dinámica
  // `border-white/25` no existe en el CSS compilado de Tailwind y el estado
  // se perdía.
  carousel.scope.querySelectorAll<HTMLElement>('[data-carousel-thumb]').forEach((thumb, i) => {
    const active = i === index;
    thumb.setAttribute('aria-pressed', String(active));
    thumb.classList.toggle('is-active', active);
  });

  carousel.scope.querySelectorAll<HTMLElement>('[data-carousel-dir]').forEach((arrow) => {
    const dir = Number(arrow.dataset.carouselDir ?? '1');
    if (dir === -1) arrow.toggleAttribute('data-edge', index === 0);
    if (dir === 1) arrow.toggleAttribute('data-edge', index === carousel.slides.length - 1);
  });
}

function register(scope: HTMLElement): Carousel | null {
  if (registry.has(scope)) return registry.get(scope)!;

  const track = scope.querySelector<HTMLElement>('[data-carousel-track]');
  if (!track) return null;

  const carousel: Carousel = {
    scope,
    track,
    slides: [...track.querySelectorAll<HTMLElement>('[data-carousel-slide]')],
    dots: [...scope.querySelectorAll<HTMLElement>('[data-carousel-dot]')],
  };

  if (carousel.slides.length < 2) {
    registry.set(scope, carousel);
    return carousel;
  }

  track.addEventListener('scroll', () => paint(carousel), { passive: true });
  paint(carousel);

  registry.set(scope, carousel);
  return carousel;
}

function start() {
  window.clearInterval(timer);

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  timer = window.setInterval(() => {
    if (focused || hovering > 0 || document.hidden) return;

    document.querySelectorAll<HTMLElement>('[data-carousel-scope]').forEach((scope) => {
      // En pausa por otra animación (reflejo): no se mueve por debajo.
      if (paused.has(scope)) return;

      const carousel = registry.get(scope) ?? register(scope);
      if (!carousel || carousel.slides.length < 2) return;

      // Solo anima los carruseles visibles en pantalla
      const rect = scope.getBoundingClientRect();
      const visible = rect.bottom > 0 && rect.top < window.innerHeight;
      if (!visible) return;

      const next = (currentIndex(carousel) + 1) % carousel.slides.length;
      goTo(carousel, next);
    });
  }, DEFAULT_INTERVAL);
}

// ---------- Interacción (delegada) ----------
document.addEventListener(
  'click',
  (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const scope = target.closest<HTMLElement>('[data-carousel-scope]');
    if (!scope) return;

    const carousel = registry.get(scope) ?? register(scope);
    if (!carousel) return;

    const arrow = target.closest<HTMLElement>('[data-carousel-dir]');
    const dot = target.closest<HTMLElement>('[data-carousel-dot]');
    const thumb = target.closest<HTMLElement>('[data-carousel-thumb]');

    if (!arrow && !dot && !thumb) return;

    // Nunca reenviar el clic al enlace del producto
    e.preventDefault();
    e.stopPropagation();

    if (arrow) {
      const dir = Number(arrow.dataset.carouselDir ?? '1');
      const total = carousel.slides.length;
      const next = (currentIndex(carousel) + dir + total) % total;
      goTo(carousel, next);
      return;
    }

    if (dot) {
      goTo(carousel, Number(dot.dataset.carouselDot ?? '0'));
      return;
    }

    if (thumb) {
      goTo(carousel, Number(thumb.dataset.carouselThumb ?? '0'));
    }
  },
  true // captura: se ejecuta antes de que el <a> navegue
);

// Pausa solo mientras el puntero está sobre un carrusel
document.addEventListener(
  'pointerenter',
  (e) => {
    if ((e.target as HTMLElement | null)?.closest('[data-carousel-scope]')) hovering++;
  },
  true
);

document.addEventListener(
  'pointerleave',
  (e) => {
    if ((e.target as HTMLElement | null)?.closest('[data-carousel-scope]')) hovering = Math.max(0, hovering - 1);
  },
  true
);

document.addEventListener('focusin', () => (focused = true));
document.addEventListener('focusout', () => (focused = false));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) window.clearInterval(timer);
  else start();
});

// Registra lo que ya está en el DOM
document.querySelectorAll<HTMLElement>('[data-carousel-scope]').forEach(register);

start();
