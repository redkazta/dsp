/**
 * GET /api/cron/cart-reminders — envía los recordatorios vencidos.
 *
 * Pensado para el cron de Vercel (o cualquier scheduler externo). Se protege
 * con `CRON_SECRET`:
 *   Authorization: Bearer <CRON_SECRET>
 * o el header `x-vercel-cron` que añade Vercel.
 */
import type { APIRoute } from 'astro';
import { serverEnv } from '../../../lib/env';
import { createSupabaseAdminClient } from '../../../lib/supabase-server';
import { sendDueCartReminders } from '../../../lib/reminders';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const GET: APIRoute = async ({ request }) => {
  const secret = serverEnv('CRON_SECRET') ?? '';
  const auth = request.headers.get('authorization') ?? '';
  const fromVercel = Boolean(request.headers.get('x-vercel-cron'));

  const authorized = fromVercel || (secret && auth === `Bearer ${secret}`);

  if (!authorized) return json({ error: 'forbidden' }, 403);

  const db = createSupabaseAdminClient();
  if (!db) return json({ error: 'not_configured' }, 503);

  try {
    const sent = await sendDueCartReminders(db);
    return json({ ok: true, sent });
  } catch (err: any) {
    console.error('[cron] cart-reminders', err?.message);
    return json({ error: 'failed' }, 500);
  }
};
