/**
 * POST /api/webhooks/stripe
 *
 * Fuente de verdad del pago. Stripe llama aquí y la firma se valida con
 * `STRIPE_WEBHOOK_SECRET`; sin firma válida se responde 400 y no se toca nada.
 *
 * Eventos que nos interesan:
 *   - checkout.session.completed                 → el cliente pagó
 *   - checkout.session.async_payment_succeeded   → pago asíncrono aprobado
 *   - checkout.session.async_payment_failed      → pago asíncrono rechazado
 *   - checkout.session.expired                   → abandonó el pago
 *   - payment_intent.payment_failed              → tarjeta rechazada
 *   - charge.refunded                            → reembolso hecho desde Stripe
 *
 * Idempotencia: cada `event.id` se reserva en `stripe_webhook_events` antes
 * de procesar. Si Stripe reintenta, el evento ya está marcado y se responde
 * 200 sin repetir nada (ni correos). Además, el correo solo sale cuando el
 * pedido pasa de "no pagado" a "pagado", como segunda red de seguridad.
 *
 * Respuesta rápida: se responde 200 en cuanto el evento queda reservado y el
 * trabajo corre en background con `waitUntil` de Vercel. Si el runtime no lo
 * expone, se procesa antes de responder (y un fallo devuelve 500 para que
 * Stripe reintente).
 *
 * Configura en Stripe → Developers → Webhooks:
 *   URL: https://www.dinerosobreproblemas.com/api/webhooks/stripe
 */
import type { APIRoute } from 'astro';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '../../../lib/supabase-server';
import { serverEnv } from '../../../lib/env';
import { verifyWebhookSignature, type StripeEvent } from '../../../lib/stripe';
import { applyPaidStatus, applyFailedStatus, applyRefundedStatus } from '../../../lib/checkout';
import { sendOrderConfirmation } from '../../../lib/resend';

export const prerender = false;

const TABLE = 'stripe_webhook_events';

const reply = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

/** Tabla de idempotencia ausente: se sigue (fail-open) y se avisa en logs. */
const isMissingTable = (code?: string) =>
  code === '42P01' || code === 'PGRST205' || code === 'PGRST204';

/**
 * `waitUntil` de Vercel. Se importa en runtime y, si no existe (otro
 * adapter o `astro dev`), se devuelve `null` y el trabajo se espera.
 */
async function getWaitUntil(): Promise<((p: Promise<unknown>) => void) | null> {
  try {
    const mod = await import('@vercel/functions');
    return typeof mod.waitUntil === 'function' ? mod.waitUntil : null;
  } catch {
    return null;
  }
}

/** ¿Este evento ya se procesó? Si no, lo reserva. */
async function reserveEvent(db: SupabaseClient, event: StripeEvent): Promise<boolean> {
  const { data: existing, error: readError } = await db
    .from(TABLE)
    .select('event_id, processed_at')
    .eq('event_id', event.id)
    .maybeSingle();

  if (readError) {
    if (isMissingTable(readError.code)) {
      console.warn('[webhook] falta la tabla', TABLE, '→ se procesa sin idempotencia');
      return true;
    }
    throw new Error(`No se pudo leer ${TABLE}: ${readError.message}`);
  }

  // Ya terminado: no se repite (ni correos).
  if (existing?.processed_at) return false;

  // Reserva huérfana (el proceso anterior murió antes de marcarla): se
  // reprocesa. Aplicar el pago es idempotente y el correo tiene su guarda.
  if (existing) return true;

  const { error } = await db.from(TABLE).insert({ event_id: event.id, type: event.type });

  if (error) {
    if (error.code === '23505') return false; // carrera: otro request lo tomó
    if (isMissingTable(error.code)) return true;
    throw new Error(`No se pudo reservar el evento: ${error.message}`);
  }

  return true;
}

async function finishEvent(db: SupabaseClient, eventId: string, orderId: string | null) {
  const { error } = await db
    .from(TABLE)
    .update({ processed_at: new Date().toISOString(), ...(orderId ? { order_id: orderId } : {}) })
    .eq('event_id', eventId);

  if (error && !isMissingTable(error.code)) {
    console.warn('[webhook] no se marcó el evento como procesado:', error.message);
  }
}

/** Libera la reserva para que el reintento de Stripe sí lo procese. */
async function releaseEvent(db: SupabaseClient, eventId: string, message: string) {
  const { error } = await db
    .from(TABLE)
    .update({ error: message.slice(0, 500), processed_at: null })
    .eq('event_id', eventId);

  if (error && !isMissingTable(error.code)) {
    console.warn('[webhook] no se liberó el evento:', error.message);
  }
}

async function isOrderPaid(db: SupabaseClient, orderId: string): Promise<boolean> {
  const { data } = await db
    .from('orders')
    .select('payment_status')
    .eq('id', orderId)
    .maybeSingle();

  return data?.payment_status === 'approved';
}

