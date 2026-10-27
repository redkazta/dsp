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
 * Reparto de responsabilidades:
 *
 *   reflect-clock     el único `setInterval`; una variable compartida
 *   reflect-anim      el badge: cuenta y cambia la foto de la pieza
 *   HeroCarousel      avanza las piezas, leyendo el mismo reloj
 *   carousel          sin reloj: solo flechas, puntos y miniaturas
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
    expect([0, 1, 2, 3].map(isRotationTick)).toEqual([false, false, false, false]);
    expect(isRotationTick(4)).toBe(true);
    expect(isRotationTick(8)).toBe(true);
  });
});

describe('un solo reloj en toda la app', () => {
  it('solo reflect-clock abre un intervalo', () => {
    const files = [
      'src/lib/carousel.ts',
      'src/lib/reflect-anim.ts',
      'src/components/hero/HeroCarousel.astro',
    ];

    for (const rel of files) {
      const code = read(rel)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');

      expect(code, `${rel} no debe abrir su propio setInterval`).not.toMatch(
        /setInterval\(/
      );
    }

    expect(read('src/lib/reflect-clock.ts')).toMatch(/setInterval\(/);
  });

  it('el carrusel de fotos no tiene reloj ni avance automático', () => {
    const source = read('src/lib/carousel.ts');

    // Se ignoran los comentarios: el archivo puede mencionar `setInterval`
    // explicando por qué ya no lo usa.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    expect(code).not.toMatch(/onTick/);
    expect(code).not.toMatch(/setInterval/);
    expect(code).not.toMatch(/clearInterval/);
  });

  it('el hero avanza las piezas leyendo el reloj compartido', () => {
    const source = read('src/components/hero/HeroCarousel.astro');

    expect(source).toContain('onTick');
    expect(source).toContain('isRotationTick');
  });

  it('el badge manda el cambio de foto y lee el mismo reloj', () => {
    const source = read('src/lib/reflect-anim.ts');

    expect(source).toContain('onTick');
    expect(source).toContain('showPhoto');
  });
});
