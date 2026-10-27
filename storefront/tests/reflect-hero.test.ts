// @vitest-environment happy-dom
/**
 * En el hero el ciclo alterna las dos fotos de **la misma pieza**.
 * El avance de productos lo dicta ese mismo ciclo (`reflect:rotate`).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

function mountHero() {
  document.body.innerHTML = `
    <div class="hero-carousel" data-hero-carousel>
      <div class="hero-track" data-hero-track>
        <article class="hero-slide" data-hero-slide>
          <div class="hero-media" data-reflect="1" data-reflect-flash="1" data-reflect-rotates="1">
            <span class="reflect-badge is-lit" data-reflect-badge
                  data-label="Reflectivo en:" data-label-normal="Normal en:">
              <span class="reflect-badge-label" data-reflect-label>Reflectivo en:</span>
              <span class="reflect-badge-count" data-reflect-count>2</span>
            </span>
            <img class="hero-photo is-active" data-hero-photo="0" src="a-plain.jpg">
            <img class="hero-photo" data-hero-photo="1" src="a-flash.jpg">
          </div>
        </article>

        <article class="hero-slide" data-hero-slide>
          <div class="hero-media" data-reflect="1" data-reflect-flash="1" data-reflect-rotates="1">
            <span class="reflect-badge is-lit" data-reflect-badge
                  data-label="Reflectivo en:" data-label-normal="Normal en:">
              <span class="reflect-badge-label" data-reflect-label>Reflectivo en:</span>
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
  it('alterna las fotos de cada pieza sin saltar de artículo', async () => {
    await import('../src/lib/reflect-anim');

    const [first, second] = [...document.querySelectorAll<HTMLElement>('[data-reflect]')];

    // Primera mitad: portadas.
    expect(first.querySelectorAll('.hero-photo')[0].classList.contains('is-active')).toBe(true);
    expect(second.querySelectorAll('.hero-photo')[0].classList.contains('is-active')).toBe(true);

    // Cambio a la foto con flash de cada una.
    vi.advanceTimersByTime(2000);
    expect(first.querySelectorAll('.hero-photo')[1].classList.contains('is-active')).toBe(true);
    expect(second.querySelectorAll('.hero-photo')[1].classList.contains('is-active')).toBe(true);
    expect(first.querySelector('[data-reflect-label]')!.textContent).toBe('Normal en:');

    // Y vuelven a la portada.
    vi.advanceTimersByTime(2000);
    expect(first.querySelectorAll('.hero-photo')[0].classList.contains('is-active')).toBe(true);
    expect(first.querySelector('[data-reflect-label]')!.textContent).toBe('Reflectivo en:');
  });
});
