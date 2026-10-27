// @vitest-environment happy-dom
/**
 * Carrusel de las tarjetas de /tienda.
 *
 * Diferencias con la ficha: las tarjetas usan **puntos** (no miniaturas) y
 * el badge envuelve al carrusel. Antes `showPhoto` solo buscaba miniaturas,
 * así que en la tienda no encontraba ningún control y la foto nunca cambiaba.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

function mountCard() {
  // Estructura real de ProductCard.astro.
  document.body.innerHTML = `
    <div class="product-frame" data-reflect="1" data-reflect-flash="1" data-reflect-rotates="1">
      <span class="reflect-badge is-lit" data-reflect-badge
            data-label="Reflectivo en:" data-label-normal="Normal en:">
        <span class="reflect-badge-label" data-reflect-label>Reflectivo en:</span>
        <span class="reflect-badge-count" data-reflect-count>2</span>
      </span>

      <div class="card-carousel" data-carousel-scope>
        <div class="card-track" data-carousel-track>
          <div class="card-slide" data-carousel-slide><img src="frente.jpg"></div>
          <div class="card-slide" data-carousel-slide><img src="frente-flash.jpg"></div>
        </div>
        <button type="button" data-carousel-dir="-1"></button>
        <button type="button" data-carousel-dir="1"></button>
        <div class="card-dots">
          <span class="card-dot is-active" data-carousel-dot="0"></span>
          <span class="card-dot" data-carousel-dot="1"></span>
        </div>
      </div>
    </div>`;
}

let scrolls: number[] = [];

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  delete (window as any).__dspReflectAnim;
  mountCard();
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

describe('carrusel de la tienda', () => {
  it('el badge cambia la foto usando los puntos', async () => {
    await import('../src/lib/carousel');
    await import('../src/lib/reflect-anim');

    const root = document.querySelector<HTMLElement>('[data-reflect]')!;
    const base = scrolls.length;

    // Tick 2: pide la foto con flash.
    vi.advanceTimersByTime(2000);

    expect(scrolls.length).toBe(base + 1);
    expect(root.querySelector('[data-reflect-label]')!.textContent).toBe('Normal en:');
    expect(root.querySelector('[data-reflect-count]')!.textContent).toBe('2');

    // Y vuelve a la portada al cerrar la vuelta.
    vi.advanceTimersByTime(2000);
    expect(scrolls.length).toBe(base + 2);
    expect(root.querySelector('[data-reflect-label]')!.textContent).toBe('Reflectivo en:');
  });

  it('las flechas y los puntos funcionan a mano', async () => {
    await import('../src/lib/carousel');

    const scope = document.querySelector<HTMLElement>('[data-carousel-scope]')!;

    scope.querySelector<HTMLElement>('[data-carousel-dir="1"]')!.click();
    expect(scrolls.length).toBeGreaterThan(0);

    const afterArrow = scrolls.length;
    scope.querySelector<HTMLElement>('[data-carousel-dot="0"]')!.click();
    expect(scrolls.length).toBeGreaterThan(afterArrow);
  });
});
