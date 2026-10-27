import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  COUNT_FROM,
  COUNT_STEP_MS,
  PHASE_MS,
  ROTATION_MS,
} from '../src/lib/reflect-timing';

/**
 * Un solo reloj para todo.
 *
 * Antes el carrusel y el hero tenían su propio `setInterval` y el reflejo
 * otro más: tres relojes que derivaban entre sí. Ahora el badge marca el
 * compás y los demás le obedecen.
 */
const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

describe('reflect-timing', () => {
  it('cada fase son 2 números de un segundo', () => {
    expect(COUNT_FROM).toBe(2);
    expect(COUNT_STEP_MS).toBe(1000);
    expect(PHASE_MS).toBe(COUNT_FROM * COUNT_STEP_MS);
  });

  it('la vuelta completa son dos fases', () => {
    expect(ROTATION_MS).toBe(PHASE_MS * 2);
  });
});

describe('un solo reloj', () => {
  it('el carrusel no tiene autoavance propio', () => {
    const source = read('src/lib/carousel.ts');

    // El avance llega por `reflect:rotate`, no por un intervalo.
    expect(source).toContain('reflect:rotate');
    expect(source).not.toMatch(/setInterval\(\(\) => \{\s*if \(focused/);
  });

  it('el hero no tiene avance propio', () => {
    const source = read('src/components/hero/HeroCarousel.astro');

    expect(source).toContain('reflect:rotate');
    expect(source).not.toMatch(/setInterval\(next/);
  });

  it('el reflejo es el único que marca el ritmo', () => {
    const source = read('src/lib/reflect-anim.ts');

    expect(source).toContain('reflect:rotate');
    expect(source).toContain('COUNT_STEP_MS');
  });
});
