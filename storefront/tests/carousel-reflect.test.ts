// @vitest-environment happy-dom
/**
 * Reloj compartido: el badge y el carrusel leen **la misma** variable.
 *
 *   tick 0   Reflectivo en: 2   foto 1
 *   tick 1   Reflectivo en: 1   foto 1
 *   tick 2   Normal en: 2       foto 2       (cambio de foto)
 *   tick 3   Normal en: 1       foto 2
 *   tick 4   Reflectivo en: 2   foto 1       (+ cambia de pieza)
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

function mountCard() {
  document.body.innerHTML = `
    <div class="card-carousel" data-carousel-scope>
      <div class="card-track" data-carousel-track>
        <div class="card-slide" data-carousel-slide><img src="p1.jpg"></div>
        <div class="card-slide" data-carousel-slide><img src="p2.jpg"></div>
      </div>

      <div data-reflect="1" data-reflect-flash="1" data-reflect-rotates="1">
        <span class="reflect-badge is-lit" data-reflect-badge
              data-label="Reflectivo en:" data-label-normal="Normal en:">
          <span class="reflect-badge-label" data-reflect-label>Reflectivo en:</span>
          <span class="reflect-badge-count" data-reflect-count>2</span>
        </span>
      </div>

      <span class="card-dot is-active" data-carousel-dot="0"></span>
      <span class="card-dot" data-carousel-dot="1"></span>
      <button type="button" data-carousel-thumb="0"></button>
      <button type="button" data-carousel-thumb="1"></button>
    </div>`;
}

const labelOf = (root: HTMLElement) =>
  root.querySelector('[data-reflect-label]')?.textContent ?? '';

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

describe('reloj compartido', () => {
  it('el ciclo alterna las etiquetas y al cerrar mueve de pieza', async () => {
    await import('../src/lib/carousel');
    await import('../src/lib/reflect-anim');

    const root = document.querySelector<HTMLElement>('[data-reflect]')!;

    expect(labelOf(root)).toBe('Reflectivo en:');

    // Primera fase: cambia la foto, no la pieza.
    vi.advanceTimersByTime(2000);
    expect(labelOf(root)).toBe('Normal en:');
    expect(scrolls).toHaveLength(0);

    // Segunda fase: vuelve la portada y el carrusel avanza de artículo.
    vi.advanceTimersByTime(2000);
    expect(labelOf(root)).toBe('Reflectivo en:');
    expect(scrolls.length).toBeGreaterThan(0);
  });

  it('el carrusel avanza una sola vez por vuelta', async () => {
    await import('../src/lib/carousel');
    await import('../src/lib/reflect-anim');

    const before = scrolls.length;

    // Media vuelta más: aún no toca cambiar de pieza.
    vi.advanceTimersByTime(2000);
    expect(scrolls.length).toBe(before);

    // Vuelta completa: exactamente un avance.
    vi.advanceTimersByTime(2000);
    expect(scrolls.length).toBe(before + 1);
  });

  it('el carrusel sigue funcionando aunque no haya badge', async () => {
    document.body.innerHTML = `
      <div data-carousel-scope>
        <div data-carousel-track>
          <div data-carousel-slide><img src="a.jpg"></div>
          <div data-carousel-slide><img src="b.jpg"></div>
        </div>
        <span data-carousel-dot="0"></span><span data-carousel-dot="1"></span>
      </div>`;

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
      Object.defineProperty(track, 'scrollLeft', { value: opts?.left ?? 0, configurable: true });
      track.dispatchEvent(new Event('scroll'));
    }) as typeof track.scrollTo;

    await import('../src/lib/carousel');

    // Es autónomo: avanza con el reloj aunque no exista un reflejo.
    vi.advanceTimersByTime(4000);
    expect(track.scrollLeft).toBeGreaterThan(0);
  });
});
