// @vitest-environment happy-dom
/**
 * Cuenta atrás del reflejo. El badge se ve igual en los tres estados:
 *
 *     Reflectivo en…      Reflectivo en…      Reflectivo en…
 *           2                   1                  (dorado)
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

function mountCard() {
  document.body.innerHTML = `
    <div class="product-frame" data-reflect data-reflect-flash="1" data-reflect-ms="1000">
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
      </div>
    </div>`;
}

const countOf = (root: HTMLElement) =>
  root.querySelector('[data-reflect-count]')?.textContent ?? null;

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
  it('cuenta 2 → 1 → encendido manteniendo el número visible', async () => {
    await import('../src/lib/reflect-anim');

    const root = document.querySelector<HTMLElement>('[data-reflect]')!;
    const badge = root.querySelector('.reflect-badge')!;
    const label = root.querySelector('[data-reflect-label]')!;
    const clicked: number[] = [];
    root
      .querySelectorAll<HTMLElement>('[data-carousel-dot]')
      .forEach((dot, i) => dot.addEventListener('click', () => clicked.push(i)));

    // Arranca en 2, sin encender.
    expect(countOf(root)).toBe('2');
    expect(badge.classList.contains('is-lit')).toBe(false);

    vi.advanceTimersByTime(1000);
    expect(countOf(root)).toBe('1');
    expect(badge.classList.contains('is-lit')).toBe(false);

    // Al llegar a cero: foto del reflejo y badge encendido.
    vi.advanceTimersByTime(1000);
    expect(clicked).toContain(1);
    expect(badge.classList.contains('is-lit')).toBe(true);
    expect(root.querySelectorAll('img')[1].classList.contains('is-flash-photo')).toBe(true);

    // El número SIGUE visible mientras está encendido (no desaparece) y la
    // etiqueta no cambia: el badge mide exactamente igual en los 3 estados.
    expect(root.querySelector('[data-reflect-count]')).not.toBeNull();
    expect(countOf(root)).not.toBeNull();
    expect(label.textContent).toBe('Reflectivo en…');

    // Se queda encendido: el encendido dura ~2.5 s (alineado con el
    // intervalo de 4.5 s del carrusel).
    vi.advanceTimersByTime(1500);
    expect(badge.classList.contains('is-lit')).toBe(true);
    expect(root.querySelector('[data-reflect-count]')).not.toBeNull();

    // …y al cumplirse vuelve a la portada reiniciando la cuenta.
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
    const dot = root.querySelector<HTMLElement>('[data-carousel-dot="1"]')!;
    let calls = 0;
    dot.addEventListener('click', () => calls++);

    // En escritorio el puntero está casi siempre encima: no debe frenar.
    root.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse', bubbles: true }));

    vi.advanceTimersByTime(2000);
    expect(calls).toBeGreaterThan(0);
  });

  it('un click manual del usuario retrasa el ciclo', async () => {
    await import('../src/lib/reflect-anim');

    const root = document.querySelector<HTMLElement>('[data-reflect]')!;
    root.querySelector<HTMLElement>('[data-carousel-dot="0"]')!.click();

    const dot = root.querySelector<HTMLElement>('[data-carousel-dot="1"]')!;
    let calls = 0;
    dot.addEventListener('click', () => calls++);

    vi.advanceTimersByTime(2000);
    expect(calls).toBe(0);
  });
  it('pausa el carrusel mientras el reflejo esta encendido', async () => {
    const seen: string[] = [];
    document.addEventListener('carousel:pause', () => seen.push('pause'));
    document.addEventListener('carousel:resume', () => seen.push('resume'));

    await import('../src/lib/reflect-anim');

    const root = document.querySelector<HTMLElement>('[data-reflect]')!;
    const scope = root.querySelector('.card-carousel')!;

    // El evento lleva el scope del carrusel para que solo se pause ese.
    document.addEventListener('carousel:pause', (e) => {
      expect((e as CustomEvent).detail).toBe(root);
    });

    vi.advanceTimersByTime(2000);
    expect(seen).toContain('pause');

    vi.advanceTimersByTime(2500);
    expect(seen).toContain('resume');
    void scope;
  });
});
