import { describe, expect, it } from 'vitest';
import {
  FREE_SHIPPING_THRESHOLD,
  STANDARD_SHIPPING,
  round2,
  shippingCostFor,
  totalsFor,
  priceItems,
  type PricedItem,
} from '../src/lib/pricing';
import { TENANT_ID } from '../src/lib/constants';

describe('shippingCostFor', () => {
  it('cobra envío estándar por debajo del umbral', () => {
    expect(shippingCostFor(0)).toBe(0);
    expect(shippingCostFor(FREE_SHIPPING_THRESHOLD / 2)).toBe(STANDARD_SHIPPING);
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
    expect(totalsFor([item(35, 2)])).toEqual({
      subtotal: 70,
      shipping: STANDARD_SHIPPING,
      total: 70 + STANDARD_SHIPPING,
    });
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

/** Cliente Supabase mínimo: solo lo que usa `priceItems`. */
function fakeDb(rows: any[]) {
  return {
    from: () => ({
      select: () => ({
        in: async () => ({ data: rows, error: null }),
      }),
    }),
  } as any;
}

function variantRow(nameEn: string | null) {
  return {
    id: 'v1',
    product_id: 'p1',
    name: 'M · Negro',
    size: 'M',
    color: 'Negro',
    price: 35,
    is_deleted: false,
    products: {
      id: 'p1',
      name: 'Camisa ¡D$P! V3 Violet',
      name_en: nameEn,
      slug: 'camisa-dsp-v3-violet',
      tenant_id: TENANT_ID,
      is_active: true,
      is_deleted: false,
      product_images: [],
    },
  };
}

describe('priceItems y el nombre del producto', () => {
  it('guarda el nombre en el idioma en que se compró', async () => {
    const items = await priceItems(
      fakeDb([variantRow('D$P! V3 Violet Shirt')]),
      [{ variantId: 'v1', qty: 1 }],
      'en'
    );
    expect(items[0].name).toBe('D$P! V3 Violet Shirt');
  });

  it('cae al español si falta la traducción', async () => {
    const items = await priceItems(
      fakeDb([variantRow(null)]),
      [{ variantId: 'v1', qty: 1 }],
      'en'
    );
    expect(items[0].name).toBe('Camisa ¡D$P! V3 Violet');
  });
});
