// @vitest-environment happy-dom
/**
 * Integración real: reflejo + carrusel sobre el mismo DOM.
 *
 * El reflejo cambia de foto pulsando los puntos que controla `carousel.ts`.
 * Aquí se comprueba que, mientras la pieza está encendida, el avance
 * automático del carrusel no la mueve a otra foto.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

function mount() {
  document.body.innerHTML = `
    <div class="card-carousel" data-carousel-scope>
      <div class="card-track" data-carousel-track>
        <div class="card-slide" data-carousel-slide>
          <img src="plain.jpg">
        </div>
        <div class="card-slide" data-carousel-slide>
          <img src="flash.jpg">
        </div>
      </div>

      <div data-reflect data-reflect-flash="1" data-reflect-ms="1000">
        <span class="reflect-badge" data-reflect-badge data-label="Reflectivo en…">
          <span class="reflect-badge-label" data-reflect-label>Reflectivo en…</span>
          <span class="reflect-badge-count" data-reflect-count>2</span>
          <span class="reflect-badge-dot"></span>
        </span>
      </div>

      <span class="card-dot is-active" data-carousel-dot="0"></span>
      <span class="card-dot" data-carousel-dot="1"></span>
    </div>`;
}

let scrolls: number[] = [];

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  delete (window as any).__dspReflectAnim;
  mount();
  scrolls = [];

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

describe('reflejo dentro de un carrusel', () => {
  it('el autoplay no mueve el carrusel mientras el reflejo está encendido', async () => {
    await import('../src/lib/carousel');
    await import('../src/lib/reflect-anim');

    const root = document.querySelector<HTMLElement>('[data-reflect]')!;
    const badge = root.querySelector('.reflect-badge')!;

    // 1 s → cuenta en 1
    vi.advanceTimersByTime(1000);
    // 1 s → se enciende: el reflejo pide el punto 1 (foto con flash)
    vi.advanceTimersByTime(1000);

    expect(badge.classList.contains('is-lit')).toBe(true);

    // Durante el encendido el autoplay está en pausa: no debe haber dos
    // movimientos peleando (el reflejo pide el flash; el autoplay, el otro).
    const afterLight = scrolls.length;
    vi.advanceTimersByTime(1500);
    expect(scrolls.length).toBe(afterLight);
    expect(badge.classList.contains('is-lit')).toBe(true);

    // Al apagarse vuelve a la portada y el autoplay recupera su ritmo.
    vi.advanceTimersByTime(2600);
    expect(badge.classList.contains('is-lit')).toBe(false);
  });

  it('un solo intervalo por pieza aunque el módulo se importe dos veces', async () => {
    await import('../src/lib/carousel');
    await import('../src/lib/reflect-anim');
    await import('../src/lib/reflect-anim');

    const root = document.querySelector<HTMLElement>('[data-reflect]')!;

    // Si hubiera dos intervalos, el número saltaría 2 → 0 en un tick.
    vi.advanceTimersByTime(1000);
    expect(root.querySelector('[data-reflect-count]')!.textContent).toBe('1');
  });
});
