/**
 * Stripe (solo servidor).
 *
 * - Se habla con la API REST de Stripe por `fetch`: sin SDK, sin dependencias
 *   nuevas y sin riesgo de romper el lockfile del build.
 * - La llave secreta NUNCA se importa desde el navegador: este módulo solo lo
 *   cargan `/api/checkout` y `/api/webhooks/stripe`.
 * - `STRIPE_SECRET_KEY` puede ser `sk_test_…` o `sk_live_…`: el código es el
 *   mismo, solo cambian las variables de entorno en Vercel.
 */

import { createHmac } from 'node:crypto';
import { serverEnv } from './env';

// Tipos de Node: el proyecto no trae `@types/node` (no hay lockfile para
// instalarlo sin riesgo). La firma del módulo vive en `src/env.d.ts`.

const STRIPE_API = 'https://api.stripe.com/v1';

const secretKey = () => serverEnv('STRIPE_SECRET_KEY') ?? '';
const publishableKey = () => (import.meta.env.PUBLIC_STRIPE_PUBLISHABLE_KEY as string | undefined) ?? '';

/** ¿Está configurado el pago real? Si no, el checkout no se ofrece. */
export function isStripeConfigured() {
  return Boolean(secretKey() && publishableKey());
}

/** Un modo por llave, para avisar en el panel si esto sigue en pruebas. */
export function stripeMode(): 'test' | 'live' | 'off' {
  const key = secretKey();
  if (!key) return 'off';
  return key.startsWith('sk_live_') ? 'live' : 'test';
}

const authHeaders = () => ({
  'Content-Type': 'application/x-www-form-urlencoded',
  Authorization: `Bearer ${secretKey()}`,
});

/** Convierte { a: 1, b: { c: 2 }, list: [x] } al formato form-encoded de Stripe. */
function toForm(body: Record<string, unknown>) {
  const params = new URLSearchParams();

  const walk = (prefix: string, value: unknown) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(`${prefix}[${i}]`, v));
      return;
    }
    if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        walk(`${prefix}[${k}]`, v);
      }
      return;
    }
    params.append(prefix, String(value));
  };

  for (const [k, v] of Object.entries(body)) walk(k, v);
  return params.toString();
}

export class StripeError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

async function stripeRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  if (!secretKey()) {
    throw new StripeError('Stripe no está configurado.', 503);
  }

  let res: Response;
  try {
    res = await fetch(`${STRIPE_API}${path}`, {
      method,
      headers: authHeaders(),
      body: method === 'POST' && body ? toForm(body) : undefined,
    });
  } catch {
    throw new StripeError('No pudimos conectar con Stripe.', 503);
  }

  const data: any = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error('[stripe]', path, res.status, data?.error?.type, data?.error?.message);
    throw new StripeError(data?.error?.message ?? 'Stripe rechazó la solicitud.', res.status);
  }

  return data as T;
}

// ---------------------------------------------------------------- Checkout

export interface CheckoutLine {
  name: string;
  /** Importe unitario en la moneda de la tienda (ej. 35.50). */
  amount: number;
  qty: number;
  image?: string | null;
}

export interface CheckoutSessionInput {
  orderId: string;
  orderNumber: string | null;
  currency: string;
  lines: CheckoutLine[];
  /** Envío a cobrar aparte (0 = gratis: no se agrega línea). */
  shipping: number;
  /** Id de cupón de Stripe (descuento ya validado en servidor). */
  stripeCouponId?: string | null;
  clientReference: string;
  customerEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
  shippingLabel: string;
}

export interface CheckoutSession {
  id: string;
  url: string | null;
  payment_intent: string | null;
}

/** Stripe trabaja en la unidad mínima: centavos. */
const toMinor = (amount: number) => Math.round(amount * 100);

/**
 * Abre una Checkout Session alojada por Stripe.
 *
 * Los importes ya vienen recalculados en servidor (`priceItems`): aquí solo
 * se traducen al formato de Stripe. La tarjeta se captura en el dominio de
 * Stripe —el PAN nunca toca nuestro servidor— y `payment_method_types` se
 * deja abierto para que aparezcan las carteras habilitadas en la cuenta
 * (Apple Pay, Google Pay, Link…).
 */
