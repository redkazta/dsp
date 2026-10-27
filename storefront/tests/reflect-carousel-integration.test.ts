// @vitest-environment happy-dom
/**
 * Integración real: reflejo + carrusel sobre el mismo DOM.
 *
 * El reflejo cambia de foto pulsando los puntos que controla `carousel.ts`.
 * Aquí se comprueba que, mientras la pieza está encendida, el avance
 * automático del carrusel no la mueve a otra foto.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

function mount() {
  document.body.innerHTML = `
    <div class="card-carousel" data-carousel-scope>
      <div class="card-track" data-carousel-track>
        <div class="card-slide" data-carousel-slide>
          <img src="plain.jpg">
        </div>
        <div class="card-slide" data-carousel-slide>
          <img src="flash.jpg">
        </div>
      </div>

      <div data-reflect data-reflect-flash="1" data-reflect-ms="1000">
        <span class="reflect-badge" data-reflect-badge data-label="Reflectivo en…">
          <span class="reflect-badge-label" data-reflect-label>Reflectivo en…</span>
          <span class="reflect-badge-count" data-reflect-count>2</span>
          <span class="reflect-badge-dot"></span>
        </span>
      </div>

      <span class="card-dot is-active" data-carousel-dot="0"></span>
      <span class="card-dot" data-carousel-dot="1"></span>
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

  // Como un navegador real: mover el scroll actualiza `scrollLeft` y emite
  // `scroll`, que es lo que hace que el carrusel repinte el índice.
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
  it('el autoplay no mueve el carrusel mientras el reflejo está encendido', async () => {
    await import('../src/lib/carousel');
    await import('../src/lib/reflect-anim');

    const root = document.querySelector<HTMLElement>('[data-reflect]')!;
    const badge = root.querySelector('.reflect-badge')!;

    // 1 s → cuenta en 1
    vi.advanceTimersByTime(1000);
    // 1 s → se enciende: el reflejo pide el punto 1 (foto con flash)
    vi.advanceTimersByTime(1000);

    expect(badge.classList.contains('is-lit')).toBe(true);

    // Durante el encendido el autoplay está en pausa: no debe haber dos
    // movimientos peleando (el reflejo pide el flash; el autoplay, el otro).
    const afterLight = scrolls.length;
    vi.advanceTimersByTime(1500);
    expect(scrolls.length).toBe(afterLight);
    expect(badge.classList.contains('is-lit')).toBe(true);

    // Al apagarse vuelve a la portada y el autoplay recupera su ritmo.
    vi.advanceTimersByTime(2600);
    expect(badge.classList.contains('is-lit')).toBe(false);
  });

  it('estando en amarillo el número no se reinicia', async () => {
    await import('../src/lib/carousel');
    await import('../src/lib/reflect-anim');

    const root = document.querySelector<HTMLElement>('[data-reflect]')!;
    const badge = root.querySelector('.reflect-badge')!;
    const count = root.querySelector('[data-reflect-count]')!;

    // Se enciende (2 → 1 → flash).
    vi.advanceTimersByTime(2000);
    expect(badge.classList.contains('is-lit')).toBe(true);

    const countAtLight = count.textContent;

    // El encendido pulsa el punto del flash, y eso emite `carousel:changed`.
    // Ese cambio NO debe reiniciar la cuenta: si lo hiciera, el badge
    // volvería a "2" y el número se quedaría dando vueltas en amarillo.
    const label = root.querySelector('[data-reflect-label]')!.textContent;
    const seen: string[] = [];
    const spy = setInterval(() => seen.push(String(count.textContent)), 250);

    vi.advanceTimersByTime(2000);
    clearInterval(spy);

    expect(badge.classList.contains('is-lit')).toBe(true);
    expect(label).toBe(root.querySelector('[data-reflect-label]')!.textContent);
    // Nunca apareció un "2" nuevo mientras estaba encendido.
    expect(seen.filter((n) => n === '2')).toHaveLength(0);
    expect(count.textContent).toBe(countAtLight);
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
