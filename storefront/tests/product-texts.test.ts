import { describe, expect, it } from 'vitest';
import { missingEnglish, productDescription, productName } from '../src/lib/product-texts';

const product = {
  name: 'Camisa ¡D$P! V3 Violet',
  name_en: 'D$P! V3 Violet Shirt',
  description: 'Camisa negra con logo reflextivo violeta.',
  description_en: 'Black shirt with a violet reflective logo.',
};

describe('productName', () => {
  it('muestra el español por defecto', () => {
    expect(productName(product, 'es')).toBe('Camisa ¡D$P! V3 Violet');
  });

  it('muestra el inglés cuando existe', () => {
    expect(productName(product, 'en')).toBe('D$P! V3 Violet Shirt');
  });

  it('cae al español si falta la traducción', () => {
    const sinTraduccion = { ...product, name_en: null };
    expect(productName(sinTraduccion, 'en')).toBe('Camisa ¡D$P! V3 Violet');
  });

  it('trata los espacios en blanco como vacío', () => {
    const vacio = { ...product, name_en: '   ' };
    expect(productName(vacio, 'en')).toBe('Camisa ¡D$P! V3 Violet');
  });

  it('no rompe con producto nulo', () => {
    expect(productName(null, 'en')).toBe('');
  });
});

describe('productDescription', () => {
  it('elige el idioma activo', () => {
    expect(productDescription(product, 'es')).toContain('Camisa negra');
    expect(productDescription(product, 'en')).toContain('Black shirt');
  });

  it('cae al español si falta', () => {
    expect(productDescription({ ...product, description_en: '' }, 'en')).toContain('Camisa negra');
  });
});

describe('missingEnglish', () => {
  it('detecta las traducciones pendientes', () => {
    expect(missingEnglish(product)).toEqual({ name: false, description: false });

    expect(missingEnglish({ name: 'X', description: 'Y' })).toEqual({
      name: true,
      description: true,
    });
  });
});
