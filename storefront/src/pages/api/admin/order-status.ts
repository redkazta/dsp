/**
 * POST /api/admin/order-status — cambia el estado de un pedido y avisa al cliente.
 *
 * Solo staff. El historial lo escribe el trigger de Postgres; aquí se actualiza
 * el pedido con service role y se manda el correo con Resend. Si el correo
 * falla, el cambio de estado se conserva igual (mejor esfuerzo).
 */
import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '../../../lib/supabase-server';
import { sendOrderStatusEmail } from '../../../lib/resend';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const ALLOWED = new Set([
  'pending',
  'confirmed',
  'design',
  'preparing',
  'ready',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
]);

export const POST: APIRoute = async (context: any) => {
  const { request, locals } = context;

  if (!locals?.isStaff) return json({ error: 'forbidden' }, 403);

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const orderId = typeof payload?.orderId === 'string' ? payload.orderId.trim() : '';
  const status = typeof payload?.status === 'string' ? payload.status.trim() : '';

  if (!orderId || !ALLOWED.has(status)) return json({ error: 'invalid_body' }, 400);

  const db = createSupabaseAdminClient();
  if (!db) return json({ error: 'not_configured' }, 503);

  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };

  if (typeof payload?.trackingNumber === 'string') {
    patch.tracking_number = payload.trackingNumber.trim() || null;
  }
  if (typeof payload?.carrier === 'string') {
    patch.carrier = payload.carrier.trim() || null;
  }

  const { error } = await db.from('orders').update(patch).eq('id', orderId);

  if (error) {
    console.error('[order-status] update', error.code, error.message);
    return json({ error: error.message }, 500);
  }

  // Aviso al cliente (no bloquea la respuesta si falla).
  try {
    const { data: order } = await db
      .from('orders')
      .select('order_number, contact_email')
      .eq('id', orderId)
      .maybeSingle();

    if (order?.contact_email) {
      await sendOrderStatusEmail({
        to: order.contact_email,
        orderNumber: order.order_number ?? null,
        status,
        carrier: (patch.carrier as string | null) ?? null,
        trackingNumber: (patch.tracking_number as string | null) ?? null,
        // El pedido no guarda idioma; la tienda es principalmente ES.
        lang: 'es',
      });
    }
  } catch (err: any) {
    console.warn('[order-status] correo:', err?.message);
  }

  return json({ ok: true, status });
};
