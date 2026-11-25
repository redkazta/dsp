import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendOrderConfirmation } from '../src/lib/resend';
import type { OrderReceipt } from '../src/lib/orders';

/**
 * El recibo del cliente y la copia interna salen en el MISMO envío de
 * Resend: el BCC no se puede perder al tocar la plantilla.
 */
const receipt: OrderReceipt = {
  orderId: 'order-1',
  orderNumber: 'DSP-1001',
  customerName: 'Ana <b>López</b>',
  customerEmail: 'ana@example.com',
  customerPhone: '+1 555 0100',
  createdAt: '2026-11-25T18:00:00.000Z',
  items: [
    {
      name: 'Camisa ¡D$P! V3 Violet',
      variantName: 'L / Negro',
      size: 'L',
      color: 'Negro',
      quantity: 2,
      unitPrice: 35,
    },
  ],
  subtotal: 70,
  shipping: 12,
  discount: 0,
  total: 82,
  shippingMethod: 'FedEx Ground',
  shippingAddress: ['123 Main St', 'Fort Worth, TX 76102'],
};

describe('correo de compra', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test-key';
    process.env.ORDER_COPY_EMAIL = 'angel@wildforgelabs.com';
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.ORDER_COPY_EMAIL;
    vi.unstubAllGlobals();
  });

  it('manda el detalle y la copia oculta al buzón interno', async () => {
    const bodies: any[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(String(init.body)));
        return new Response(JSON.stringify({ id: 'email-1' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );

    const result = await sendOrderConfirmation({
      to: receipt.customerEmail,
      orderNumber: receipt.orderNumber,
      customerName: receipt.customerName,
      total: '$82.00',
      lang: 'es',
      receipt,
    });

    expect(result).toEqual({ ok: true });
    expect(bodies).toHaveLength(1);

    const sent = bodies[0];
    expect(sent.to).toBe('ana@example.com');
    expect(sent.bcc).toEqual(['angel@wildforgelabs.com']);
    expect(sent.html).toContain('Camisa ¡D$P! V3 Violet');
    expect(sent.html).toContain('2 ×');
    expect(sent.html).toContain('$70.00');
    expect(sent.html).toContain('$82.00');
    expect(sent.html).toContain('Enviar a');
    // El nombre lo escribe el cliente: nunca entra como HTML crudo.
    expect(sent.html).not.toContain('<b>López</b>');
  });
});
