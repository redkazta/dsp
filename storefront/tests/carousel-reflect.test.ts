// @vitest-environment happy-dom
/**
 * El ciclo del reflejo también mueve el carrusel de piezas.
 *
 * Un único reloj: cuando el badge cierra su vuelta emite `reflect:rotate` y
 * el carrusel del catálogo pasa a la siguiente pieza.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

function mount() {
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

describe('carrusel guiado por el badge', () => {
  it('cambia de pieza una vez por vuelta del badge', async () => {
    await import('../src/lib/carousel');
    await import('../src/lib/reflect-anim');

    const root = document.querySelector<HTMLElement>('[data-reflect]')!;

    // Mitad del ciclo: solo cambió la foto, no la pieza.
    vi.advanceTimersByTime(2000);
    expect(root.querySelector('[data-reflect-label]')!.textContent).toBe('Normal en:');
    expect(scrolls).toHaveLength(0);

    // Vuelta completa: ahora sí pasa a la siguiente pieza.
    vi.advanceTimersByTime(2000);
    expect(root.querySelector('[data-reflect-label]')!.textContent).toBe('Reflectivo en:');
    expect(scrolls.length).toBeGreaterThan(0);
  });
});
