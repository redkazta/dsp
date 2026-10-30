/**
 * POST /api/coupon — valida un código y devuelve el descuento.
 *
 * El subtotal que manda el navegador es solo para la vista previa: al pagar,
 * `/api/checkout` vuelve a resolver el cupón con los precios de la base de
 * datos. Aquí no se aplica nada.
 *
 * Mientras no existan cupones activos, todo código responde `ok: false`.
 */
import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '../../lib/supabase-server';
import { normalizeCouponCode, resolveCoupon, couponMessage } from '../../lib/coupons';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const POST: APIRoute = async ({ request }) => {
  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, reason: 'invalid' }, 400);
  }

  const lang = payload?.lang === 'en' ? 'en' : 'es';
  const code = normalizeCouponCode(payload?.code);

  if (!code) {
    return json({ ok: false, reason: 'invalid', message: couponMessage({ ok: false, reason: 'invalid' }, lang) });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return json(
      { ok: false, reason: 'invalid', message: couponMessage({ ok: false, reason: 'invalid' }, lang) },
      503
    );
  }

  // Vista previa: el subtotal real se recalcula en el checkout.
  const preview = Math.max(0, Number(payload?.subtotal) || 0);
  const result = await resolveCoupon(db, code, preview);

  return json({
    ...result,
    message: couponMessage(result, lang),
  });
};
