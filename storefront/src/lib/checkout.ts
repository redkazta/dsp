/**
 * Pedidos + pago con Stripe (solo servidor).
 *
 * Flujo:
 *   1. `/api/checkout`  → valida carrito, crea el pedido en `pending` y abre
 *      la Checkout Session de Stripe. Devuelve la URL para pagar.
 *   2. Stripe cobra en su propio dominio (nosotros nunca vemos la tarjeta).
 *   3. `/api/webhooks/stripe` → con el pago confirmado, marca el pedido como
 *      pagado, escribe `order_items` y registra el pago.
 *
 * Regla de oro: **ningún pedido se marca pagado sin un evento verificado de
 * Stripe** (o la consulta server-side de la sesión al volver del Checkout).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { CHECKOUT_NOTES_MARKER, TENANT_ID } from './constants';
import { priceItems, totalsFor, PricingError, round2, type PricedItem } from './pricing';
import { createCheckoutSession, createStripeCoupon, retrieveCheckoutSession, isStripeConfigured, stripeMode, StripeError } from './stripe';
import { sendOrderConfirmation } from './resend';
import { resolveCoupon, couponMessage } from './coupons';

export interface CustomerPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  colonia: string;
  city: string;
  state: string;
  postalCode: string;
  references?: string;
  notes?: string;
}

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Datos de contacto y envío: se revalidan aquí, no se confía en el formulario. */
export function readCustomer(payload: any): CustomerPayload | null {
  const c = payload?.customer ?? {};
  const customer: CustomerPayload = {
    firstName: str(c.firstName, 80),
    lastName: str(c.lastName, 80),
    email: str(c.email, 160),
    phone: str(c.phone, 30),
    street: str(c.street, 200),
    colonia: str(c.colonia, 120),
    city: str(c.city, 100),
    state: str(c.state, 100),
    postalCode: str(c.postalCode, 10),
    references: str(c.references, 300) || undefined,
    notes: str(c.notes, 800) || undefined,
  };

  if (!customer.firstName || !customer.lastName || !customer.phone) return null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customer.email)) return null;
  if (!customer.street || !customer.colonia || !customer.city || !customer.state) return null;
  if (!/^\d{4,6}$/.test(customer.postalCode)) return null;

  return customer;
}

/** Notas: conserva las del visitante sin romper el marcador interno. */
function composeNotes(customer: CustomerPayload) {
  return [CHECKOUT_NOTES_MARKER, customer.notes].filter(Boolean).join(' ').slice(0, 900);
}

// ------------------------------------------------------------ Pedido nuevo

export interface CreatePendingOrderInput {
  db: SupabaseClient;
  userId: string | null;
  customer: CustomerPayload;
  items: PricedItem[];
  shippingCost: number;
  /** Descuento ya validado en servidor (0 = sin cupón). */
  discount?: number;
  couponCode?: string | null;
  /** Lo que reporta Stripe (incluye el envío). */
  paymentAmount?: number;
}

export async function createPendingOrder({
  db,
  userId,
  customer,
  items,
  shippingCost,
  discount = 0,
  couponCode = null,
  paymentAmount,
}: CreatePendingOrderInput) {
  const { subtotal, shipping } = totalsFor(items);
  const total = round2(subtotal - discount + shipping);

  if (shippingCost !== shipping) {
    throw new Error(`Envío inconsistente: ${shippingCost} != ${shipping}`);
  }

  const { data: order, error } = await db
    .from('orders')
    .insert({
      tenant_id: TENANT_ID,
      user_id: userId,
      status: 'pending',
      payment_status: 'pending',
      payment_method: 'stripe',
      subtotal,
      shipping_cost: shipping,
      total_amount: total,
      discount_amount: discount,
      coupon_code: couponCode,
      shipping_method: shipping === 0 ? 'free' : 'standard',
      contact_name: `${customer.firstName} ${customer.lastName}`.trim(),
      contact_email: customer.email,
      contact_phone: customer.phone,
      shipping_street: customer.street,
      shipping_colonia: customer.colonia,
      shipping_city: customer.city,
      shipping_state: customer.state,
      shipping_postal_code: customer.postalCode,
      shipping_references: customer.references ?? null,
      notes: composeNotes(customer),
    })
    .select('id, order_number, total_amount')
    .single();

  if (error || !order) {
    console.error('[orders] insert', error?.code, error?.message);
    throw new Error('No se pudo crear el pedido.');
  }

  // Las piezas se guardan desde ya (el pedido está en `pending` y no aparece
  // como compra confirmada). Si el pago falla, el webhook/expiración lo cierra.
  const { error: itemsError } = await db.from('order_items').insert(
    items.map((i) => ({
      order_id: order.id,
      product_variant_id: i.variantId,
      product_id: i.productId,
      product_slug: i.productSlug ?? null,
      product_name: i.name,
      variant_name: i.variantName,
      size: i.size ?? null,
      color: i.color ?? null,
      image_url: i.image ?? null,
      quantity: i.qty,
      unit_price: i.price,
    }))
  );

  if (itemsError) {
    console.error('[orders] items insert', itemsError.code, itemsError.message);
    await db.from('orders').delete().eq('id', order.id);
    throw new Error('No se pudo registrar el detalle del pedido.');
  }

  return { order, subtotal, shipping, total };
}

