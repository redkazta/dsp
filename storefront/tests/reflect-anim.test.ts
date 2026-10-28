// @vitest-environment happy-dom
/**
 * Ciclo del badge sobre una tarjeta del catálogo.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

function mountCard() {
  document.body.innerHTML = `
    <div class="product-frame" data-reflect="1" data-reflect-flash="1">
      <span class="reflect-badge is-lit" data-reflect-badge
            data-label="Reflectivo en:" data-label-normal="Normal en:">
        <span class="reflect-badge-label" data-reflect-label>Reflectivo en:</span>
        <span class="reflect-badge-count" data-reflect-count>2</span>
        <span class="reflect-badge-dot"></span>
      </span>
      <div class="card-carousel" data-carousel-scope>
        <div class="card-track" data-carousel-track>
          <div class="card-slide" data-carousel-slide><img src="a.jpg"></div>
          <div class="card-slide" data-carousel-slide><img src="b.jpg"></div>
        </div>
        <span class="card-dot is-active" data-carousel-dot="0"></span>
        <span class="card-dot" data-carousel-dot="1"></span>
        <button type="button" data-carousel-thumb="0"></button>
        <button type="button" data-carousel-thumb="1"></button>
      </div>
    </div>`;
}

const countOf = (root: HTMLElement) =>
  root.querySelector('[data-reflect-count]')?.textContent ?? null;
const labelOf = (root: HTMLElement) =>
  root.querySelector('[data-reflect-label]')?.textContent ?? null;

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  delete (window as any).__dspReflectAnim;
  mountCard();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('reflect-anim', () => {
  it('cuenta 2 → 1 y alterna Reflectivo / Normal', async () => {
    await import('../src/lib/reflect-anim');

    const root = document.querySelector<HTMLElement>('[data-reflect]')!;
    const badge = root.querySelector('.reflect-badge')!;

    const thumbs: number[] = [];
    root.querySelectorAll<HTMLElement>('[data-carousel-thumb]').forEach((t, i) =>
      t.addEventListener('click', () => thumbs.push(i))
    );

    expect(labelOf(root)).toBe('Reflectivo en:');
    expect(countOf(root)).toBe('2');
    expect(badge.classList.contains('is-lit')).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(countOf(root)).toBe('1');

    // Se acaba la fase: salta la foto con flash y la etiqueta cambia.
    vi.advanceTimersByTime(1000);
    expect(thumbs).toContain(1);
    expect(labelOf(root)).toBe('Normal en:');
    expect(countOf(root)).toBe('2');
    expect(badge.classList.contains('is-lit')).toBe(false);
    expect(root.querySelectorAll('img')[1].classList.contains('is-flash-photo')).toBe(true);

    // Y al cerrar la vuelta vuelve a la vista sin flash.
    vi.advanceTimersByTime(2000);
    expect(labelOf(root)).toBe('Reflectivo en:');
    expect(badge.classList.contains('is-lit')).toBe(true);
  });

  it('no arranca sin la foto con reflejo', async () => {
    document.body.innerHTML = '<div data-reflect><img></div>';
    await import('../src/lib/reflect-anim');

    const root = document.querySelector<HTMLElement>('[data-reflect]')!;
    vi.advanceTimersByTime(6000);
    expect(root.querySelector('.reflect-badge')).toBeNull();
  });

  it('sigue contando aunque el mouse esté sobre la tarjeta', async () => {
    await import('../src/lib/reflect-anim');

    const root = document.querySelector<HTMLElement>('[data-reflect]')!;
    root.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse', bubbles: true }));

    vi.advanceTimersByTime(1000);
    expect(countOf(root)).toBe('1');
  });

  it('un click manual del usuario retrasa el ciclo', async () => {
    await import('../src/lib/reflect-anim');

    const root = document.querySelector<HTMLElement>('[data-reflect]')!;
    root.querySelector<HTMLElement>('[data-carousel-thumb="0"]')!.click();

    // Tras el click se pausa: a los 2 s sigue en "2".
    vi.advanceTimersByTime(2000);
    expect(countOf(root)).toBe('2');
  });
});
