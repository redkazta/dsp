// @vitest-environment happy-dom
/**
 * El detalle de producto también obedece al badge.
 *
 * En la ficha el badge vive en `.pdp-reflect`, **fuera** del track, así que
 * las miniaturas son hermanas y no hijas. Antes `showPhoto` solo buscaba
 * dentro del badge, no las encontraba y la galería nunca se movía.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

function mountPdp() {
  document.body.innerHTML = `
    <div class="pdp-carousel" data-carousel-scope>
      <div class="pdp-reflect" data-reflect="1" data-reflect-flash="1">
        <span class="reflect-badge is-lit" data-reflect-badge
              data-label="Reflectivo en:" data-label-normal="Normal en:">
          <span class="reflect-badge-label" data-reflect-label>Reflectivo en:</span>
          <span class="reflect-badge-count" data-reflect-count>2</span>
        </span>
      </div>

      <div class="pdp-track" data-carousel-track>
        <div class="pdp-slide" data-carousel-slide><img src="frente.jpg"></div>
        <div class="pdp-slide" data-carousel-slide><img src="frente-flash.jpg"></div>
      </div>

      <span class="pdp-dot is-active" data-carousel-dot="0"></span>
      <span class="pdp-dot" data-carousel-dot="1"></span>

      <div id="gallery-thumbs">
        <button type="button" data-carousel-thumb="0"></button>
        <button type="button" data-carousel-thumb="1"></button>
      </div>
    </div>`;
}

let scrolls: number[] = [];

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  delete (window as any).__dspReflectAnim;
  mountPdp();
  scrolls = [];

  Element.prototype.getBoundingClientRect = () =>
    ({ top: 10, bottom: 400, left: 0, right: 300, width: 300, height: 390, x: 0, y: 10,
       toJSON: () => ({}) }) as DOMRect;

  const track = document.querySelector<HTMLElement>('[data-carousel-track]')!;
  Object.defineProperty(track, 'offsetWidth', { value: 300, configurable: true });
  track.querySelectorAll<HTMLElement>('[data-carousel-slide]').forEach((slide, i) => {
    Object.defineProperty(slide, 'offsetLeft', { value: i * 300, configurable: true });
    Object.defineProperty(slide, 'offsetWidth', { value: 300, configurable: true });
  });

  track.scrollTo = ((opts: { left?: number }) => {
    const left = opts?.left ?? 0;
    scrolls.push(left);
    Object.defineProperty(track, 'scrollLeft', { value: left, configurable: true });
    track.dispatchEvent(new Event('scroll'));
  }) as typeof track.scrollTo;
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('ficha de producto', () => {
  it('el badge mueve la galería aunque las miniaturas sean hermanas', async () => {
    await import('../src/lib/carousel');
    await import('../src/lib/reflect-anim');

    const root = document.querySelector<HTMLElement>('[data-reflect]')!;
    const base = scrolls.length;

    // Tick 1: sigue la portada.
    vi.advanceTimersByTime(1000);
    expect(scrolls.length).toBe(base);

    // Tick 2: pide la foto con flash.
    vi.advanceTimersByTime(1000);
    expect(scrolls.length).toBe(base + 1);
    expect(root.querySelector('[data-reflect-label]')!.textContent).toBe('Normal en:');

    // Tick 3 y 4: sigue en la foto con flash y vuelve.
    vi.advanceTimersByTime(1000);
    expect(scrolls.length).toBe(base + 1);

    vi.advanceTimersByTime(1000);
    expect(scrolls.length).toBe(base + 2);
    expect(root.querySelector('[data-reflect-label]')!.textContent).toBe('Reflectivo en:');
  });
});
