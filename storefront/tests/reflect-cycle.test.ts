// @vitest-environment happy-dom
/**
 * Un solo reloj: el badge del reflejo es el cronómetro de todo.
 *
 *   Reflectivo en: 2   foto A
 *   Reflectivo en: 1   foto A
 *            ↓ cambio de foto
 *   Normal en: 2       foto B (flash)
 *   Normal en: 1       foto B (flash)
 *            ↓ cambio de foto y de pieza
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
            <img class="hero-photo is-active" data-hero-photo="0" src="a.jpg">
            <img class="hero-photo" data-hero-photo="1" src="b.jpg">
          </div>
        </article>
      </div>
    </div>`;
}

const state = (root: HTMLElement) => {
  const label = root.querySelector('[data-reflect-label]')!.textContent;
  const count = root.querySelector('[data-reflect-count]')!.textContent;
  const photos = [...root.querySelectorAll('.hero-photo')];
  const active = photos.findIndex((p) => p.classList.contains('is-active'));
  return `${label} ${count} (foto ${active})`;
};

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

describe('ciclo del badge', () => {
  it('alterna Reflectivo/Normal con la cuenta de 2 a 1', async () => {
    await import('../src/lib/reflect-anim');

    const root = document.querySelector<HTMLElement>('[data-reflect]')!;
    const badge = root.querySelector('.reflect-badge')!;

    expect(state(root)).toBe('Reflectivo en: 2 (foto 0)');
    expect(badge.classList.contains('is-lit')).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(state(root)).toBe('Reflectivo en: 1 (foto 0)');

    // Cambia de foto: aparece la toma con flash y la etiqueta pasa a Normal.
    vi.advanceTimersByTime(1000);
    expect(state(root)).toBe('Normal en: 2 (foto 1)');
    expect(badge.classList.contains('is-lit')).toBe(false);
    expect(root.classList.contains('is-flash-photo')).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(state(root)).toBe('Normal en: 1 (foto 1)');

    // Vuelve a la portada y reinicia el ciclo.
    vi.advanceTimersByTime(1000);
    expect(state(root)).toBe('Reflectivo en: 2 (foto 0)');
    expect(badge.classList.contains('is-lit')).toBe(true);
    expect(root.classList.contains('is-flash-photo')).toBe(false);
  });

  it('avisa para que el carrusel pase de pieza al cerrar la vuelta', async () => {
    const rotates: number[] = [];
    document.addEventListener('reflect:rotate', () => rotates.push(Date.now()));

    await import('../src/lib/reflect-anim');

    // Rota 1 vez por vuelta completa, no en cada cambio de foto.
    vi.advanceTimersByTime(2000);
    expect(rotates).toHaveLength(0);

    vi.advanceTimersByTime(2000);
    expect(rotates).toHaveLength(1);

    vi.advanceTimersByTime(4000);
    expect(rotates).toHaveLength(2);
  });
});
