import { describe, expect, it } from 'vitest';

/**
 * Contrato del feedback de validación (`lib/ux.ts`).
 *
 * El módulo toca el DOM, así que aquí se fija lo que se puede comprobar sin
 * navegador: que exporte las piezas esperadas y que sea seguro llamarlas
 * con `null` (cualquier página puede no tener el elemento).
 */
describe('ux helpers', () => {
  it('exporta las cinco funciones del sistema', async () => {
    const ux = await import('../src/lib/ux');
    for (const fn of ['nudge', 'nudgeGroup', 'alert', 'busy', 'confirm']) {
      expect(typeof (ux as any)[fn]).toBe('function');
    }
  });

  it('no lanza si el elemento no existe', async () => {
    const ux = await import('../src/lib/ux');
    expect(() => ux.nudge(null)).not.toThrow();
    expect(() => ux.alert(null, 'mensaje')).not.toThrow();
    expect(() => ux.confirm(null)).not.toThrow();
    expect(() => ux.busy(null, 'cargando')).not.toThrow();
  });

  it('alert sin mensaje no hace nada', async () => {
    const ux = await import('../src/lib/ux');
    const cleanup = ux.alert(null, '');
    expect(typeof cleanup).toBe('function');
  });
});
