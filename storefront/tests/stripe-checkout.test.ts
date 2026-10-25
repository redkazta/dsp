import { describe, expect, it } from 'vitest';
import { verifyWebhookSignature } from '../src/lib/stripe';
import { canSeeOrder, readCustomer, encodePaymentMeta, decodePaymentMeta } from '../src/lib/checkout';

// Genera la firma igual que Stripe para probar el verificador sin red.
async function sign(payload: string, secret: string, timestamp: number) {
  const { createHmac } = await import('node:crypto');
  const sig = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

const customer = {
  firstName: 'Angel',
  lastName: 'Perez',
  email: 'angel@example.com',
  phone: '5512345678',
  street: 'Calle 1 #2',
  colonia: 'Centro',
  city: 'CDMX',
  state: 'CDMX',
  postalCode: '06000',
};

describe('verifyWebhookSignature', () => {
  const secret = 'whsec_test';

  it('acepta una firma válida y reciente', async () => {
    const payload = '{"id":"evt_1"}';
    const now = Math.floor(Date.now() / 1000);
    expect(verifyWebhookSignature(payload, await sign(payload, secret, now), secret)).toBe(true);
  });

  it('rechaza el cuerpo alterado', async () => {
    const now = Math.floor(Date.now() / 1000);
    const header = await sign('{"id":"evt_1"}', secret, now);
    expect(verifyWebhookSignature('{"id":"evt_2"}', header, secret)).toBe(false);
  });

  it('rechaza firmas viejas (replay)', async () => {
    const payload = '{"id":"evt_1"}';
    const old = Math.floor(Date.now() / 1000) - 3600;
    expect(verifyWebhookSignature(payload, await sign(payload, secret, old), secret)).toBe(false);
  });

  it('rechaza sin secreto o sin header', () => {
    expect(verifyWebhookSignature('{}', 't=1,v1=abc', undefined)).toBe(false);
    expect(verifyWebhookSignature('{}', null, secret)).toBe(false);
    expect(verifyWebhookSignature('{}', 'basura', secret)).toBe(false);
  });
});

describe('readCustomer', () => {
  it('acepta datos completos', () => {
    expect(readCustomer({ customer })).toMatchObject({ email: customer.email });
  });

  it('rechaza correo inválido o campos faltantes', () => {
    expect(readCustomer({ customer: { ...customer, email: 'sin-arroba' } })).toBeNull();
    expect(readCustomer({ customer: { ...customer, street: '' } })).toBeNull();
    expect(readCustomer({ customer: { ...customer, postalCode: 'ABCDE' } })).toBeNull();
  });

  it('recorta y descarta las notas vacías', () => {
    const parsed = readCustomer({ customer: { ...customer, notes: '   ' } });
    expect(parsed?.notes).toBeUndefined();
  });
});

describe('metadata del pago', () => {
  it('viaja y vuelve íntegra', () => {
    const meta = {
      orderId: '11111111-2222-3333-4444-555555555555',
      orderNumber: 'DSP-001042',
      userId: null,
      customer,
      items: [
        {
          variantId: 'v1',
          productId: 'p1',
          productSlug: 'camisa',
          name: 'Camisa',
          variantName: 'M · Negro',
          price: 35,
          qty: 2,
          size: 'M',
          color: 'Negro',
          image: null,
        },
      ],
    };

    expect(decodePaymentMeta(encodePaymentMeta(meta))).toEqual(meta);
  });

  it('ignora metadata corrupta', () => {
    expect(decodePaymentMeta('no-json')).toBeNull();
    expect(decodePaymentMeta(undefined)).toBeNull();
    expect(decodePaymentMeta('{"foo":1}')).toBeNull();
  });
});

describe('canSeeOrder', () => {
  it('solo el dueño o el staff', () => {
    expect(canSeeOrder({ userId: 'u1', isStaff: false }, 'u1')).toBe(true);
    expect(canSeeOrder({ userId: 'u2', isStaff: false }, 'u1')).toBe(false);
    expect(canSeeOrder({ userId: null, isStaff: false }, null)).toBe(false);
    expect(canSeeOrder({ userId: 'u2', isStaff: true }, 'u1')).toBe(true);
  });
});
