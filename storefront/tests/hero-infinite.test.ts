import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * El carrusel del inicio debe ser infinito.
 *
 * El track lleva la lista dos veces, así que la posición `total` muestra
 * exactamente las mismas piezas que la `0`. Si el corte se hace en
 * `total - perView`, al volver a 0 se ve un salto ("vuelve a empezar").
 */
const hero = readFileSync(
  join(process.cwd(), 'src/components/hero/HeroCarousel.astro'),
  'utf8'
);

describe('carrusel infinito del inicio', () => {
  it('avanza hasta la copia en lugar de cortar antes', () => {
    // Debe comparar contra `total`, no contra `total - perView`.
    expect(hero).toMatch(/if \(index >= total\)/);
    expect(hero).not.toMatch(/if \(index > max\)/);
  });

  it('se recoloca restando la vuelta, no saltando a cero', () => {
    expect(hero).toContain('index -= total;');
  });

  it('mantiene el track duplicado para que el salto sea invisible', () => {
    expect(hero).toContain('const rendered = loop ? [...list, ...list] : list;');
  });

  it('también cicla hacia atrás', () => {
    expect(hero).toContain('index += total;');
  });
});
