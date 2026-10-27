// @vitest-environment happy-dom
/**
 * Varias tarjetas a la vez, como en /tienda.
 *
 * Cada pieza tiene su propio badge y su propio carrusel. Si el ciclo es
 * global (o si `rotates` mueve el índice compartido), unas piezas pisan a
 * otras y las fotos no cambian como deben.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const slugs = ['jeans-gris', 'jeans-morado', 'azul-acero', 'aurora', 'naranja'];

function card(slug: string, photos: string[]) {
  return `
    <div class="product-card-wrap" data-slug="${slug}">
      <a href="/producto/${slug}" class="block">
        <div class="product-frame" data-reflect="1" data-reflect-flash="1"
             data-reflect-ms="1000" data-reflect-rotates="1">
          <span class="reflect-badge is-lit" data-reflect-badge
                data-label="Reflectivo en:" data-label-normal="Normal en:">
            <span class="reflect-badge-label" data-reflect-label>Reflectivo en:</span>
            <span class="reflect-badge-count" data-reflect-count>2</span>
          </span>
          <div class="card-carousel" data-carousel-scope>
            <div class="card-track" data-carousel-track>
              ${photos.map((p) => `<div class="card-slide" data-carousel-slide><img src="${p}"></div>`).join('')}
            </div>
            <button type="button" data-carousel-dir="-1"></button>
            <button type="button" data-carousel-dir="1"></button>
            <div class="card-dots">
              ${photos.map((_, i) => `<span class="card-dot${i === 0 ? ' is-active' : ''}" data-carousel-dot="${i}"></span>`).join('')}
            </div>
          </div>
        </div>
      </a>
    </div>`;
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  delete (window as any).__dspReflectAnim;

  document.body.innerHTML = slugs
    .map((s) => card(s, ['a.jpg', 'flash.jpg', 'b.jpg']))
    .join('');

  Element.prototype.getBoundingClientRect = () =>
    ({ top: 10, bottom: 400, left: 0, right: 300, width: 300, height: 390, x: 0, y: 10,
       toJSON: () => ({}) }) as DOMRect;

  document.querySelectorAll<HTMLElement>('[data-carousel-track]').forEach((track) => {
    Object.defineProperty(track, 'offsetWidth', { value: 300, configurable: true });
    track.querySelectorAll<HTMLElement>('[data-carousel-slide]').forEach((s, i) => {
      Object.defineProperty(s, 'offsetLeft', { value: i * 300, configurable: true });
      Object.defineProperty(s, 'offsetWidth', { value: 300, configurable: true });
    });
    track.scrollTo = ((opts: { left?: number }) => {
      Object.defineProperty(track, 'scrollLeft', { value: opts?.left ?? 0, configurable: true });
      track.dispatchEvent(new Event('scroll'));
    }) as typeof track.scrollTo;
  });
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

const stateOf = (slug: string) => {
  const wrap = document.querySelector<HTMLElement>(`[data-slug="${slug}"]`)!;
  const track = wrap.querySelector<HTMLElement>('[data-carousel-track]')!;
  const label = wrap.querySelector('[data-reflect-label]')!.textContent;
  const count = wrap.querySelector('[data-reflect-count]')!.textContent;
  const activeDot = [...wrap.querySelectorAll('[data-carousel-dot]')].findIndex((d) =>
    d.classList.contains('is-active')
  );
  return { label, count, activeDot, scrollLeft: track.scrollLeft };
};

describe('varias tarjetas en /tienda', () => {
  it('todas cambian de foto al mismo tiempo', async () => {
    await import('../src/lib/carousel');
    await import('../src/lib/reflect-anim');

    vi.advanceTimersByTime(2000);

    for (const slug of slugs) {
      const s = stateOf(slug);
      expect(s.label, slug).toBe('Normal en:');
      expect(s.activeDot, slug).toBe(1);
      expect(s.scrollLeft, slug).toBe(300);
    }
  });

  it('todas vuelven a la portada al cerrar la vuelta', async () => {
    await import('../src/lib/carousel');
    await import('../src/lib/reflect-anim');

    vi.advanceTimersByTime(4000);

    for (const slug of slugs) {
      const s = stateOf(slug);
      expect(s.label, slug).toBe('Reflectivo en:');
      expect(s.activeDot, slug).toBe(0);
    }
  });
});