// --------------------------------------------------------- Payload del pago

export interface PaymentMeta {
  orderId: string;
  orderNumber: string | null;
  userId: string | null;
  customer: CustomerPayload;
  items: PricedItem[];
}

/** Lo que el webhook necesita para aplicar el pago sin volver a mirar la BD. */
export function encodePaymentMeta(meta: PaymentMeta) {
  // Stripe: máx. 500 caracteres por valor de metadata.
  return JSON.stringify(meta).slice(0, 4900);
}

export function decodePaymentMeta(raw: string | undefined | null): PaymentMeta | null {
  if (!raw) return null;
  try {
    const meta = JSON.parse(raw);
    return meta && meta.orderId && Array.isArray(meta.items) ? (meta as PaymentMeta) : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------- Aplicar el pago

export interface ApplyPaymentInput {
  db: SupabaseClient;
  orderId: string;
  paymentIntentId: string;
  amount: number;
  meta?: PaymentMeta | null;
}

/**
 * Marca el pedido como pagado (idempotente: el webhook puede repetirse).
 * Devuelve `false` si el pedido no existía.
 */
export async function applyPaidStatus({ db, orderId, paymentIntentId, amount, meta }: ApplyPaymentInput) {
  const { data: order } = await db
    .from('orders')
    .select('id, status, payment_status, total_amount, user_id, notes, coupon_code')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) return false;

  // Si ya estaba pagado, solo se repara el espejo en `payments`.
  if (order.payment_status !== 'approved') {
    const patch: Record<string, unknown> = {
      status: order.status === 'pending' ? 'confirmed' : order.status,
      payment_status: 'approved',
      payment_method: 'stripe',
      payment_reference: paymentIntentId,
    };

    const { error: updateError } = await db.from('orders').update(patch).eq('id', orderId);

    if (updateError) {
      // Si `payment_reference` aún no existe en la tabla, se guarda el pago
      // igual (el id de Stripe ya queda en `payments`).
      console.error('[orders] apply paid', updateError.code, updateError.message);
      delete patch.payment_reference;
      const { error: retryError } = await db.from('orders').update(patch).eq('id', orderId);
      if (retryError) return false;
    }

    // El cupón se consume al pagar, no al abrir Stripe (un carrito abandonado
    // no debe gastar usos). Si la función SQL no existe, no rompe la venta.
    if (order.coupon_code) {
      const { error: couponError } = await db.rpc('increment_coupon_use', {
        p_tenant: TENANT_ID,
        p_code: order.coupon_code,
      });

      if (couponError) {
        console.warn('[coupons] no se pudo consumir el uso:', couponError.code, couponError.message);
      }
    }

    // Ya pagó: el recordatorio de carrito no tiene sentido.
    await db
      .from('cart_reminders')
      .update({ canceled_at: new Date().toISOString() })
      .eq('order_id', orderId)
      .is('sent_at', null)
      .is('canceled_at', null);

    // El detalle puede faltar si el pedido nació antes de este flujo.
    const { count } = await db
      .from('order_items')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', orderId);

    if (!count && meta?.items?.length) {
      await db.from('order_items').insert(
        meta.items.map((i) => ({
          order_id: orderId,
          product_variant_id: i.variantId,
          product_id: i.productId,
          product_slug: i.productSlug ?? null,
          product_name: i.name,
          variant_name: i.variantName,
          size: i.size ?? null,
          color: i.color ?? null,
          image_url: i.image ?? null,
          quantity: i.qty,
          unit_price: i.price,
        }))
      );
    }
  }

  // Espejo en `payments` (auditoría). Best-effort: no bloquea la venta.
  const { data: existing } = await db
    .from('payments')
    .select('id')
    .eq('provider_transaction_id', paymentIntentId)
    .maybeSingle();

  const recorded = amount > 0 ? amount : Number(order.total_amount);

  if (existing) {
    // Un reintento del webhook no debe duplicar la fila de auditoría.
    await db
      .from('payments')
      .update({ status: 'completed', amount: recorded })
      .eq('id', existing.id);
  } else {
    await db.from('payments').insert({
      tenant_id: TENANT_ID,
      order_id: orderId,
      amount: recorded,
      provider: 'stripe',
      provider_transaction_id: paymentIntentId,
      status: 'completed',
    });
  }

  return true;
}

/** Pago rechazado o expirado: el pedido se cierra sin borrar el rastro. */
export async function applyFailedStatus({ db, orderId, paymentIntentId }: {
  db: SupabaseClient;
  orderId: string;
  paymentIntentId: string | null;
}) {
  const { data: order } = await db
    .from('orders')
    .select('id, status, payment_status')
    .eq('id', orderId)
    .maybeSingle();

  if (!order || order.payment_status === 'approved') return false;

  await db
    .from('orders')
    .update({
      status: 'cancelled',
      payment_status: 'failed',
      ...(paymentIntentId ? { payment_reference: paymentIntentId } : {}),
    })
    .eq('id', orderId);

  return true;
}

/** Reversión desde Stripe (dashboard o API): devolvemos el pedido a `failed`. */
export async function applyRefundedStatus({ db, orderId, paymentIntentId, amount }: {
  db: SupabaseClient;
  orderId: string;
  paymentIntentId: string | null;
  amount: number | null;
}) {
  await db
    .from('orders')
    .update({ payment_status: 'refunded', status: 'returned' })
    .eq('id', orderId);

  if (paymentIntentId) {
    await db
      .from('payments')
      .update({ status: 'refunded', ...(amount ? { amount } : {}) })
      .eq('provider_transaction_id', paymentIntentId);
  }

  return true;
}

// ------------------------------------------------------------- Checkout

export interface StartCheckoutInput {
  db: SupabaseClient;
  userId: string | null;
  customer: CustomerPayload;
  /** El navegador solo manda variantId + qty. */
  requestedItems: unknown;
  origin: string;
  /** Destino tras pagar; por defecto la confirmación del pedido. */
  returnPath?: string | null;
  /** Página de checkout que abrió la sesión (para el `cancel_url`). */
  checkoutPath?: string;
  /** Confirmación a la que volver si el cliente no manda `returnPath`. */
  defaultReturnPath?: string;
  /** Idioma de la tienda: la etiqueta de envío se manda a Stripe traducida. */
  lang?: 'es' | 'en';
  /** Código de cupón tal cual lo escribió el cliente (se valida aquí). */
  couponCode?: unknown;
}

export type StartCheckoutResult =
  | { ok: true; orderId: string; orderNumber: string | null; url: string }
  | { ok: false; code: string; message: string; status: number };

/**
 * Valida el carrito, crea el pedido pendiente y devuelve la URL de Stripe.
 * Todos los importes salen de la base de datos (`priceItems`).
 */
export async function startStripeCheckout({
  db,
  userId,
  customer,
  requestedItems,
  origin,
  returnPath,
  checkoutPath = '/checkout',
  defaultReturnPath = '/confirmacion',
  lang = 'es',
  couponCode,
}: StartCheckoutInput): Promise<StartCheckoutResult> {
  if (!isStripeConfigured()) {
    return {
      ok: false,
      code: 'PAYMENT_UNAVAILABLE',
      message: 'El pago con tarjeta no está disponible en este momento.',
      status: 503,
    };
  }

  if (stripeMode() === 'test' && (import.meta.env.PUBLIC_STRIPE_TEST_MODE as string | undefined) !== 'true') {
    // Evita "ventas" fantasma si producción quedó apuntando a llaves de prueba.
    console.warn('[checkout] STRIPE_SECRET_KEY es de prueba y PUBLIC_STRIPE_TEST_MODE no está activo');
  }

  let items: PricedItem[];
  try {
    items = await priceItems(db, Array.isArray(requestedItems) ? requestedItems : []);
  } catch (err: any) {
    if (err instanceof PricingError) {
      return { ok: false, code: 'UNAVAILABLE', message: err.message, status: 409 };
    }
    return { ok: false, code: 'SERVER', message: 'No pudimos validar tu carrito.', status: 500 };
  }

  const { subtotal, shipping } = totalsFor(items);
  const safeReturn = returnPath && returnPath.startsWith('/') && !returnPath.startsWith('//')
    ? returnPath
    : defaultReturnPath;

  // Cupón: si viene un código y no es válido, se corta la compra en vez de
  // cobrar de más. Si no viene, no se toca nada.
  let discount = 0;
  let appliedCoupon: string | null = null;

  if (couponCode) {
    const coupon = await resolveCoupon(db, couponCode, subtotal);

    if (!coupon.ok) {
      return {
        ok: false,
        code: 'INVALID_COUPON',
        message: couponMessage(coupon, lang),
        status: 409,
      };
    }

    discount = coupon.discount;
    appliedCoupon = coupon.code;
  }

  const paymentAmount = subtotal - discount + shipping;
  const finalAmount = round2(paymentAmount);

  // El pedido se crea DESPUÉS de validar (arriba) y ANTES de Stripe, para tener
  // un id estable al que amarrar la sesión.
  const { order } = await createPendingOrder({
    db,
    userId,
    customer,
    items,
    shippingCost: shipping,
    discount,
    couponCode: appliedCoupon,
    paymentAmount: finalAmount,
  });

  try {
    // Stripe no admite importes negativos: el descuento viaja como cupón de
    // un solo uso con el monto exacto calculado arriba.
    const stripeCoupon =
      discount > 0
        ? await createStripeCoupon({ amountOff: discount, name: appliedCoupon ?? 'Descuento' }).catch(
            (err: any) => {
              console.error('[checkout] cupón stripe', err?.message);
              return null;
            }
          )
        : null;

    const session = await createCheckoutSession({
      orderId: order.id,
      orderNumber: order.order_number,
      currency: 'USD',
      lines: items.map((i) => ({
        name: i.variantName ? `${i.name} — ${i.variantName}` : i.name,
        amount: i.price,
        qty: i.qty,
        image: i.image,
      })),
      shipping,
      stripeCouponId: stripeCoupon?.id ?? null,
      shippingLabel: lang === 'en' ? 'Standard shipping' : 'Envío estándar',
      clientReference: order.id,
      customerEmail: customer.email,
      successUrl: `${origin}${safeReturn}?order=${encodeURIComponent(order.order_number ?? order.id)}&stripe=return&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}${checkoutPath}?canceled=1`,
    });

    if (!session.url) throw new StripeError('Stripe no devolvió la URL de pago.');

    return { ok: true, orderId: order.id, orderNumber: order.order_number, url: session.url };
  } catch (err: any) {
    // Sin pago no debe quedar un pedido vivo.
    await db.from('order_items').delete().eq('order_id', order.id);
    await db.from('orders').delete().eq('id', order.id);
    console.error('[checkout] stripe session', err?.message);
    return {
      ok: false,
      code: 'PAYMENT_ERROR',
      message: 'No pudimos iniciar el pago. Intenta de nuevo en un momento.',
      status: 502,
    };
  }
}

/**
 * Al volver del Checkout: si Stripe dice que ya se pagó, aplicamos el pago
 * de inmediato (no esperamos al webhook, que puede llegar segundos después).
 */
export async function confirmSessionOnReturn({ db, sessionId }: {
  db: SupabaseClient;
  sessionId: string;
}) {
  const session = await retrieveCheckoutSession(sessionId);
  const orderId = session.metadata?.order_id ?? session.client_reference_id;

  if (!orderId || session.payment_status !== 'paid') return null;

  // Si ya estaba pagado, el correo ya salió (webhook o esta misma vuelta).
  const { data: before } = await db
    .from('orders')
    .select('payment_status')
    .eq('id', orderId)
    .maybeSingle();

  const wasPaid = before?.payment_status === 'approved';

  // Para una orden de prueba el reembolso interno no importa; el monto real
  // lo vuelve a leer el webhook si llega con `amount_total`.
  await applyPaidStatus({
    db,
    orderId,
    paymentIntentId: session.payment_intent ?? session.id,
    amount: 0,
  });

  // Confirmación por correo también en la vuelta de Stripe: sin webhook
  // configurado, esta es la única vía por la que sale el correo.
  if (!wasPaid) {
    const { data: order } = await db
      .from('orders')
      .select('contact_email, contact_name, order_number, total_amount')
      .eq('id', orderId)
      .maybeSingle();

    if (order?.contact_email) {
      sendOrderConfirmation({
        to: order.contact_email,
        orderNumber: order.order_number ?? orderId,
        customerName: order.contact_name ?? 'Cliente',
        total: `$${Number(order.total_amount ?? 0).toFixed(2)}`,
      }).catch(() => {});
    }
  }

  return orderId;
}

// ------------------------------------------------------- Acceso al pedido

/**
 * `/confirmacion` puede leer el pedido recién creado (aún sin pago) para
 * pedir «esperando confirmación», pero solo su dueño o el staff.
 */
export function canSeeOrder(
  { userId, isStaff }: { userId: string | null; isStaff: boolean },
  orderUserId: string | null
) {
  if (isStaff) return true;
  return Boolean(userId && orderUserId && userId === orderUserId);
}
