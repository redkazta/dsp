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

/** Estados de pago que el panel puede fijar a mano (reconciliación). */
const ALLOWED_PAYMENT = new Set(['pending', 'approved', 'failed', 'refunded']);

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
  const status =
    typeof payload?.status === 'string' && payload.status.trim() ? payload.status.trim() : null;
  const paymentStatus =
    typeof payload?.paymentStatus === 'string' && payload.paymentStatus.trim()
      ? payload.paymentStatus.trim()
      : null;

  if (!orderId) return json({ error: 'invalid_body' }, 400);
  if (!status && !paymentStatus) return json({ error: 'invalid_body' }, 400);
  if (status && !ALLOWED.has(status)) return json({ error: 'invalid_body' }, 400);
  if (paymentStatus && !ALLOWED_PAYMENT.has(paymentStatus)) return json({ error: 'invalid_body' }, 400);

  const db = createSupabaseAdminClient();
  if (!db) return json({ error: 'not_configured' }, 503);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  // Sin `status` el pedido no se mueve del flujo: solo cambia el pago.
  if (status) patch.status = status;
  if (paymentStatus) patch.payment_status = paymentStatus;

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
  // Solo cuando cambia el estado del pedido: un ajuste de pago no se avisa.
  try {
    if (status) {
      type OrderForMail = { order_number: string | null; contact_email: string | null; lang?: string | null };

      let order: OrderForMail | null;

      const withLang = await db
        .from('orders')
        .select('order_number, contact_email, lang')
        .eq('id', orderId)
        .maybeSingle<OrderForMail>();

      order = withLang.data;

      // Si `scripts/orders_lang.sql` aún no se corrió, la columna no existe:
      // se reintenta sin ella para no perder el aviso.
      if (withLang.error && (withLang.error.code === 'PGRST204' || withLang.error.code === '42703')) {
        const withoutLang = await db
          .from('orders')
          .select('order_number, contact_email')
          .eq('id', orderId)
          .maybeSingle<OrderForMail>();

        order = withoutLang.data;
      }

      if (order?.contact_email) {
        await sendOrderStatusEmail({
          to: order.contact_email,
          orderNumber: order.order_number ?? null,
          status,
          carrier: (patch.carrier as string | null) ?? null,
          trackingNumber: (patch.tracking_number as string | null) ?? null,
          // El pedido guarda el idioma de la compra (`scripts/orders_lang.sql`).
          lang: order.lang === 'en' ? 'en' : 'es',
        });
      }
    }
  } catch (err: any) {
    console.warn('[order-status] correo:', err?.message);
  }

  return json({ ok: true, status, paymentStatus });
};
