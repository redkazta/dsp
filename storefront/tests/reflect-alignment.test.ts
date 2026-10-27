import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * El reflejo y el autoplay del carrusel deben durar lo mismo.
 *
 * Si el reflejo tarda 4.2 s y el carrusel avanza cada 4.5 s, cada vuelta
 * acumula 0.3 s de desfase y en pocas repeticiones el encendido ya no cae
 * junto con el cambio de pieza. Aquí se vigila que los números cuadren.
 */
const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

function numberNear(source: string, name: string): number {
  const match = source.match(new RegExp(`const ${name}\\s*=\\s*(\\d+)`));
  expect(match, `no se encontró ${name}`).not.toBeNull();
  return Number(match![1]);
}

describe('alineación reflejo / carrusel', () => {
  it('cuenta + encendido duran el intervalo del carrusel', () => {
    const reflect = read('src/lib/reflect-anim.ts');
    const carousel = read('src/lib/carousel.ts');

    const tick = numberNear(reflect, 'DEFAULT_MS');
    const hold = numberNear(reflect, 'HOLD_MS');
    const countFrom = numberNear(reflect, 'COUNT_FROM');
    const interval = numberNear(carousel, 'DEFAULT_INTERVAL');

    // 2 s de cuenta (2 ticks) + el encendido.
    expect(countFrom * tick + hold).toBe(interval);
  });

  it('el carrusel avisa cuando cambia de foto', () => {
    const carousel = read('src/lib/carousel.ts');
    expect(carousel).toContain('carousel:changed');
  });

  it('el reflejo reinicia su cuenta al cambiar el carrusel', () => {
    const reflect = read('src/lib/reflect-anim.ts');
    expect(reflect).toContain("document.addEventListener('carousel:changed'");
  });
});
