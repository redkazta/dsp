// @vitest-environment happy-dom
/**
 * Cuenta atrás del reflejo en una tarjeta del catálogo.
 *
 * El reflejo **solo cambia la foto dentro de la pieza**: nunca mueve el
 * carrusel de productos ni pausa su avance.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

function mountCard() {
  document.body.innerHTML = `
    <div class="product-frame" data-reflect="1" data-reflect-flash="1" data-reflect-ms="1000">
      <span class="reflect-badge" data-reflect-badge data-label="Reflectivo en…">
        <span class="reflect-badge-label" data-reflect-label>Reflectivo en…</span>
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
  it('cuenta 2 → 1 → encendido manteniendo el número visible', async () => {
    await import('../src/lib/reflect-anim');

    const root = document.querySelector<HTMLElement>('[data-reflect]')!;
    const badge = root.querySelector('.reflect-badge')!;
    const label = root.querySelector('[data-reflect-label]')!;

    // Pulsaciones en las miniaturas: es el único control que toca el reflejo.
    const thumbs: number[] = [];
    root.querySelectorAll<HTMLElement>('[data-carousel-thumb]').forEach((t, i) =>
      t.addEventListener('click', () => thumbs.push(i))
    );

    expect(countOf(root)).toBe('2');
    expect(badge.classList.contains('is-lit')).toBe(false);

    vi.advanceTimersByTime(1000);
    expect(countOf(root)).toBe('1');
    expect(badge.classList.contains('is-lit')).toBe(false);

    // Al llegar a cero: foto con flash y badge encendido.
    vi.advanceTimersByTime(1000);
    expect(thumbs).toContain(1);
    expect(badge.classList.contains('is-lit')).toBe(true);
    expect(root.querySelectorAll('img')[1].classList.contains('is-flash-photo')).toBe(true);

    // El número sigue visible y la etiqueta no cambia.
    expect(countOf(root)).toBe('1');
    expect(label.textContent).toBe('Reflectivo en…');

    // Aguanta todo el encendido sin reiniciarse.
    vi.advanceTimersByTime(1500);
    expect(badge.classList.contains('is-lit')).toBe(true);
    expect(countOf(root)).toBe('1');

    // Y vuelve a la portada.
    vi.advanceTimersByTime(1500);
    expect(badge.classList.contains('is-lit')).toBe(false);
    expect(countOf(root)).toBe('2');
    expect(root.querySelectorAll('img')[1].classList.contains('is-flash-photo')).toBe(false);
  });

  it('no arranca sin la foto con reflejo', async () => {
    document.body.innerHTML = '<div data-reflect data-reflect-ms="1000"><img></div>';
    await import('../src/lib/reflect-anim');

    const root = document.querySelector<HTMLElement>('[data-reflect]')!;
    vi.advanceTimersByTime(4000);
    expect(root.querySelector('.reflect-badge')).toBeNull();
  });

  it('sigue contando aunque el mouse esté sobre la tarjeta', async () => {
    await import('../src/lib/reflect-anim');

    const root = document.querySelector<HTMLElement>('[data-reflect]')!;
    const thumb = root.querySelector<HTMLElement>('[data-carousel-thumb="1"]')!;
    let calls = 0;
    thumb.addEventListener('click', () => calls++);

    root.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse', bubbles: true }));

    vi.advanceTimersByTime(2000);
    expect(calls).toBeGreaterThan(0);
  });

  it('no pausa ni mueve el carrusel de productos', async () => {
    const events: string[] = [];
    ['carousel:pause', 'hero:pause', 'carousel:changed'].forEach((name) =>
      document.addEventListener(name, () => events.push(name))
    );

    await import('../src/lib/reflect-anim');

    const dots: number[] = [];
    document
      .querySelectorAll<HTMLElement>('[data-carousel-dot]')
      .forEach((dot, i) => dot.addEventListener('click', () => dots.push(i)));

    vi.advanceTimersByTime(3000);

    // El reflejo cambia la foto, pero no toca el avance del carrusel.
    expect(events).toEqual([]);
    expect(dots).toEqual([]);
  });

  it('un click manual del usuario retrasa el ciclo', async () => {
    await import('../src/lib/reflect-anim');

    const root = document.querySelector<HTMLElement>('[data-reflect]')!;
    root.querySelector<HTMLElement>('[data-carousel-thumb="0"]')!.click();

    const thumb = root.querySelector<HTMLElement>('[data-carousel-thumb="1"]')!;
    let calls = 0;
    thumb.addEventListener('click', () => calls++);

    vi.advanceTimersByTime(2000);
    expect(calls).toBe(0);
  });
});
