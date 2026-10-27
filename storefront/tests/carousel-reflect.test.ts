// @vitest-environment happy-dom
/**
 * El carrusel de fotos **no tiene reloj propio**.
 *
 * El cambio automático lo manda el badge del reflejo pulsando los mismos
 * controles. Antes `carousel.ts` abría su propio intervalo y los dos se
 * peleaban: las fotos se movían de más y sin relación con la cuenta.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

function mountCard() {
  // En producción `data-reflect` envuelve al carrusel (ProductCard.astro).
  document.body.innerHTML = `
    <div data-reflect="1" data-reflect-flash="1">
      <span class="reflect-badge is-lit" data-reflect-badge
            data-label="Reflectivo en:" data-label-normal="Normal en:">
        <span class="reflect-badge-label" data-reflect-label>Reflectivo en:</span>
        <span class="reflect-badge-count" data-reflect-count>2</span>
      </span>
      <div class="card-carousel" data-carousel-scope>
        <div class="card-track" data-carousel-track>
          <div class="card-slide" data-carousel-slide><img src="p1.jpg"></div>
          <div class="card-slide" data-carousel-slide><img src="p2.jpg"></div>
        </div>
        <span class="card-dot is-active" data-carousel-dot="0"></span>
        <span class="card-dot" data-carousel-dot="1"></span>
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

describe('carrusel sin reloj propio', () => {
  it('solo se mueve cuando el badge cambia de foto', async () => {
    await import('../src/lib/carousel');
    await import('../src/lib/reflect-anim');

    // El badge coloca la portada al arrancar; a partir de ahí se mide.
    const base = scrolls.length;

    // Tick 1: la cuenta baja, la foto sigue igual.
    vi.advanceTimersByTime(1000);
    expect(scrolls.length).toBe(base);

    // Tick 2: el badge pide la foto con flash.
    vi.advanceTimersByTime(1000);
    expect(scrolls.length).toBe(base + 1);

    // Durante la fase "Normal" no se mueve por su cuenta.
    vi.advanceTimersByTime(1000);
    expect(scrolls.length).toBe(base + 1);

    // Tick 4: vuelve la portada.
    vi.advanceTimersByTime(1000);
    expect(scrolls.length).toBe(base + 2);
  });

  it('no se mueve solo aunque pasen muchos segundos', async () => {
    await import('../src/lib/carousel');

    // Sin badge ni interacción: el carrusel se queda quieto.
    vi.advanceTimersByTime(20000);
    expect(scrolls).toHaveLength(0);
  });

  it('responde a las flechas y a los puntos', async () => {
    await import('../src/lib/carousel');

    const root = document.querySelector<HTMLElement>('[data-carousel-scope]')!;

    root.querySelector<HTMLElement>('[data-carousel-dot="1"]')!.click();
    expect(scrolls.length).toBeGreaterThan(0);

    const afterDot = scrolls.length;
    root.querySelector<HTMLElement>('[data-carousel-thumb="0"]')!.click();
    expect(scrolls.length).toBeGreaterThan(afterDot);
  });
});
