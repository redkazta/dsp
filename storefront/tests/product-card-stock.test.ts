import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cardStockState } from '../src/lib/product-variants';

/**
 * Regresión del badge "Agotado" falso.
 *
 * `/carrito` y `/favoritos` pedían `product_variants(price)` — sin `stock`.
 * `ProductCard` sumaba `v.stock ?? 0`, el total daba 0 y la tarjeta anunciaba
 * Agotado aunque la pieza tuviera 196 unidades. Ausencia de dato no es stock 0.
 */
const violet = [
  { id: 'a', name: 'M · Negro', price: 35, stock: 50 },
  { id: 'b', name: 'XL · Negro', price: 35, stock: 50 },
  { id: 'c', name: 'S · Negro', price: 35, stock: 49 },
  { id: 'd', name: 'L · Negro', price: 35, stock: 47 },
];

describe('cardStockState', () => {
  it('no marca agotado cuando hay stock', () => {
    const state = cardStockState(violet);
    expect(state.stockKnown).toBe(true);
    expect(state.totalStock).toBe(196);
    expect(state.soldOut).toBe(false);
    expect(state.available).toHaveLength(4);
  });

  it('no marca agotado si la consulta no pidió stock', () => {
    const sinStock = violet.map(({ stock, ...rest }) => rest);
    const state = cardStockState(sinStock);
    expect(state.stockKnown).toBe(false);
    expect(state.soldOut).toBe(false);
    // Sin dato no se ofrece añadir: el cliente entra a la ficha.
    expect(state.available).toHaveLength(0);
  });

  it('marca agotado solo cuando todas las variantes están en 0', () => {
    const state = cardStockState([
      { id: 'a', price: 35, stock: 0 },
      { id: 'b', price: 35, stock: 0 },
    ]);
    expect(state.stockKnown).toBe(true);
    expect(state.totalStock).toBe(0);
    expect(state.soldOut).toBe(true);
  });

  it('ignora variantes borradas al sumar y al ofrecer', () => {
    const state = cardStockState([
      { id: 'a', price: 35, stock: 0, is_deleted: false },
      { id: 'b', price: 35, stock: 50, is_deleted: true },
    ]);
    expect(state.totalStock).toBe(0);
    expect(state.soldOut).toBe(true);
    expect(state.available.map((v: any) => v.id)).toEqual([]);
  });

  it('no rompe con variantes vacías o nulas', () => {
    for (const raw of [null, undefined, [], 'x', 0]) {
      expect(cardStockState(raw).soldOut).toBe(false);
    }
  });
});

describe('consultas de sugerencias', () => {
  const read = (p: string) => readFileSync(new URL(`../src/pages/${p}`, import.meta.url), 'utf8');

  it('el carrito pide stock para pintar las tarjetas', () => {
    const src = read('carrito.astro');
    expect(src).toContain('product_variants(id, name, size, color, price, stock)');
    expect(src).not.toContain('product_variants(price)');
  });

  it('favoritos pide stock para pintar las sugerencias', () => {
    const src = read('favoritos.astro');
    expect(src).toContain('product_variants(id, name, size, color, price, stock)');
    expect(src).not.toContain('product_variants(price)');
  });
});
