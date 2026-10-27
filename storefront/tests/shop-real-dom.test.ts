// @vitest-environment happy-dom
/**
 * Reproducción **exacta** del DOM de /tienda.
 *
 * Se copia la estructura real de `ProductCard.astro` (extraída del HTML
 * servido) para ver por qué las fotos no cambian con el ciclo.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

function mountShopCard() {
  // Copia literal del markup servido en /tienda para una pieza reflectiva.
  document.body.innerHTML = `
    <div class="product-card-wrap">
      <button type="button" class="wish-btn">♥</button>

      <a href="/producto/jeans-gris-metalico" class="block">
        <div class="product-frame border-2 product-media"
             data-reflect="1" data-reflect-flash="1" data-reflect-ms="1000" data-reflect-rotates="1">

          <span class="reflect-badge is-lit" data-reflect-badge
                data-label="Reflectivo en:" data-label-normal="Normal en:">
            <span class="reflect-badge-label" data-reflect-label>Reflectivo en:</span>
            <span class="reflect-badge-count" data-reflect-count>2</span>
            <span class="reflect-badge-dot"></span>
          </span>

          <div class="card-carousel" data-carousel-scope>
            <div class="card-track" data-carousel-track tabindex="0">
              <div class="card-slide" data-carousel-slide><img src="01-frente.jpg"></div>
              <div class="card-slide" data-carousel-slide><img src="03-flash.jpg"></div>
              <div class="card-slide" data-carousel-slide><img src="02-espalda.jpg"></div>
              <div class="card-slide" data-carousel-slide><img src="04-espalda-flash.jpg"></div>
            </div>

            <button type="button" class="card-arrow card-arrow--prev" data-carousel-dir="-1"></button>
            <button type="button" class="card-arrow card-arrow--next" data-carousel-dir="1"></button>

            <div class="card-dots">
              <span class="card-dot is-active" data-carousel-dot="0"></span>
              <span class="card-dot" data-carousel-dot="1"></span>
              <span class="card-dot" data-carousel-dot="2"></span>
              <span class="card-dot" data-carousel-dot="3"></span>
            </div>
          </div>
        </div>
      </a>
    </div>`;
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  delete (window as any).__dspReflectAnim;
  mountShopCard();

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

describe('tarjeta real de /tienda', () => {
  it('la foto cambia cuando el badge lo pide', async () => {
    await import('../src/lib/carousel');
    await import('../src/lib/reflect-anim');

    const track = document.querySelector<HTMLElement>('[data-carousel-track]')!;
    const dot = (i: number) =>
      document.querySelector<HTMLElement>(`.card-dot:not(.is-active)`)!;

    void dot;

    // 2 s: el badge pide la segunda foto (flash).
    vi.advanceTimersByTime(2000);

    // El scroll debe haberse movido a la segunda slide.
    expect(track.scrollLeft).toBe(300);
  });

  it('el punto activo acompaña a la foto', async () => {
    await import('../src/lib/carousel');
    await import('../src/lib/reflect-anim');

    vi.advanceTimersByTime(2000);

    const dots = [...document.querySelectorAll<HTMLElement>('[data-carousel-dot]')];
    expect(dots[1].classList.contains('is-active')).toBe(true);
    expect(dots[0].classList.contains('is-active')).toBe(false);
  });
});
