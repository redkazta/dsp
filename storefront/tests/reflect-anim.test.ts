// @vitest-environment happy-dom
/**
 * Verificación del ciclo del reflejo: el controlador debe alternar la foto
 * y marcar las clases que el CSS usa para el destello.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

function mountCard() {
  document.body.innerHTML = `
    <div class="product-frame" data-reflect data-reflect-flash="1" data-reflect-ms="2000">
      <span class="reflect-badge"><span class="reflect-badge-dot"></span></span>
      <div class="card-carousel" data-carousel-scope>
        <div class="card-track" data-carousel-track>
          <div class="card-slide" data-carousel-slide><img src="a.jpg"></div>
          <div class="card-slide" data-carousel-slide><img src="b.jpg"></div>
        </div>
        <span class="card-dot is-active" data-carousel-dot="0"></span>
        <span class="card-dot" data-carousel-dot="1"></span>
      </div>
    </div>`;
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  // El controlador se instala una sola vez por página.
  delete (window as any).__dspReflectAnim;
  mountCard();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('reflect-anim', () => {
  it('alterna la foto y marca el destello cada 2 s', async () => {
    await import('../src/lib/reflect-anim');

    const root = document.querySelector<HTMLElement>('[data-reflect]')!;
    const dots = [...root.querySelectorAll<HTMLElement>('[data-carousel-dot]')];
    const clicks: number[] = [];
    dots.forEach((dot, i) => dot.addEventListener('click', () => clicks.push(i)));

    vi.advanceTimersByTime(2000);

    // Pidió la foto con reflejo (índice 1).
    expect(clicks).toContain(1);

    // El badge se enciende y la foto lleva la clase del destello.
    expect(root.querySelector('.reflect-badge')!.classList.contains('is-lit')).toBe(true);
    expect(root.querySelectorAll('img')[1].classList.contains('is-flash-photo')).toBe(true);

    vi.advanceTimersByTime(2000);

    // Vuelve a la portada y apaga el badge.
    expect(root.querySelector('.reflect-badge')!.classList.contains('is-lit')).toBe(false);
    expect(root.querySelectorAll('img')[1].classList.contains('is-flash-photo')).toBe(false);
  });

  it('no arranca sin la foto con reflejo', async () => {
    document.body.innerHTML = '<div data-reflect data-reflect-ms="2000"><img></div>';
    await import('../src/lib/reflect-anim');

    const root = document.querySelector<HTMLElement>('[data-reflect]')!;
    vi.advanceTimersByTime(4000);
    expect(root.querySelector('.reflect-badge')).toBeNull();
  });

  it('sigue animando aunque el mouse esté sobre la tarjeta', async () => {
    await import('../src/lib/reflect-anim');

    const root = document.querySelector<HTMLElement>('[data-reflect]')!;
    const dot = root.querySelector<HTMLElement>('[data-carousel-dot="1"]')!;
    let calls = 0;
    dot.addEventListener('click', () => calls++);

    // En escritorio el puntero está casi siempre encima: no debe frenar.
    root.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse', bubbles: true }));

    vi.advanceTimersByTime(2000);
    expect(calls).toBeGreaterThan(0);
  });
});
