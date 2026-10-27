import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Regresión: `data-reflect` es el atributo que enciende todo el sistema
 * del reflejo. Astro **omite** un atributo `data-*` cuando el valor es la
 * cadena vacía, así que `data-reflect={x ? '' : undefined}` desaparecía del
 * HTML y el controlador no registraba ninguna pieza.
 *
 * Debe tener un valor real (`"1"`).
 */
const files = [
  'src/components/hero/HeroCarousel.astro',
  'src/components/product/ProductCard.astro',
  'src/pages/producto/[slug].astro',
];

describe('atributo data-reflect', () => {
  it('nunca se emite con valor vacío (Astro lo eliminaría)', () => {
    for (const rel of files) {
      const source = readFileSync(join(process.cwd(), rel), 'utf8');

      // `data-reflect={... ? '' : undefined}` → el atributo no llega al HTML.
      expect(source, `${rel} emite data-reflect vacío`).not.toMatch(
        /data-reflect=\{[^}]*\?\s*''\s*:/
      );
    }
  });

  it('usa un valor no vacío', () => {
    for (const rel of files) {
      const source = readFileSync(join(process.cwd(), rel), 'utf8');
      const match = source.match(/data-reflect=\{[^}]*\?\s*([^:]+?)\s*:/);

      expect(match, `${rel} no tiene data-reflect condicional`).not.toBeNull();
      expect(match![1]).toMatch(/['"]1['"]/);
    }
  });
});
