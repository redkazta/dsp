import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  COUNT_FROM,
  COUNT_STEP_MS,
  PHASE_MS,
  ROTATION_MS,
} from '../src/lib/reflect-timing';
import { TICKS_PER_ROTATION, isRotationTick } from '../src/lib/reflect-clock';

/**
 * Una sola variable de tiempo, compartida.
 *
 * Antes había tres `setInterval` (carrusel, hero, reflejo) que derivaban.
 * Ahora `reflect-clock` late cada segundo y todos leen el mismo contador.
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
    expect(TICKS_PER_ROTATION).toBe(4);
  });

  it('toca avanzar de pieza una vez por vuelta', () => {
    expect(isRotationTick(0)).toBe(false);
    expect(isRotationTick(1)).toBe(false);
    expect(isRotationTick(2)).toBe(false);
    expect(isRotationTick(3)).toBe(false);
    expect(isRotationTick(4)).toBe(true);
    expect(isRotationTick(8)).toBe(true);
  });
});

describe('todos leen el mismo reloj', () => {
  it('el carrusel se suscribe al reloj compartido', () => {
    const source = read('src/lib/carousel.ts');
    expect(source).toContain('onTick');
    expect(source).toContain('isRotationTick');
  });

  it('el hero se suscribe al reloj compartido', () => {
    const source = read('src/components/hero/HeroCarousel.astro');
    expect(source).toContain('onTick');
    expect(source).toContain('isRotationTick');
  });

  it('el reflejo se suscribe al reloj compartido', () => {
    const source = read('src/lib/reflect-anim.ts');
    expect(source).toContain('onTick');
    // Ya no abre intervalos propios.
    expect(source).not.toMatch(/setInterval\(/);
  });

  it('nadie más tiene un intervalo de rotación', () => {
    for (const rel of ['src/lib/carousel.ts', 'src/components/hero/HeroCarousel.astro']) {
      expect(read(rel), rel).not.toMatch(/setInterval\(\s*(next|tick)/);
    }
  });
});
