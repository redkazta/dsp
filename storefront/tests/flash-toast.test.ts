import { describe, expect, it } from 'vitest';
import { getCopy } from '../src/lib/i18n';

/**
 * El aviso flotante ("Producto añadido al carrito") vive en `lib/flash-toast.ts`
 * y lee sus textos de `product.*`. Aquí se fija el contrato:
 * existen en los dos idiomas y el inglés no usa palabras en español.
 */
describe('avisos flotantes de carrito y favoritos', () => {
  for (const lang of ['es', 'en'] as const) {
    it(`${lang}: define los cuatro títulos`, () => {
      const p = getCopy(lang).product;
      expect(p.cartAddedTitle.trim().length).toBeGreaterThan(0);
      expect(p.wishAddedTitle.trim().length).toBeGreaterThan(0);
      expect(p.wishRemovedTitle.trim().length).toBeGreaterThan(0);
      expect(p.addedTitle.trim().length).toBeGreaterThan(0);
    });
  }

  it('español: habla de producto, carrito y favoritos', () => {
    const p = getCopy('es').product;
    expect(p.cartAddedTitle).toMatch(/producto/i);
    expect(p.cartAddedTitle).toMatch(/carrito/i);
    expect(p.wishAddedTitle).toMatch(/favoritos/i);
  });

  it('inglés: habla de product, cart y wishlist', () => {
    const p = getCopy('en').product;
    expect(p.cartAddedTitle).toMatch(/product/i);
    expect(p.cartAddedTitle).toMatch(/cart/i);
    expect(p.wishAddedTitle).toMatch(/wishlist/i);
  });

  it('inglés: no se cuela español en los avisos', () => {
    const p = getCopy('en').product;
    for (const text of [p.cartAddedTitle, p.wishAddedTitle, p.wishRemovedTitle, p.addedTitle]) {
      expect(text).not.toMatch(/añad|carrito|favoritos|producto|eliminado/i);
    }
  });
});
