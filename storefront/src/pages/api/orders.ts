/**
 * POST /api/orders
 *
 * Guarda el pedido en Supabase (fuente de verdad del panel) y, si la API
 * .NET está disponible, publica el espejo sin bloquear la venta.
 */
import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../lib/supabase-server';
import { TENANT_ID } from '../../lib/constants';

export const prerender = false;

const API_URL = import.meta.env.PUBLIC_API_URL || '';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ request, cookies }: { request: Request; cookies: any }) => {
  const supabase = createSupabaseServerClient(request, cookies);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400);
  }

  const items: any[] = payload?.items ?? [];
  const customer = payload?.customer ?? {};

  if (items.length === 0) return json({ error: 'El carrito está vacío' }, 400);
  if (!customer.firstName || !customer.email) {
    return json({ error: 'Faltan datos de contacto' }, 400);
  }

  const subtotal = items.reduce((sum: number, i: any) => sum + Number(i.price) * Number(i.qty),
    0
  );
  const shipping = Number(payload?.shippingCost ?? 0);

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      tenant_id: TENANT_ID,
      user_id: user?.id ?? null,
      status: 'confirmed',
      payment_status: 'approved',
      payment_method: payload?.paymentMethod ?? 'simulated',
      subtotal,
      shipping_cost: shipping,
      total_amount: subtotal + shipping,
      contact_name: `${customer.firstName} ${customer.lastName ?? ''}`.trim(),
      contact_email: customer.email,
      contact_phone: customer.phone ?? null,
      shipping_street: customer.street ?? null,
      shipping_colonia: customer.colonia ?? null,
      shipping_city: customer.city ?? null,
      shipping_state: customer.state ?? null,
      shipping_postal_code: customer.postalCode ?? null,
      notes: customer.notes ?? null,
    })
    .select('id, order_number')
    .single();

  if (error || !order) {
    return json({ error: error?.message ?? 'No se pudo crear el pedido' }, 500);
  }

  const { error: itemsError } = await supabase.from('order_items').insert(
    items.map((i: any) => ({
      order_id: order.id,
      product_variant_id: i.variantId,
      product_id: i.productId,
      product_name: i.name,
      variant_name: i.variantName,
      size: i.size ?? null,
      color: i.color ?? null,
      image_url: i.image ?? null,
      quantity: i.qty,
      unit_price: i.price,
    }))
  );

  if (itemsError) return json({ error: itemsError.message }, 500);

  // Espejo opcional en el backend .NET
  if (API_URL) {
    fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderNumber: order.order_number,
        totalAmount: subtotal + shipping,
        customer,
        items,
      }),
    })
      .then(() => undefined)
      .catch(() => undefined);
  }

  return json({ id: order.id, orderNumber: order.order_number });
};
