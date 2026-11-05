// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/fedex', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    isFedexConfigured: () => true,
    createLabel: vi.fn(async () => ({
      ok: true,
      data: { trackingNumber: '794800000001', documents: [] },
    })),
  };
});

vi.mock('../src/lib/resend', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return { ...actual, sendShippingLabel: vi.fn(async () => ({ ok: true })) };
});

vi.mock('../src/lib/supabase-server', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return { ...actual, createSupabaseAdminClient: vi.fn() };
});

import { createLabel } from '../src/lib/fedex';
import { shippingServiceLabel } from '../src/lib/orders';
import { createSupabaseAdminClient } from '../src/lib/supabase-server';
import { POST } from '../src/pages/api/admin/shipment';

const baseOrder = {
  id: 'order-1',
  order_number: 'DSP-1001',
  contact_name: 'Jane Doe',
  contact_email: 'jane@example.com',
  contact_phone: '+12145550000',
  shipping_street: '1 Main St',
  shipping_colonia: 'Apt 2',
  shipping_city: 'Fort Worth',
  shipping_state: 'TX',
  shipping_postal_code: '76104',
  shipping_method: 'FIRST_OVERNIGHT',
  address_verification_status: 'verified',
  carrier: 'FedEx',
  tracking_number: null,
  notes: '',
  order_items: [{ quantity: 2 }],
};

function fakeDb(order: any) {
  const updates: any[] = [];

  const db: any = {
    from() {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: order, error: null }) }),
        }),
        update: (row: any) => {
          updates.push(row);
          return { eq: async () => ({ error: null }) };
        },
      };
    },
    storage: {
      from: () => ({
        upload: async () => ({ error: { message: 'sin bucket' } }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      }),
    },
  };

  return { db, updates };
}

async function callShipment(body: any, locals: any = { isStaff: true }) {
  const request = new Request('https://store.test/api/admin/shipment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const res = await POST({ locals, request } as any);
  return { res, data: await res.json() };
}

function arrange(order: any = baseOrder) {
  const { db, updates } = fakeDb(order);
  vi.mocked(createSupabaseAdminClient).mockReturnValue(db);
  vi.mocked(createLabel).mockClear();
  return { updates };
}

describe('POST /api/admin/shipment — servicio de la guía', () => {
  beforeEach(() => vi.clearAllMocks());

  it('usa el servicio que pagó el cliente, no Ground', async () => {
    arrange();

    const { res, data } = await callShipment({ orderId: 'order-1' });

    expect(res.status).toBe(200);
    expect(data).toMatchObject({ ok: true, trackingNumber: '794800000001', serviceType: 'FIRST_OVERNIGHT' });

    expect(createLabel).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createLabel).mock.calls[0][0]).toMatchObject({
      productCode: 'FIRST_OVERNIGHT',
      destination: { city: 'Fort Worth', state: 'TX', zip: '76104' },
    });
  });

  it('respeta el servicio que mande el operador', async () => {
    arrange();

    await callShipment({ orderId: 'order-1', productCode: 'FEDEX_2_DAY' });

    expect(vi.mocked(createLabel).mock.calls[0][0]).toMatchObject({ productCode: 'FEDEX_2_DAY' });
  });

  it('manda un paquete por pieza, como en la cotización', async () => {
    arrange();

    await callShipment({ orderId: 'order-1' });

    expect(vi.mocked(createLabel).mock.calls[0][0].packages).toHaveLength(2);
  });

  it.each(['standard', 'free', '', null])(
    'cae a Ground si el pedido guardó %s',
    async (method) => {
      arrange({ ...baseOrder, shipping_method: method });

      const { data } = await callShipment({ orderId: 'order-1' });

      expect(data.serviceType).toBe('FEDEX_GROUND');
      expect(vi.mocked(createLabel).mock.calls[0][0]).toMatchObject({ productCode: 'FEDEX_GROUND' });
    }
  );

  it('normaliza el código aunque venga en minúsculas', async () => {
    arrange({ ...baseOrder, shipping_method: 'fedex_2_day' });

    const { data } = await callShipment({ orderId: 'order-1' });

    expect(data.serviceType).toBe('FEDEX_2_DAY');
  });

  it('bloquea la guía si la dirección no está verificada', async () => {
    arrange({ ...baseOrder, address_verification_status: 'pending' });

    const { res, data } = await callShipment({ orderId: 'order-1' });

    expect(res.status).toBe(409);
    expect(data.error).toBe('address_not_verified');
    expect(createLabel).not.toHaveBeenCalled();
  });

  it('no genera guía dos veces', async () => {
    arrange({ ...baseOrder, tracking_number: '794800000009' });

    const { res, data } = await callShipment({ orderId: 'order-1' });

    expect(res.status).toBe(409);
    expect(data).toMatchObject({ error: 'already_shipped', trackingNumber: '794800000009' });
    expect(createLabel).not.toHaveBeenCalled();
  });

  it('rechaza a quien no es staff', async () => {
    arrange();

    const { res } = await callShipment({ orderId: 'order-1' }, { isStaff: false });

    expect(res.status).toBe(403);
    expect(createLabel).not.toHaveBeenCalled();
  });
});

describe('shippingServiceLabel', () => {
  it('nombra los servicios de FedEx que vende el checkout', () => {
    expect(shippingServiceLabel('FIRST_OVERNIGHT')).toBe('FedEx First Overnight');
    expect(shippingServiceLabel('FEDEX_EXPRESS_SAVER')).toBe('FedEx Express Saver');
    expect(shippingServiceLabel('fedex_2_day')).toBe('FedEx 2Day');
  });

  it('distingue los pedidos sin cotización FedEx', () => {
    expect(shippingServiceLabel('standard')).toBe('Envío estándar');
    expect(shippingServiceLabel('free')).toBe('Envío gratis');
    expect(shippingServiceLabel(null)).toBe('');
  });

  it('deja pasar un código desconocido en vez de ocultarlo', () => {
    expect(shippingServiceLabel('OTRO_SERVICIO')).toBe('OTRO_SERVICIO');
  });
});
