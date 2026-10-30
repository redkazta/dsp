/**
 * Recordatorios de carrito / checkout abandonado.
 *
 * Se programa uno al abrir Stripe (pedido `pending`) y se cancela en cuanto el
 * pago se aprueba. El retraso vive en `CART_REMINDER_DELAY_SECONDS`:
 *   · producción: 3600 (1 hora)
 *   · pruebas: 10
 *
 * Para retrasos cortos el envío se hace con `waitUntil` desde `/api/checkout`
 * (la función sigue viva unos segundos). Para retrasos largos lo recoge el
 * cron `/api/cron/cart-reminders`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { serverEnv } from './env';
import { TENANT_ID } from './constants';
import { sendCartReminder } from './resend';
import { formatMoney } from './pricing';

/** Segundos de espera antes del aviso. 3600 por defecto. */
export function reminderDelaySeconds(): number {
  const raw = Number(serverEnv('CART_REMINDER_DELAY_SECONDS'));
  if (!Number.isFinite(raw) || raw < 0) return 3600;
  return Math.floor(raw);
}

/** Retrasos por debajo de este umbral se envían con `waitUntil`. */
export const INLINE_DELAY_LIMIT = 25;

export async function scheduleCartReminder({
  db,
  orderId,
  email,
  lang = 'es',
}: {
  db: SupabaseClient;
  orderId: string;
  email: string;
  lang?: 'es' | 'en';
}) {
  const delay = reminderDelaySeconds();
  const sendAt = new Date(Date.now() + delay * 1000).toISOString();

  const { data, error } = await db
    .from('cart_reminders')
    .insert({
      tenant_id: TENANT_ID,
      order_id: orderId,
      email,
      lang,
      send_at: sendAt,
    })
    .select('id')
    .single();

  if (error) {
    console.warn('[reminders] no se pudo programar:', error.code, error.message);
    return null;
  }

  return { id: data.id as string, delay };
}

/** Envía un recordatorio concreto si sigue vigente. */
export async function sendCartReminderById(db: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await db
    .from('cart_reminders')
    .select(
      'id, email, lang, sent_at, canceled_at, orders(order_number, total_amount, payment_status)'
    )
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return false;
  if (data.sent_at || data.canceled_at) return false;

  const order = Array.isArray(data.orders) ? data.orders[0] : data.orders;

  // Si ya pagó (o el pedido desapareció), el aviso sobra.
  if (!order || order.payment_status === 'approved') {
    await db
      .from('cart_reminders')
      .update({ canceled_at: new Date().toISOString() })
      .eq('id', id);
    return false;
  }

  const sent = await sendCartReminder({
    to: data.email,
    orderNumber: order.order_number ?? null,
    total: formatMoney(Number(order.total_amount ?? 0)),
    lang: data.lang === 'en' ? 'en' : 'es',
  });

  if (!sent.ok) return false;

  await db.from('cart_reminders').update({ sent_at: new Date().toISOString() }).eq('id', id);
  return true;
}

/** Cancela los avisos pendientes de un pedido (al pagar). */
export async function cancelCartReminders(db: SupabaseClient, orderId: string) {
  await db
    .from('cart_reminders')
    .update({ canceled_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .is('sent_at', null)
    .is('canceled_at', null);
}

/** Todo lo que ya venció: lo usa el cron. Devuelve cuántos salieron. */
export async function sendDueCartReminders(db: SupabaseClient, limit = 25): Promise<number> {
  const { data, error } = await db
    .from('cart_reminders')
    .select('id')
    .lte('send_at', new Date().toISOString())
    .is('sent_at', null)
    .is('canceled_at', null)
    .order('send_at', { ascending: true })
    .limit(limit);

  if (error || !data?.length) return 0;

  let sent = 0;
  for (const row of data) {
    if (await sendCartReminderById(db, row.id)) sent += 1;
  }
  return sent;
}
