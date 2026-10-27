// @vitest-environment happy-dom
/**
 * Un jean con 4 fotos debe recorrerlas todas, no solo la primera.
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

  const plan = planReflectImages(jeans, true);
  mount(plan.images);

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

describe('jean con 4 fotos', () => {
  it('el ciclo recorre la galería completa', async () => {
    await import('../src/lib/carousel');
    await import('../src/lib/reflect-anim');

    // Se ve la portada.
    expect(activeIndex()).toBe(0);

    // 2 s: pasa a la foto con flash.
    vi.advanceTimersByTime(2000);
    expect(activeIndex()).toBe(1);

    // 4 s: vuelve a la portada para empezar otra vuelta.
    vi.advanceTimersByTime(2000);
    expect(activeIndex()).toBe(0);
  });

  it('los puntos permiten ver la espalda a mano', async () => {
    await import('../src/lib/carousel');

    const dots = [...document.querySelectorAll<HTMLElement>('[data-carousel-dot]')];

    dots[2].click();
    expect(activeIndex()).toBe(2);

    dots[3].click();
    expect(activeIndex()).toBe(3);

    // Las 4 fotos están en el DOM.
    expect(document.querySelectorAll('[data-carousel-slide]')).toHaveLength(4);
  });
});
