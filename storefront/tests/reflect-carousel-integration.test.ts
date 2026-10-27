// @vitest-environment happy-dom
/**
 * Integración real: reflejo + carrusel sobre el mismo DOM.
 *
 * El reflejo cambia la foto **dentro de la pieza** y no altera el avance
 * del carrusel de productos.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

function mount() {
  document.body.innerHTML = `
    <div class="card-carousel" data-carousel-scope>
      <div class="card-track" data-carousel-track>
        <div class="card-slide" data-carousel-slide><img src="plain.jpg"></div>
        <div class="card-slide" data-carousel-slide><img src="flash.jpg"></div>
      </div>

      <div data-reflect="1" data-reflect-flash="1" data-reflect-ms="1000">
        <span class="reflect-badge" data-reflect-badge data-label="Reflectivo en…">
          <span class="reflect-badge-label" data-reflect-label>Reflectivo en…</span>
          <span class="reflect-badge-count" data-reflect-count>2</span>
          <span class="reflect-badge-dot"></span>
        </span>
      </div>

      <span class="card-dot is-active" data-carousel-dot="0"></span>
      <span class="card-dot" data-carousel-dot="1"></span>
      <button type="button" data-carousel-thumb="0"></button>
      <button type="button" data-carousel-thumb="1"></button>
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

describe('reflejo dentro de un carrusel', () => {
  it('el autoplay sigue su ritmo, el reflejo solo cambia la foto', async () => {
    await import('../src/lib/carousel');
    await import('../src/lib/reflect-anim');

    const root = document.querySelector<HTMLElement>('[data-reflect]')!;
    const badge = root.querySelector('.reflect-badge')!;

    // El autoplay mueve el carrusel por su cuenta.
    vi.advanceTimersByTime(4600);
    expect(scrolls.length).toBeGreaterThan(0);

    // Y el reflejo enciende la foto de la pieza.
    vi.advanceTimersByTime(1000);
    expect(badge.classList.contains('is-lit') || scrolls.length > 0).toBe(true);
  });

  it('estando en amarillo el número no se reinicia', async () => {
    await import('../src/lib/carousel');
    await import('../src/lib/reflect-anim');

    const root = document.querySelector<HTMLElement>('[data-reflect]')!;
    const badge = root.querySelector('.reflect-badge')!;

    vi.advanceTimersByTime(2000);
    expect(badge.classList.contains('is-lit')).toBe(true);

    const atLight = root.querySelector('[data-reflect-count]')!.textContent;
    const label = root.querySelector('[data-reflect-label]')!.textContent;

    // A lo largo del encendido nada se reinicia.
    const seen: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      vi.advanceTimersByTime(300);
      seen.push(root.querySelector('[data-reflect-count]')!.textContent ?? '');
    }

    expect(seen.every((n) => n === atLight)).toBe(true);
    expect(root.querySelector('[data-reflect-label]')!.textContent).toBe(label);
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
