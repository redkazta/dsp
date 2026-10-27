import { describe, expect, it } from 'vitest';
import { planReflectImages } from '../src/lib/reflective';

describe('planReflectImages', () => {
  it('una pieza reflectiva con foto flash anima', () => {
    const plan = planReflectImages(
      [
        { url: '/img/jeans/naranja/naranja-01-frente.jpg', position: 0 },
        { url: '/img/jeans/naranja/naranja-03-frente-flash.jpg', position: 1 },
      ],
      true
    );

    expect(plan.animatable).toBe(true);
    expect(plan.flashIndex).toBe(1);
    expect(plan.images).toHaveLength(2);
  });

  it('no anima si la prenda no está marcada', () => {
    const plan = planReflectImages(
      [
        { url: '/img/a-01.jpg', position: 0 },
        { url: '/img/a-03-flash.jpg', position: 1 },
      ],
      false
    );

    expect(plan.animatable).toBe(false);
  });

  it('no anima si falta la foto con flash', () => {
    const plan = planReflectImages([{ url: '/img/a-01.jpg', position: 0 }], true);
    expect(plan.animatable).toBe(false);
  });

  it('detecta flash en rutas con carpetas y guiones', () => {
    const plan = planReflectImages(
      [
        { url: '/img/jeans/gris-metalico/gris-metalico-01-frente.jpg', position: 0 },
        { url: '/img/jeans/gris-metalico/gris-metalico-03-frente-flash.jpg', position: 2 },
      ],
      true
    );

    expect(plan.animatable).toBe(true);
    expect(plan.flashIndex).toBe(1);
  });
});
