import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  COUNT_FROM,
  COUNT_STEP_MS,
  HOLD_MS,
  ROTATION_MS,
} from '../src/lib/reflect-timing';

/**
 * Una sola fuente de timing.
 *
 * Antes el intervalo vivía duplicado en `carousel.ts` y `HeroCarousel.astro`
 * y el reflejo tenía sus propias constantes: cambiar una desalineaba las
 * demás. Ahora todo sale de `reflect-timing.ts`.
 */
const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

describe('reflect-timing', () => {
  it('cuenta + encendido cubren exactamente la vuelta del carrusel', () => {
    expect(COUNT_FROM * COUNT_STEP_MS + HOLD_MS).toBe(ROTATION_MS);
  });

  it('la cuenta son 2 números de un segundo y un encendido visible', () => {
    expect(COUNT_FROM).toBe(2);
    expect(COUNT_STEP_MS).toBeGreaterThanOrEqual(900);
    expect(HOLD_MS).toBeGreaterThan(COUNT_STEP_MS);
  });
});

describe('nadie duplica el intervalo', () => {
  it('carousel.ts lo toma del módulo compartido', () => {
    const source = read('src/lib/carousel.ts');
    expect(source).toContain('ROTATION_MS');
    // No debe quedar un número suelto con el valor del intervalo.
    expect(source).not.toMatch(/DEFAULT_INTERVAL\s*=\s*\d+/);
  });

  it('el hero lo toma del módulo compartido', () => {
    const source = read('src/components/hero/HeroCarousel.astro');
    expect(source).toContain("import { COUNT_STEP_MS, ROTATION_MS }");
    expect(source).not.toMatch(/SLIDE_MS\s*=\s*\d{3,}/);
    expect(source).not.toMatch(/REFLECT_MS\s*=\s*\d{3,}/);
  });

  it('reflect-anim.ts no tiene intervalos propios', () => {
    const source = read('src/lib/reflect-anim.ts');
    expect(source).toContain('reflect-timing');
    expect(source).not.toMatch(/HOLD_MS\s*=\s*\d{3,}/);
    expect(source).not.toMatch(/DEFAULT_MS\s*=\s*\d{3,}/);
  });
});

describe('el encendido no reinicia la cuenta', () => {
  it('el cambio provocado por el reflejo se ignora', () => {
    const source = read('src/lib/reflect-anim.ts');

    // El propio cambio de foto del reflejo dispara `carousel:changed`; sin
    // este cortafuegos el badge amarillo volvía a mostrar un "2".
    expect(source).toContain('settling');
    expect(source).toMatch(/if \(settling\) return;/);
  });
});