async function sendConfirmation(db: SupabaseClient, orderId: string) {
  const { data: order } = await db
    .from('orders')
    .select('contact_email, contact_name, order_number, total_amount')
    .eq('id', orderId)
    .maybeSingle();

  if (!order?.contact_email) return;

  try {
    await sendOrderConfirmation({
      to: order.contact_email,
      orderNumber: order.order_number ?? orderId,
      customerName: order.contact_name ?? 'Valoración',
      total: `$${Number(order.total_amount ?? 0).toFixed(2)}`,
    });
  } catch (err: any) {
    // El pedido ya está pagado: un correo fallido no debe tumbar el webhook.
    console.error('[webhook] correo de confirmación', err?.message);
  }
}

/** Lógica del evento. Devuelve el pedido afectado, si lo hubo. */
async function processEvent(db: SupabaseClient, event: StripeEvent): Promise<string | null> {
  const object = event.data?.object ?? {};
  const orderId: string | null = object?.metadata?.order_id ?? object?.client_reference_id ?? null;
  const sessionId: string | null = object?.id ?? null;
  const paymentIntent: string | null = object?.payment_intent ?? null;

  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      if (!orderId) {
        console.warn('[webhook] evento sin order_id:', event.id, event.type);
        return null;
      }

      // Pago pendiente (p. ej. efectivo): esperamos el evento asíncrono.
      if (object.payment_status && object.payment_status !== 'paid') return orderId;

      const amount = typeof object.amount_total === 'number' ? object.amount_total / 100 : 0;
      const wasPaid = await isOrderPaid(db, orderId);

      await applyPaidStatus({
        db,
        orderId,
        paymentIntentId: paymentIntent ?? sessionId ?? event.id,
        amount,
      });

      // Solo el tránsito no-pagado → pagado manda correo.
      if (!wasPaid) await sendConfirmation(db, orderId);

      return orderId;
    }

    case 'checkout.session.async_payment_failed':
    case 'checkout.session.expired': {
      if (!orderId) return null;
      await applyFailedStatus({ db, orderId, paymentIntentId: paymentIntent });
      return orderId;
    }

    case 'payment_intent.payment_failed': {
      if (!orderId) return null;
      await applyFailedStatus({ db, orderId, paymentIntentId: object.id ?? null });
      return orderId;
    }

    case 'charge.refunded': {
      if (!paymentIntent) return null;

      // Un `charge` no lleva la metadata del pedido: se resuelve por `payments`.
      const { data: payment } = await db
        .from('payments')
        .select('order_id')
        .eq('provider_transaction_id', paymentIntent)
        .maybeSingle();

      if (!payment?.order_id) return null;

      await applyRefundedStatus({
        db,
        orderId: payment.order_id,
        paymentIntentId: paymentIntent,
        amount: typeof object.amount_refunded === 'number' ? object.amount_refunded / 100 : null,
      });

      return payment.order_id;
    }

    default:
      return null;
  }
}

export const POST: APIRoute = async ({ request }: { request: Request }) => {
  const secret = serverEnv('STRIPE_WEBHOOK_SECRET');

  if (!secret) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET no configurado');
    return reply({ error: 'Webhook no configurado.' }, 503);
  }

  // La firma se calcula sobre el cuerpo exacto: no se puede parsear antes.
  const raw = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!verifyWebhookSignature(raw, signature, secret)) {
    console.error('[webhook] firma inválida');
    return reply({ error: 'Firma inválida.' }, 400);
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return reply({ error: 'Cuerpo inválido.' }, 400);
  }

  const db = createSupabaseAdminClient();

  if (!db) {
    // 500 → Stripe reintenta cuando la llave de servicio esté configurada.
    console.error('[webhook] falta SUPABASE_SERVICE_ROLE_KEY');
    return reply({ error: 'Almacenamiento no disponible.' }, 500);
  }

  let reserved = false;
  try {
    reserved = await reserveEvent(db, event);
  } catch (err: any) {
    console.error('[webhook] reserva', event.type, err?.message);
    // No se pudo reservar: que Stripe reintente.
    return reply({ error: 'Almacenamiento no disponible.' }, 500);
  }

  if (!reserved) return reply({ received: true, duplicate: true }, 200);

  // Trabajo real: estado del pedido + correo.
  const work = (async () => {
    const orderId = await processEvent(db, event);
    await finishEvent(db, event.id, orderId);
  })().catch(async (err: any) => {
    console.error('[webhook]', event.type, err?.message);
    await releaseEvent(db, event.id, String(err?.message ?? 'error'));
    throw err;
  });

  const waitUntil = await getWaitUntil();

  if (waitUntil) {
    // 200 inmediato; Vercel mantiene viva la función hasta terminar.
    waitUntil(work.catch(() => {}));
    return reply({ received: true }, 200);
  }

  // Sin `waitUntil`: se espera. Un fallo devuelve 500 para que Stripe reintente.
  try {
    await work;
  } catch {
    return reply({ error: 'Error procesando el evento.' }, 500);
  }

  return reply({ received: true }, 200);
};
