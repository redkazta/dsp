/**
 * Cupones y descuentos.
 *
 * Regla de oro: el navegador solo manda el código; el descuento SIEMPRE se
 * calcula en el servidor sobre el subtotal real (`priceItems`). Un cupón
 * inválido no se ignora en silencio: el checkout responde con error.
 *
 * Hoy no hay cupones activos: la tabla existe y la lógica está lista, pero
 * cualquier código se rechaza hasta crear uno con `is_active = true`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { TENANT_ID } from './constants';
import { round2 } from './pricing';

export type CouponKind = 'percent' | 'fixed';

export interface CouponRow {
  code: string;
  kind: CouponKind;
  value: number;
  min_subtotal: number | null;
  max_uses: number | null;
  used_count: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean | null;
}

export type CouponResult =
  | { ok: true; code: string; kind: CouponKind; discount: number }
  | { ok: false; reason: CouponReason };

export type CouponReason =
  | 'invalid'
  | 'inactive'
  | 'not_started'
  | 'expired'
  | 'exhausted'
  | 'min_subtotal';

/** Motivos en los dos idiomas de la tienda. */
export const COUPON_REASON: Record<CouponReason, { es: string; en: string }> = {
  invalid: { es: 'Ese cupón no existe.', en: 'That coupon does not exist.' },
  inactive: { es: 'Ese cupón ya no está disponible.', en: 'That coupon is no longer available.' },
  not_started: { es: 'Ese cupón todavía no empieza.', en: 'That coupon has not started yet.' },
  expired: { es: 'Ese cupón ya venció.', en: 'That coupon has expired.' },
  exhausted: { es: 'Ese cupón agotó sus usos.', en: 'That coupon ran out of uses.' },
  min_subtotal: {
    es: 'Tu carrito no llega al mínimo de ese cupón.',
    en: 'Your cart does not reach that coupon minimum.',
  },
};

/** Código canónico: sin espacios y en mayúsculas. */
export function normalizeCouponCode(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toUpperCase().replace(/\s+/g, '') : '';
}

/** Evalúa un cupón ya leído de la base de datos. */
export function evaluateCoupon(
  coupon: CouponRow | null,
  subtotal: number,
  now: number = Date.now()
): CouponResult {
  if (!coupon || !coupon.is_active) return { ok: false, reason: 'invalid' };

  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) {
    return { ok: false, reason: 'not_started' };
  }

  if (coupon.ends_at && new Date(coupon.ends_at).getTime() < now) {
    return { ok: false, reason: 'expired' };
  }

  if (coupon.max_uses != null && (coupon.used_count ?? 0) >= coupon.max_uses) {
    return { ok: false, reason: 'exhausted' };
  }

  if (subtotal < Number(coupon.min_subtotal ?? 0)) {
    return { ok: false, reason: 'min_subtotal' };
  }

  const value = Number(coupon.value);

  const discount =
    coupon.kind === 'percent'
      ? round2((subtotal * Math.min(100, Math.max(0, value))) / 100)
      : round2(Math.min(subtotal, Math.max(0, value)));

  if (!Number.isFinite(discount) || discount <= 0) {
    return { ok: false, reason: 'invalid' };
  }

  return { ok: true, code: coupon.code, kind: coupon.kind, discount };
}

/**
 * Busca el cupón y lo evalúa. Si la tabla no existe todavía (script sin
 * correr), se trata como código inválido en vez de romper el checkout.
 */
export async function resolveCoupon(
  db: SupabaseClient,
  code: unknown,
  subtotal: number
): Promise<CouponResult> {
  const normalized = normalizeCouponCode(code);
  if (!normalized) return { ok: false, reason: 'invalid' };

  const { data, error } = await db
    .from('coupons')
    .select('code, kind, value, min_subtotal, max_uses, used_count, starts_at, ends_at, is_active')
    .eq('tenant_id', TENANT_ID)
    .eq('code', normalized)
    .maybeSingle();

  if (error) {
    console.warn('[coupons] no se pudo leer la tabla:', error.code, error.message);
    return { ok: false, reason: 'invalid' };
  }

  return evaluateCoupon(data as CouponRow | null, subtotal);
}

/** Mensaje localizado para el navegador. */
export function couponMessage(result: CouponResult, lang: 'es' | 'en'): string {
  if (result.ok) return '';
  return COUPON_REASON[result.reason][lang];
}
