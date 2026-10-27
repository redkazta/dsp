// @vitest-environment happy-dom
/**
 * El reflejo cambia **la foto dentro de la pieza**, nunca el producto.
 *
 * Antes pulsaba los puntos del carrusel, que en el hero equivalen al
 * carrusel de productos: con varias piezas contando a la vez, el hero
 * parecía cambiar de artículo cada segundo.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

function mountHero() {
  document.body.innerHTML = `
    <div class="hero-carousel" data-hero-carousel data-carousel-interval="4500">
      <div class="hero-track" data-hero-track>
        <article class="hero-slide" data-hero-slide>
          <div class="hero-media" data-reflect="1" data-reflect-flash="1" data-reflect-ms="1000">
            <span class="reflect-badge" data-reflect-badge data-label="Reflectivo en…">
              <span class="reflect-badge-label" data-reflect-label>Reflectivo en…</span>
              <span class="reflect-badge-count" data-reflect-count>2</span>
            </span>
            <img class="hero-photo is-active" data-hero-photo="0" src="a-plain.jpg">
            <img class="hero-photo" data-hero-photo="1" src="a-flash.jpg">
          </div>
        </article>

        <article class="hero-slide" data-hero-slide>
          <div class="hero-media" data-reflect="1" data-reflect-flash="1" data-reflect-ms="1000">
            <span class="reflect-badge" data-reflect-badge data-label="Reflectivo en…">
              <span class="reflect-badge-label" data-reflect-label>Reflectivo en…</span>
              <span class="reflect-badge-count" data-reflect-count>2</span>
            </span>
            <img class="hero-photo is-active" data-hero-photo="0" src="b-plain.jpg">
            <img class="hero-photo" data-hero-photo="1" src="b-flash.jpg">
          </div>
        </article>
      </div>
    </div>`;
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  delete (window as any).__dspReflectAnim;
  mountHero();

  Element.prototype.getBoundingClientRect = function () {
    return { top: 10, bottom: 400, left: 0, right: 300, width: 300, height: 390, x: 0, y: 10, toJSON: () => ({}) } as any;
  };
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('reflejo en el hero', () => {
  it('cambia la foto de la misma pieza y no mueve el carrusel', async () => {
    const moved: string[] = [];
    document.addEventListener('reflect:photo', () => moved.push('photo'));
    document.addEventListener('hero:pause', () => moved.push('pause'));
    document.addEventListener('carousel:pause', () => moved.push('pause-carousel'));

    await import('../src/lib/reflect-anim');

    const [first, second] = [...document.querySelectorAll<HTMLElement>('[data-reflect]')];

    // 2 s: cuenta 2 → 1 → encendido.
    vi.advanceTimersByTime(2000);

    // Cada pieza muestra su propia foto con flash…
    expect(first.querySelectorAll('.hero-photo')[1].classList.contains('is-active')).toBe(true);
    expect(second.querySelectorAll('.hero-photo')[1].classList.contains('is-active')).toBe(true);

    // …y la primera foto de cada una dejó de verse.
    expect(first.querySelectorAll('.hero-photo')[0].classList.contains('is-active')).toBe(false);

    // No se pidió pausar ni mover el carrusel de productos.
    expect(moved).toEqual([]);
  });

  it('vuelve a la portada sin saltar de producto', async () => {
    await import('../src/lib/reflect-anim');

    const first = document.querySelector<HTMLElement>('[data-reflect]')!;

    vi.advanceTimersByTime(2000);
    expect(first.querySelectorAll('.hero-photo')[1].classList.contains('is-active')).toBe(true);

    // Se apaga al completar la vuelta (2 s de cuenta + 2.5 s de encendido).
    vi.advanceTimersByTime(3000);
    expect(first.querySelectorAll('.hero-photo')[0].classList.contains('is-active')).toBe(true);
    expect(first.querySelector('.reflect-badge')!.classList.contains('is-lit')).toBe(false);
  });
});
