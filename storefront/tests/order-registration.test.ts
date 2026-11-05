/**
 * Coherencia entre la tarifa elegida en el checkout y el pedido que se guarda.
 *
 * El ETA (`estimatedDays` / `estimated`) es solo de presentación: no viaja al
 * servidor ni se persiste. Lo que sí queda en `orders` es el servicio FedEx
 * elegido, su precio recalculado en servidor, la paquetería y la dirección.
 */
import { describe, expect, it } from 'vitest';
import { createPendingOrder, type CustomerPayload } from '../src/lib/checkout';
import type { PricedItem } from '../src/lib/pricing';

const customer: CustomerPayload = {
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  phone: '+12145550000',
  street: '1 Main St',
  colonia: 'Apt 2',
  city: 'Fort Worth',
  state: 'TX',
  postalCode: '76104',
  references: 'Casa blanca',
  notes: 'Sin logo',
};

const item = (price: number, qty = 1): PricedItem => ({
  variantId: 'v1',
  productId: 'p1',
  productSlug: 'playera',
  name: 'Playera',
  variantName: 'M',
  price,
  qty,
  image: null,
  size: 'M',
  color: null,
});

/** Cliente Supabase mínimo: captura la fila que se inserta en `orders`. */
function fakeDb() {
  const calls: Array<{ table: string; rows: any }> = [];

  const db: any = {
    from(table: string) {
      return {
        insert(rows: any) {
          calls.push({ table, rows });
          if (table !== 'orders') return Promise.resolve({ error: null });
          return {
            select() {
              return {
                async single() {
                  return {
                    data: { id: 'order-1', order_number: 'DSP-1001', total_amount: 0 },
                    error: null,
                  };
                },
              };
            },
          };
        },
        delete() {
          return { eq: async () => ({ error: null }) };
        },
      };
    },
  };

  const orderRow = () => calls.find((c) => c.table === 'orders')?.rows;
  return { db, calls, orderRow };
}

describe('createPendingOrder — envío FedEx', () => {
  it('guarda el servicio cotizado, el importe del servidor y la dirección', async () => {
    const { db, orderRow } = fakeDb();

    await createPendingOrder({
      db,
      userId: 'user-1',
      customer,
      items: [item(35, 2)],
      shippingCost: 51.01,
      quotedShipping: 51.01,
      shippingService: 'FEDEX_EXPRESS_SAVER',
      shippingCarrier: 'FedEx',
    });

    expect(orderRow()).toMatchObject({
      subtotal: 70,
      shipping_cost: 51.01,
      total_amount: 121.01,
      shipping_method: 'FEDEX_EXPRESS_SAVER',
      carrier: 'FedEx',
      shipping_city: 'Fort Worth',
      shipping_state: 'TX',
      shipping_postal_code: '76104',
      shipping_street: '1 Main St',
    });
  });

  it('acepta cualquier servicio doméstico de FedEx', async () => {
    for (const productCode of [
      'FIRST_OVERNIGHT',
      'PRIORITY_OVERNIGHT',
      'STANDARD_OVERNIGHT',
      'FEDEX_2_DAY_AM',
      'FEDEX_2_DAY',
      'FEDEX_EXPRESS_SAVER',
    ]) {
      const { db, orderRow } = fakeDb();

      await createPendingOrder({
        db,
        userId: null,
        customer,
        items: [item(35, 2)],
        shippingCost: 100,
        quotedShipping: 100,
        shippingService: productCode,
        shippingCarrier: 'FedEx',
      });

      expect(orderRow()).toMatchObject({
        shipping_method: productCode,
        carrier: 'FedEx',
        total_amount: 170,
      });
    }
  });

  it('sin cotización cae a la tarifa plana y no inventa paquetería', async () => {
    const { db, orderRow } = fakeDb();

    await createPendingOrder({
      db,
      userId: null,
      customer,
      items: [item(35, 2)],
      shippingCost: 15,
    });

    expect(orderRow()).toMatchObject({
      shipping_cost: 15,
      total_amount: 85,
      shipping_method: 'standard',
      carrier: null,
    });
  });

  it('con envío gratis no cobra ni marca paquetería', async () => {
    const { db, orderRow } = fakeDb();

    await createPendingOrder({
      db,
      userId: null,
      customer,
      items: [item(80, 2)],
      shippingCost: 0,
    });

    expect(orderRow()).toMatchObject({
      subtotal: 160,
      shipping_cost: 0,
      total_amount: 160,
      shipping_method: 'free',
      carrier: null,
    });
  });

  it('rechaza un envío que no coincide con lo cotizado', async () => {
    const { db } = fakeDb();

    await expect(
      createPendingOrder({
        db,
        userId: null,
        customer,
        items: [item(35, 2)],
        // El navegador manda un precio distinto al re-cotizado en servidor.
        shippingCost: 9.99,
        quotedShipping: 51.01,
        shippingService: 'FEDEX_EXPRESS_SAVER',
        shippingCarrier: 'FedEx',
      })
    ).rejects.toThrow('Envío inconsistente');
  });
});
