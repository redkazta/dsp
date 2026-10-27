// @vitest-environment happy-dom
/**
 * Coordinación entre el reflejo y el carrusel.
 *
 * El autoplay de `carousel.ts` mueve el track por su cuenta. Mientras el
 * reflejo muestra la foto con flash, ese avance debe detenerse: si no,
 * ambos mueven el carrusel y el encendido aterriza en otra foto.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

function mountCarousel() {
  document.body.innerHTML = `
    <div class="card-carousel" data-carousel-scope>
      <div class="card-track" data-carousel-track>
        <div class="card-slide" data-carousel-slide>a</div>
        <div class="card-slide" data-carousel-slide>b</div>
      </div>
      <span class="card-dot" data-carousel-dot="0"></span>
      <span class="card-dot" data-carousel-dot="1"></span>
    </div>`;
}

let scrolls: number[] = [];

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  delete (window as any).__dspReflectAnim;
  mountCarousel();
  scrolls = [];

  // happy-dom mide todo en 0 y no implementa scrollTo: se observa la llamada.
  Element.prototype.getBoundingClientRect = () =>
    ({ top: 10, bottom: 400, left: 0, right: 300, width: 300, height: 390, x: 0, y: 10,
       toJSON: () => ({}) }) as DOMRect;

  const track = document.querySelector<HTMLElement>('[data-carousel-track]')!;
  track.scrollTo = ((opts: { left?: number }) => {
    scrolls.push(opts?.left ?? 0);
  }) as typeof track.scrollTo;
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('carousel + reflect', () => {
  it('deja de avanzar solo mientras está en pausa', async () => {
    await import('../src/lib/carousel');

    const scope = document.querySelector<HTMLElement>('[data-carousel-scope]')!;

    // El autoplay (por defecto 4.5 s) mueve el track.
    vi.advanceTimersByTime(4600);
    expect(scrolls.length).toBeGreaterThan(0);

    // En pausa: deja de moverse por su cuenta.
    document.dispatchEvent(new CustomEvent('carousel:pause', { detail: scope }));
    const before = scrolls.length;
    vi.advanceTimersByTime(20000);
    expect(scrolls.length).toBe(before);

    // Al reanudar, recupera el avance.
    document.dispatchEvent(new CustomEvent('carousel:resume', { detail: scope }));
    vi.advanceTimersByTime(4600);
    expect(scrolls.length).toBeGreaterThan(before);
  });
});
