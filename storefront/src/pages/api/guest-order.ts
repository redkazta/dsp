/**
 * POST /api/guest-order — abre un pedido de invitado con su correo.
 *
 * El enlace `?order=DSP-001019` es público, así que el detalle exige una
 * prueba: el correo con el que se pagó. Si coincide, se deja la cookie
 * `dsp_guest_order` (misma que pone la vuelta de Stripe) y la confirmación
 * muestra el pedido sin volver a pedir nada.
 *
 * Se responde igual para pedido inexistente y correo incorrecto: no se puede
 * usar este endpoint para descubrir qué folios existen.
 */
import type { APIRoute } from 'astro';
import type { AstroCookies } from 'astro';
import { createSupabaseAdminClient } from '../../lib/supabase-server';
import { getOrderByIdOrNumber } from '../../lib/customer-orders';

export const prerender = false;

const GUEST_COOKIE = 'dsp_guest_order';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

// Límite en memoria por IP (frena lo obvio; en serverless no es un WAF).
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 12;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_PER_WINDOW) {
    hits.set(ip, list);
    return true;
  }
  list.push(now);
  hits.set(ip, list);
  return false;
}

const normalizeEmail = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

export const POST: APIRoute = async ({
  request,
  cookies,
}: {
  request: Request;
  cookies: AstroCookies;
}) => {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  if (rateLimited(ip)) return json({ error: 'rate_limited' }, 429);

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const orderRef = typeof payload?.order === 'string' ? payload.order.trim() : '';
  const email = normalizeEmail(payload?.email);

  if (!orderRef || !email) return json({ error: 'invalid_body' }, 400);

  const db = createSupabaseAdminClient();
  if (!db) return json({ error: 'not_configured' }, 503);

  const order = await getOrderByIdOrNumber(db, orderRef);

  // Misma respuesta para "no existe" y "correo equivocado".
  if (!order || normalizeEmail(order.contact_email) !== email) {
    return json({ error: 'not_found' }, 404);
  }

  cookies.set(GUEST_COOKIE, order.id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: new URL(request.url).protocol === 'https:',
    maxAge: 60 * 60 * 24 * 30,
  });

  return json({ ok: true, orderNumber: order.order_number ?? null });
};
