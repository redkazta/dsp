/**
 * POST /api/admin/shipment — genera la guía DHL de un pedido.
 *
 * Solo staff. Se niega si la dirección no está verificada: la regla del
 * proyecto es que el operador revise la dirección antes de gastar una guía.
 *
 *   POST { orderId, productCode }
 *   → { ok, trackingNumber }
 */
import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '../../../lib/supabase-server';
import { createLabel, isDhlConfigured, type DhlPackage } from '../../../lib/dhl';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const DEFAULT_PACKAGE: DhlPackage = { weight: 1.2, length: 12, width: 10, height: 2 };

export const POST: APIRoute = async ({ locals, request }: any) => {
  if (!locals?.isStaff) return json({ error: 'forbidden' }, 403);
  if (!isDhlConfigured()) return json({ error: 'dhl_not_configured' }, 503);

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const orderId = typeof payload?.orderId === 'string' ? payload.orderId.trim() : '';
  const productCode = typeof payload?.productCode === 'string' ? payload.productCode.trim() : '';

  if (!orderId) return json({ error: 'invalid_body' }, 400);

  const db = createSupabaseAdminClient();
  if (!db) return json({ error: 'not_configured' }, 503);

  const { data: order } = await db
    .from('orders')
    .select(
      'id, order_number, contact_name, contact_email, contact_phone, shipping_street, shipping_colonia, shipping_city, shipping_state, shipping_postal_code, address_verification_status, carrier, tracking_number'
    )
    .eq('id', orderId)
    .maybeSingle();

  if (!order) return json({ error: 'not_found' }, 404);

  if (order.address_verification_status === 'invalid') {
    return json({ error: 'address_invalid' }, 409);
  }
  if (order.address_verification_status !== 'verified' && order.address_verification_status !== 'corrected') {
    return json({ error: 'address_not_verified' }, 409);
  }
  if (order.tracking_number) {
    return json({ error: 'already_shipped', trackingNumber: order.tracking_number }, 409);
  }

  const result = await createLabel({
    orderNumber: String(order.order_number ?? order.id),
    destination: {
      name: String(order.contact_name ?? 'Cliente'),
      line1: String(order.shipping_street ?? ''),
      line2: String(order.shipping_colonia ?? ''),
      city: String(order.shipping_city ?? ''),
      state: String(order.shipping_state ?? ''),
      zip: String(order.shipping_postal_code ?? ''),
      phone: String(order.contact_phone ?? ''),
      email: String(order.contact_email ?? ''),
    },
    packages: [DEFAULT_PACKAGE],
    productCode: productCode || 'P',
  });

  if (!result.ok) return json({ error: result.reason }, 502);

  const { error: updateError } = await db
    .from('orders')
    .update({
      carrier: 'DHL',
      tracking_number: result.data.trackingNumber,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (updateError) return json({ error: updateError.message }, 500);

  return json({ ok: true, trackingNumber: result.data.trackingNumber });
};
