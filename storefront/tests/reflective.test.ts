import { describe, expect, it } from 'vitest';
import { planReflectImages } from '../src/lib/reflective';

const jeans = [
  { url: '/img/jeans/gris/gris-01-frente.jpg', position: 0 },
  { url: '/img/jeans/gris/gris-02-espalda.jpg', position: 1 },
  { url: '/img/jeans/gris/gris-03-frente-flash.jpg', position: 2 },
  { url: '/img/jeans/gris/gris-04-espalda-flash.jpg', position: 3 },
];

describe('planReflectImages', () => {
  it('conserva todas las fotos, también la espalda', () => {
    const plan = planReflectImages(jeans, true);

    expect(plan.images).toHaveLength(4);
    expect(plan.images.some((u) => u.includes('espalda'))).toBe(true);
    expect(plan.images.some((u) => u.includes('espalda-flash'))).toBe(true);
  });

  it('pone la portada primero y el flash segundo', () => {
    const plan = planReflectImages(jeans, true);

    expect(plan.images[0]).toContain('01-frente');
    expect(plan.images[1]).toContain('flash');
    expect(plan.flashIndex).toBe(1);
    expect(plan.animatable).toBe(true);
  });

  it('no repite fotos', () => {
    const plan = planReflectImages(jeans, true);
    expect(new Set(plan.images).size).toBe(plan.images.length);
  });

  it('una pieza sin flash conserva su galería y no anima', () => {
    const plan = planReflectImages([{ url: '/img/camisas/c-01-frente.jpg' }], true);

    expect(plan.images).toHaveLength(1);
    expect(plan.animatable).toBe(false);
    expect(plan.flashIndex).toBe(-1);
  });

  it('una pieza no reflectiva mantiene el orden original', () => {
    const plan = planReflectImages(jeans, false);

    expect(plan.images).toHaveLength(4);
    expect(plan.animatable).toBe(false);
  });
});
