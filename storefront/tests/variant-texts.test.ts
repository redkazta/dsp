import { describe, expect, it } from 'vitest';
import { colorLabel, sizeLabel, variantLabel } from '../src/lib/variant-texts';

/**
 * La base guarda tallas y colores en español. En la tienda en inglés no debe
 * aparecer "XL · Negro": el valor crudo sigue siendo el mismo para encontrar
 * la variante, pero la etiqueta se traduce.
 */
describe('colorLabel', () => {
  it('traduce los colores del catálogo', () => {
    expect(colorLabel('Negro', 'en')).toBe('Black');
    expect(colorLabel('Gris metálico', 'en')).toBe('Metallic grey');
    expect(colorLabel('Morado', 'en')).toBe('Purple');
    expect(colorLabel('Naranja', 'en')).toBe('Orange');
  });

  it('deja el español intacto', () => {
    expect(colorLabel('Gris metálico', 'es')).toBe('Gris metálico');
  });

  it('no rompe con vacíos ni colores desconocidos', () => {
    expect(colorLabel(null, 'en')).toBe('');
    expect(colorLabel('Fucsia', 'en')).toBe('Fucsia');
  });
});

describe('sizeLabel', () => {
  it('traduce Unitalla', () => {
    expect(sizeLabel('Unitalla', 'en')).toBe('One size');
    expect(sizeLabel('Unitalla', 'es')).toBe('Unitalla');
  });

  it('deja las tallas numéricas y letras igual', () => {
    expect(sizeLabel('XL', 'en')).toBe('XL');
    expect(sizeLabel('S', 'en')).toBe('S');
  });
});

describe('variantLabel', () => {
  it('traduce la etiqueta completa', () => {
    expect(variantLabel({ name: 'XL · Negro' }, 'en')).toBe('XL · Black');
    expect(variantLabel({ name: 'Unitalla · Gris metálico' }, 'en')).toBe(
      'One size · Metallic grey'
    );
  });

  it('arma la etiqueta con talla y color si falta el nombre', () => {
    expect(variantLabel({ size: 'M', color: 'Negro' }, 'en')).toBe('M · Black');
  });

  it('en español conserva el nombre tal cual', () => {
    expect(variantLabel({ name: 'Unitalla · Gris metálico' }, 'es')).toBe(
      'Unitalla · Gris metálico'
    );
  });

  it('no rompe con valores nulos', () => {
    expect(variantLabel(null, 'en')).toBe('');
    expect(variantLabel({}, 'en')).toBe('');
  });
});