export async function createCheckoutSession(input: CheckoutSessionInput) {
  const currency = input.currency.toLowerCase();

  const body: Record<string, unknown> = {
    mode: 'payment',
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.clientReference,
    line_items: input.lines.map((line) => ({
      quantity: line.qty,
      price_data: {
        currency,
        unit_amount: toMinor(line.amount),
        product_data: {
          name: line.name.slice(0, 250),
          ...(line.image && /^https?:\/\//i.test(line.image) ? { images: [line.image] } : {}),
        },
      },
    })),
    metadata: {
      order_id: input.orderId,
      order_number: input.orderNumber ?? '',
    },
    payment_intent_data: {
      metadata: {
        order_id: input.orderId,
        order_number: input.orderNumber ?? '',
      },
    },
    billing_address_collection: 'required',
    locale: 'es',
  };

  if (input.customerEmail) body.customer_email = input.customerEmail;

  // Descuento: Stripe no acepta líneas negativas, así que se aplica un cupón
  // de un solo uso creado al vuelo con el importe ya calculado en servidor.
  if (input.stripeCouponId) {
    body.discounts = [{ coupon: input.stripeCouponId }];
  }

  // El envío va como línea aparte: nuestro envío es plano
  // ($15, gratis desde $150), no hace falta Shipping Rates en Stripe.
  if (input.shipping > 0) {
    (body.line_items as unknown[]).push({
      quantity: 1,
      price_data: {
        currency,
        unit_amount: toMinor(input.shipping),
        product_data: { name: input.shippingLabel.slice(0, 250) },
      },
    });
  }

  return stripeRequest<CheckoutSession>('POST', '/checkout/sessions', body);
}

// ---------------------------------------------------------------- Cupones

/**
 * Cupón de Stripe de un solo uso por el importe exacto del descuento.
 * Se crea al abrir la sesión: el monto ya salió de `resolveCoupon`.
 */
export async function createStripeCoupon({
  amountOff,
  name,
  currency = 'usd',
}: {
  amountOff: number;
  name: string;
  currency?: string;
}) {
  return stripeRequest<{ id: string }>('POST', '/coupons', {
    amount_off: Math.max(1, Math.round(amountOff * 100)),
    currency: currency.toLowerCase(),
    duration: 'once',
    name: name.slice(0, 40),
  });
}

/** Estado de la sesión al volver del Checkout (pago asíncrono, 3DS, etc.). */
export async function retrieveCheckoutSession(sessionId: string) {
  return stripeRequest<{
    id: string;
    status: string | null;
    payment_status: 'paid' | 'unpaid' | 'no_payment_required' | null;
    payment_intent: string | null;
    client_reference_id: string | null;
    metadata: Record<string, string> | null;
  }>('GET', `/checkout/sessions/${encodeURIComponent(sessionId)}`);
}

// ----------------------------------------------------------------- Webhook

/**
 * Verifica la firma `Stripe-Signature` del webhook.
 *
 * Sin esto, cualquiera podría hacer POST a `/api/webhooks/stripe` y marcar
 * pedidos como pagados. Ver: docs.stripe.com/webhooks/signature
 */
export function verifyWebhookSignature(
  payload: string,
  header: string | null,
  secret: string | undefined,
  toleranceSeconds = 300
): boolean {
  if (!secret || !header) return false;

  let timestamp = '';
  const signatures: string[] = [];

  for (const part of header.split(',')) {
    const [k, v] = part.split('=');
    if (k === 't') timestamp = v ?? '';
    if (k === 'v1' && v) signatures.push(v);
  }

  if (!timestamp || signatures.length === 0) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;

  const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');

  // Comparación en tiempo constante sobre los hex: mismo resultado que
  // `timingSafeEqual(Buffer(a), Buffer(b))` sin depender de los tipos de Node.
  return signatures.some((sig) => {
    if (sig.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) {
      diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return diff === 0;
  });
}

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: any };
}
