import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * La navegación de móvil es un panel propio, no una lista colgada del header.
 *
 * Vive fuera del `<header>` porque ese header usa `backdrop-filter`: dentro,
 * un `position: fixed` se ancla al header en vez de a la pantalla.
 */
const layout = readFileSync(new URL('../src/layouts/BaseLayout.astro', import.meta.url), 'utf8');

describe('navegación móvil', () => {
  it('el panel cuelga del body, no del header', () => {
    const headerEnd = layout.indexOf('</header>');
    const menu = layout.indexOf('id="mobile-menu"');
    expect(headerEnd).toBeGreaterThan(0);
    expect(menu).toBeGreaterThan(headerEnd);
  });

  it('es un diálogo con backdrop y botón de cierre', () => {
    expect(layout).toContain('class="mobile-nav-panel" role="dialog" aria-modal="true"');
    expect(layout).toContain('class="mobile-nav-backdrop"');
    expect(layout).toContain('class="mobile-nav-close" data-nav-close');
  });

  it('lleva cuenta, enlaces, accesos rápidos y buscador', () => {
    expect(layout).toContain('class="mobile-nav-account"');
    expect(layout).toContain('class="mobile-nav-link"');
    expect(layout).toContain('data-open-drawer="wishlist"');
    expect(layout).toContain('data-open-drawer="cart"');
    expect(layout).toContain('id="mobile-search-open"');
    expect(layout).toContain('class="mobile-nav-secondary"');
  });

  it('conserva los contadores que pinta el header', () => {
    expect(layout).toContain('id="mobile-cart-count"');
    expect(layout).toContain('id="mobile-wish-count"');
  });

  it('cierra con Escape, con el backdrop y al navegar', () => {
    expect(layout).toContain("if (e.key === 'Escape')");
    expect(layout).toContain("menu.querySelectorAll<HTMLElement>('[data-nav-close]')");
    expect(layout).toContain("menu.querySelectorAll('a[href]')");
  });

  it('bloquea el scroll y respeta reduce-motion', () => {
    expect(layout).toContain("document.body.style.overflow = 'hidden'");
    expect(layout).toContain('prefers-reduced-motion: reduce');
  });
});
