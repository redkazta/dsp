import { describe, expect, it } from 'vitest';
import {
  FREE_SHIPPING_THRESHOLD,
  STANDARD_SHIPPING,
  round2,
  shippingCostFor,
  totalsFor,
  type PricedItem,
} from '../src/lib/pricing';

describe('shippingCostFor', () => {
  it('cobra envío estándar por debajo del umbral', () => {
    expect(shippingCostFor(0)).toBe(0);
    expect(shippingCostFor(599)).toBe(STANDARD_SHIPPING);
    expect(shippingCostFor(FREE_SHIPPING_THRESHOLD - 0.01)).toBe(STANDARD_SHIPPING);
  });

  it('regala el envío justo en el umbral y arriba', () => {
    expect(shippingCostFor(FREE_SHIPPING_THRESHOLD)).toBe(0);
    expect(shippingCostFor(FREE_SHIPPING_THRESHOLD + 800)).toBe(0);
  });
});

describe('totalsFor', () => {
  const item = (price: number, qty: number): PricedItem => ({
    variantId: 'v',
    productId: 'p',
    name: 'Pieza',
    variantName: 'M',
    price,
    qty,
  });

  it('suma por cantidad y aplica envío', () => {
    expect(totalsFor([item(599, 2)])).toEqual({ subtotal: 1198, shipping: 150, total: 1348 });
  });

  it('no acumula error de punto flotante', () => {
    const t = totalsFor([item(0.1, 1), item(0.2, 1)]);
    expect(t.subtotal).toBe(0.3);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it('envío gratis si el subtotal alcanza el umbral', () => {
    const t = totalsFor([item(FREE_SHIPPING_THRESHOLD, 1)]);
    expect(t.shipping).toBe(0);
    expect(t.total).toBe(FREE_SHIPPING_THRESHOLD);
  });
});
