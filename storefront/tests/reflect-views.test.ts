// @vitest-environment happy-dom
/**
 * Un jean tiene 4 fotos: frente, frente-flash, espalda y espalda-flash.
 *
 * El ciclo debe enseñar **las dos caras**, alternando cada una con su
 * reflejo. Antes solo alternaba frente / frente-flash y la espalda no se
 * veía nunca.
 *
 *   vuelta 1:  frente      → frente-flash
 *   vuelta 2:  espalda     → espalda-flash
 *   vuelta 3:  frente      → frente-flash   …
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { planReflectImages } from '../src/lib/reflective';

const jeans = [
  { url: '/img/jeans/gris/gris-metalico-01-frente.jpg', position: 0 },
  { url: '/img/jeans/gris/gris-metalico-02-espalda.jpg', position: 1 },
  { url: '/img/jeans/gris/gris-metalico-03-frente-flash.jpg', position: 2 },
  { url: '/img/jeans/gris/gris-metalico-04-espalda-flash.jpg', position: 3 },
];

function mount(photos: string[]) {
  document.body.innerHTML = `
    <div class="product-frame" data-reflect="1" data-reflect-flash="1" data-reflect-rotates="1">
      <span class="reflect-badge is-lit" data-reflect-badge
            data-label="Reflectivo en:" data-label-normal="Normal en:">
        <span class="reflect-badge-label" data-reflect-label>Reflectivo en:</span>
        <span class="reflect-badge-count" data-reflect-count>2</span>
      </span>
      <div class="card-carousel" data-carousel-scope>
        <div class="card-track" data-carousel-track>
          ${photos.map((p) => `<div class="card-slide" data-carousel-slide><img src="${p}"></div>`).join('')}
        </div>
        <div class="card-dots">
          ${photos.map((_, i) => `<span class="card-dot${i === 0 ? ' is-active' : ''}" data-carousel-dot="${i}"></span>`).join('')}
        </div>
      </div>
    </div>`;
}

const activeIndex = () =>
  [...document.querySelectorAll<HTMLElement>('[data-carousel-dot]')].findIndex((d) =>
    d.classList.contains('is-active')
  );

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  delete (window as any).__dspReflectAnim;

  mount(planReflectImages(jeans, true).images);

  Element.prototype.getBoundingClientRect = () =>
    ({ top: 10, bottom: 400, left: 0, right: 300, width: 300, height: 390, x: 0, y: 10,
       toJSON: () => ({}) }) as DOMRect;

  const track = document.querySelector<HTMLElement>('[data-carousel-track]')!;
  Object.defineProperty(track, 'offsetWidth', { value: 300, configurable: true });
  track.querySelectorAll<HTMLElement>('[data-carousel-slide]').forEach((s, i) => {
    Object.defineProperty(s, 'offsetLeft', { value: i * 300, configurable: true });
    Object.defineProperty(s, 'offsetWidth', { value: 300, configurable: true });
  });
  track.scrollTo = ((opts: { left?: number }) => {
    Object.defineProperty(track, 'scrollLeft', { value: opts?.left ?? 0, configurable: true });
    track.dispatchEvent(new Event('scroll'));
  }) as typeof track.scrollTo;
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('galería con frente y espalda', () => {
  it('ordena vista normal seguida de su flash', () => {
    const plan = planReflectImages(jeans, true);
    const names = plan.images.map((u) => u.split('/').pop());

    expect(names).toEqual([
      'gris-metalico-01-frente.jpg',
      'gris-metalico-03-frente-flash.jpg',
      'gris-metalico-02-espalda.jpg',
      'gris-metalico-04-espalda-flash.jpg',
    ]);
    expect(plan.flashIndex).toBe(1);
  });

  it('alterna frente y espalda en vueltas distintas', async () => {
    await import('../src/lib/carousel');
    await import('../src/lib/reflect-anim');

    // Vuelta 1: frente → frente-flash.
    expect(activeIndex()).toBe(0);
    vi.advanceTimersByTime(2000);
    expect(activeIndex()).toBe(1);

    // Vuelta 2: espalda → espalda-flash.
    vi.advanceTimersByTime(2000);
    expect(activeIndex()).toBe(2);
    vi.advanceTimersByTime(2000);
    expect(activeIndex()).toBe(3);

    // Vuelta 3: vuelve al frente.
    vi.advanceTimersByTime(2000);
    expect(activeIndex()).toBe(0);
  });
});
