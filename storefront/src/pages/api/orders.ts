/**
 * POST /api/orders
 *
 * Única puerta para crear un pedido. El navegador solo manda:
 *   - items: [{ variantId, qty }]
 *   - customer: datos de contacto y envío
 *   - card: número, nombre, vigencia y CVV (pago simulado)
 *
 * El servidor decide:
 *   - quién es el comprador (sesión de Supabase, no el cliente)
 *   - cuánto cuesta cada pieza (producto en `product_variants`)
 *   - si el pago se aprueba (validación de tarjeta en servidor)
 *
 * Si `SUPABASE_SERVICE_ROLE_KEY` está configurada escribe con service role
 * (obligatorio para comprar como invitado y para insertar en `payments`).
 * Si no, exige sesión y escribe con RLS.
 */
import type { APIRoute } from 'astro';
import type { AstroCookies } from 'astro';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createSupabaseServerClient,
  createSupabaseAdminClient,
} from '../../lib/supabase-server';
import { TENANT_ID, CHECKOUT_NOTES_MARKER } from '../../lib/constants';
import { priceItems, totalsFor, PricingError } from '../../lib/pricing';
import { validateSimulatedCard } from '../../lib/card';

export const prerender = false;

const API_URL = import.meta.env.PUBLIC_API_URL ?? '';
const INTERNAL_API_TOKEN = import.meta.env.INTERNAL_API_TOKEN ?? '';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const error = (code: string, message: string, status: number) =>
  json({ error: message, code }, status);

interface CustomerPayload {
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

function readCustomer(payload: any): CustomerPayload | null {
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

export const POST: APIRoute = async ({ request, cookies }: { request: Request; cookies: AstroCookies }) => {
  const sessionClient = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return error('BAD_REQUEST', 'Cuerpo inválido.', 400);
  }

  const customer = readCustomer(payload);
  if (!customer) return error('BAD_REQUEST', 'Revisa los datos de contacto y envío.', 400);

  const card = validateSimulatedCard({
    number: str(payload?.card?.number, 23),
    name: str(payload?.card?.name, 80),
    expiry: str(payload?.card?.expiry, 7),
    cvv: str(payload?.card?.cvv, 4),
  });
  if (!card.ok) return error('CARD_DECLINED', card.error, 402);

  // Cliente de escritura: service role si existe; si no, sesión (RLS)
  const admin = createSupabaseAdminClient();
  const db: SupabaseClient = admin ?? sessionClient;

  if (!admin && !user) {
    return error('NO_SESSION', 'Inicia sesión o crea tu cuenta para completar el pedido.', 401);
  }

  // ---------- Precios autoritativos ----------
  let items: Awaited<ReturnType<typeof priceItems>>;
  try {
    items = await priceItems(db, payload?.items ?? []);
  } catch (err: any) {
    if (err instanceof PricingError) return error('UNAVAILABLE', err.message, 409);
    return error('SERVER', 'No pudimos validar tu carrito.', 500);
  }

  const { subtotal, shipping, total } = totalsFor(items);

  // ---------- Pedido ----------
  const { data: order, error: orderError } = await db
    .from('orders')
    .insert({
      tenant_id: TENANT_ID,
      user_id: user?.id ?? null,
      status: 'confirmed',
      payment_status: 'approved',
      payment_method: 'simulated',
      subtotal,
      shipping_cost: shipping,
      total_amount: total,
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

  if (orderError || !order) {
    console.error('[api/orders] order insert', orderError?.code, orderError?.message);
    return error('SERVER', 'No se pudo crear el pedido.', 500);
  }

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
    console.error('[api/orders] items insert', itemsError.code, itemsError.message);
    // El pedido no debe quedar a medias
    await db.from('orders').delete().eq('id', order.id);
    return error('SERVER', 'No se pudo registrar el detalle del pedido.', 500);
  }

  // Registro del pago simulado (best-effort: es auditoría, no bloquea la venta)
  await db.from('payments').insert({
    tenant_id: TENANT_ID,
    order_id: order.id,
    amount: total,
    provider: 'simulated',
    provider_transaction_id: `SIM-${Date.now()}`,
    status: 'completed',
  });

  // Espejo opcional en el backend .NET (autenticado, no bloquea la venta)
  if (API_URL) {
    fetch(`${API_URL.replace(/\/$/, '')}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(INTERNAL_API_TOKEN ? { Authorization: `Bearer ${INTERNAL_API_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        orderNumber: order.order_number,
        totalAmount: total,
        customer,
        items,
      }),
    }).catch(() => undefined);
  }

  return json({
    id: order.id,
    orderNumber: order.order_number,
    subtotal,
    shipping,
    total: Number(order.total_amount),
  });
};
