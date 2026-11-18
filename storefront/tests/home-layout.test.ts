import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * `/` ya no es un carrusel suelto a pantalla completa: es una portada con
 * jerarquía (h1), catálogo y footer. Si alguien vuelve a dejarla en una sola
 * sección sin scroll, esto falla.
 */
const home = readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');

describe('portada', () => {
  it('tiene un h1 real y texto de entrada', () => {
    expect(home).toContain('<h1');
    expect(home).toContain('t.home.heroText');
  });

  it('mantiene el carrusel pero en un escenario con alto propio', () => {
    expect(home).toContain('<HeroCarousel');
    expect(home).toContain('class="home-stage"');
    expect(home).toContain('.home-stage');
  });

  it('muestra el catálogo con tarjetas, no solo el hero', () => {
    expect(home).toContain('<ProductList products={products}');
    expect(home).toContain('getProducts(TENANT_SLUG');
  });

  it('tiene garantías, categorías y bloque de marca', () => {
    expect(home).toContain('t.trust.shippingTitle');
    expect(home).toContain('class="cat-tile"');
    expect(home).toContain('t.home.craftTitle');
  });

  it('ya no se renderiza como pantalla única sin footer', () => {
    expect(home).not.toContain('homeScreen');
    expect(home).not.toContain('home-screen');
  });
});
