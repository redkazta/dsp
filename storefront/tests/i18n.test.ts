import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LANG,
  LANG_TOGGLE_LABEL,
  copy,
  getCopy,
  langFromAcceptHeader,
  normalizeLang,
} from '../src/lib/i18n';

/** Todas las hojas de un objeto como ["nav.tienda", "footer.terms", …]. */
function flattenKeys(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) return [prefix];
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      flattenKeys(v, prefix ? `${prefix}.${k}` : k)
    );
  }
  return [prefix];
}

describe('copy', () => {
  it('español e inglés exponen exactamente las mismas claves', () => {
    expect(flattenKeys(copy.en).sort()).toEqual(flattenKeys(copy.es).sort());
  });

  it('no deja textos vacíos', () => {
    for (const lang of ['es', 'en'] as const) {
      const values = flattenKeys(copy[lang]).map((path) =>
        path.split('.').reduce<any>((acc, key) => acc?.[key], copy[lang])
      );

      for (const value of values) {
        if (typeof value === 'string') expect(value.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('el toggle muestra el idioma de destino', () => {
    expect(LANG_TOGGLE_LABEL.es).toBe('ESP/EN');
    expect(LANG_TOGGLE_LABEL.en).toBe('ENG/ESP');
  });
});

describe('normalizeLang', () => {
  it('acepta valores válidos y cae al idioma por defecto', () => {
    expect(normalizeLang('es')).toBe('es');
    expect(normalizeLang('EN')).toBe('en');
    expect(normalizeLang(null)).toBe(DEFAULT_LANG);
    expect(normalizeLang('fr')).toBe('es');
  });
});

describe('langFromAcceptHeader', () => {
  it('elige el idioma soportado con más peso', () => {
    expect(langFromAcceptHeader('en-US,en;q=0.9,es;q=0.8')).toBe('en');
    expect(langFromAcceptHeader('fr;q=0.9,es-MX;q=0.8')).toBe('es');
    expect(langFromAcceptHeader('es-ES,es;q=0.9,en;q=0.8')).toBe('es');
  });

  it('sin cabecera usa el idioma por defecto', () => {
    expect(langFromAcceptHeader(null)).toBe('es');
    expect(langFromAcceptHeader('')).toBe('es');
  });
});

describe('getCopy', () => {
  it('devuelve el diccionario del idioma pedido', () => {
    expect(getCopy('en').nav.tienda).toBe('Shop');
    expect(getCopy('es').nav.tienda).toBe('Tienda');
    expect(getCopy('xx').nav.tienda).toBe('Tienda');
  });
});
