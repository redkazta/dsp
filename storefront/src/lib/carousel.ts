/**
 * Carrusel de fotos de una pieza.
 *
 * Funciona con cualquier contenedor que tenga:
 *   <div data-carousel-scope>
 *     <div class="track"> …slides… </div>
 *     <button data-carousel-dir="-1"> …
 *     <button data-carousel-dir="1">  …
 *     <span data-carousel-dot="0"> …
 *     <button data-carousel-thumb="0"> …
 *   </div>
 *
 * **No tiene reloj propio.** El cambio automático de foto lo manda el badge
 * del reflejo (`lib/reflect-anim.ts`), que pulsa los mismos controles. Antes
 * este archivo abría su propio `setInterval` y los dos se peleaban: las
 * fotos se movían de más y sin relación con la cuenta del badge.
 *
 * - Flechas y puntos NO navegan cuando el carrusel está dentro de un <a>.
 * - Se inicializa por delegación, así que da igual si el HTML llegó en el
 *   SSR o se pintó después.
 */

type Carousel = {
  scope: HTMLElement;
  track: HTMLElement;
  slides: HTMLElement[];
  dots: HTMLElement[];
  /** Última foto pintada, para detectar el cambio. */
  lastIndex: number;
};

const registry = new Map<HTMLElement, Carousel>();

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

  // Avisa cuando cambia la foto, para que el badge sepa en cuál está.
  if (carousel.lastIndex !== index) {
    carousel.lastIndex = index;
    carousel.scope.dispatchEvent(
      new CustomEvent('carousel:changed', { bubbles: true, detail: { index } })
    );
  }

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
    lastIndex: -1,
  };

  track.addEventListener('scroll', () => paint(carousel), { passive: true });
  paint(carousel);

  registry.set(scope, carousel);
  return carousel;
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
      paint(carousel);
      return;
    }

    if (dot) {
      goTo(carousel, Number(dot.dataset.carouselDot ?? '0'));
      // `scroll` puede no dispararse (scroll instantáneo o ya en posición):
      // se repinta igual para que puntos y miniaturas no se queden atrás.
      paint(carousel);
      return;
    }

    if (thumb) {
      goTo(carousel, Number(thumb.dataset.carouselThumb ?? '0'));
      paint(carousel);
    }
  },
  true // captura: se ejecuta antes de que el <a> navegue
);

// Registra lo que ya está en el DOM
document.querySelectorAll<HTMLElement>('[data-carousel-scope]').forEach(register);
