// @vitest-environment happy-dom
/**
 * Coordinación del reflejo con el avance de tanda del hero.
 *
 * El hero no usa `carousel.ts`: mueve el track con `translateX` cada 5 s.
 * Mientras una pieza está encendida, ese avance debe detenerse para que el
 * flash no aterrice en otra pieza.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

function mountHero() {
  document.body.innerHTML = `
    <div class="hero-carousel" data-hero-carousel data-hero-loop="0">
      <div class="hero-track" data-hero-track>
        <article class="hero-slide" data-hero-slide>
          <div class="hero-media" data-reflect="1" data-reflect-flash="1" data-reflect-ms="1000">
            <span class="reflect-badge" data-reflect-badge data-label="Reflectivo en…">
              <span class="reflect-badge-label" data-reflect-label>Reflectivo en…</span>
              <span class="reflect-badge-count" data-reflect-count>2</span>
              <span class="reflect-badge-dot"></span>
            </span>
            <img class="hero-photo is-active" data-hero-photo="0" src="plain.jpg">
            <img class="hero-photo" data-hero-photo="1" src="flash.jpg">
          </div>
        </article>
        <article class="hero-slide" data-hero-slide>
          <div class="hero-media">
            <img class="hero-photo is-active" data-hero-photo="0" src="other.jpg">
          </div>
        </article>
        <article class="hero-slide" data-hero-slide>
          <div class="hero-media">
            <img class="hero-photo is-active" data-hero-photo="0" src="third.jpg">
          </div>
        </article>
      </div>
    </div>`;
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  delete (window as any).__dspReflectAnim;
  mountHero();

  Element.prototype.getBoundingClientRect = () =>
    ({ top: 10, bottom: 400, left: 0, right: 300, width: 300, height: 390, x: 0, y: 10,
       toJSON: () => ({}) }) as DOMRect;
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('reflejo + hero', () => {
  it('el badge cuenta y el hero recibe la pausa al encenderse', async () => {
    const events: string[] = [];
    document.addEventListener('hero:pause', () => events.push('pause'));
    document.addEventListener('hero:resume', () => events.push('resume'));

    await import('../src/lib/reflect-anim');

    const media = document.querySelector<HTMLElement>('[data-reflect]')!;
    const badge = media.querySelector('.reflect-badge')!;
    const count = media.querySelector('[data-reflect-count]')!;

    // El componente del hero escucha `reflect:photo` (aquí se replica el
    // listener real de HeroCarousel.astro).
    document.querySelector('.hero-carousel')!.addEventListener('reflect:photo', (e) => {
      const target = Number((e as CustomEvent<{ index?: number }>).detail?.index);
      const box = (e.target as HTMLElement).closest('.hero-media');
      if (!box) return;
      const photos = [...box.querySelectorAll<HTMLElement>('[data-hero-photo]')];
      photos.forEach((p, i) => p.classList.toggle('is-active', i === target));
      box.classList.toggle('is-flash-photo', target === Number(box.dataset.reflectFlash ?? -1));
    });

    expect(count.textContent).toBe('2');

    vi.advanceTimersByTime(1000);
    expect(count.textContent).toBe('1');

    // Se enciende: pide pausa al hero y marca la foto con flash.
    vi.advanceTimersByTime(1000);
    expect(badge.classList.contains('is-lit')).toBe(true);
    expect(events).toContain('pause');
    expect(media.classList.contains('is-flash-photo')).toBe(true);
    expect(media.querySelectorAll('.hero-photo')[1].classList.contains('is-active')).toBe(true);

    // Al apagarse devuelve el control.
    vi.advanceTimersByTime(2500);
    expect(badge.classList.contains('is-lit')).toBe(false);
    expect(events).toContain('resume');
    expect(media.querySelectorAll('.hero-photo')[0].classList.contains('is-active')).toBe(true);
  });
});
