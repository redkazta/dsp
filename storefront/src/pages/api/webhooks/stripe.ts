/**
 * POST /api/webhooks/stripe
 *
 * Fuente de verdad del pago. Stripe llama aquí y la firma se valida con
 * `STRIPE_WEBHOOK_SECRET`; sin firma válida se responde 400 y no se toca nada.
 *
 * Eventos que nos interesan:
 *   - checkout.session.completed              → el cliente pagó
 *   - checkout.session.async_payment_succeeded → pago asíncrono aprobado
 *   - checkout.session.async_payment_failed    → pago asíncrono rechazado
 *   - checkout.session.expired                 → abandonó el pago
 *   - payment_intent.payment_failed            → tarjeta rechazada
 *   - charge.refunded                          → reembolso hecho desde Stripe
 *
 * Configura en Stripe → Developers → Webhooks:
 *   URL: https://dspstorefront.vercel.app/api/webhooks/stripe
 *
 * La idempotencia la da `applyPaidStatus`: repetir un evento no duplica
 * pedidos, piezas ni filas de `payments`.
 */
import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '../../../lib/supabase-server';
import { verifyWebhookSignature, type StripeEvent } from '../../../lib/stripe';
import { applyPaidStatus, applyFailedStatus, applyRefundedStatus } from '../../../lib/checkout';

export const prerender = false;

const reply = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const POST: APIRoute = async ({ request }: { request: Request }) => {
  const secret = import.meta.env.STRIPE_WEBHOOK_SECRET;

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

  const object = event.data?.object ?? {};
  const orderId: string | null = object?.metadata?.order_id ?? object?.client_reference_id ?? null;
  const paymentIntent: string | null = object?.payment_intent ?? null;

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        if (!orderId) break;
        // Pago pendiente (p. ej. efectivo): esperamos el evento asíncrono.
        if (object.payment_status && object.payment_status !== 'paid') break;

        await applyPaidStatus({
          db,
          orderId,
          paymentIntentId: paymentIntent ?? object.id,
          amount: typeof object.amount_total === 'number' ? object.amount_total / 100 : 0,
        });
        break;
      }

      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired': {
        if (!orderId) break;
        await applyFailedStatus({ db, orderId, paymentIntentId: paymentIntent });
        break;
      }

      case 'payment_intent.payment_failed': {
        if (!orderId) break;
        await applyFailedStatus({ db, orderId, paymentIntentId: object.id ?? null });
        break;
      }

      case 'charge.refunded': {
        if (!paymentIntent) break;
        // Un `charge` no lleva la metadata del pedido: se resuelve por `payments`.
        const { data: payment } = await db
          .from('payments')
          .select('order_id')
          .eq('provider_transaction_id', paymentIntent)
          .maybeSingle();

        if (payment?.order_id) {
          await applyRefundedStatus({
            db,
            orderId: payment.order_id,
            paymentIntentId: paymentIntent,
            amount: typeof object.amount_refunded === 'number' ? object.amount_refunded / 100 : null,
          });
        }
        break;
      }

      default:
        break;
    }
  } catch (err: any) {
    console.error('[webhook]', event.type, err?.message);
    // 500 → Stripe reintenta el mismo evento más tarde.
    return reply({ error: 'Error procesando el evento.' }, 500);
  }

  return reply({ received: true }, 200);
};
