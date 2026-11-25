/**
 * Recibo de compra (servidor).
 *
 * Reúne lo que el correo necesita: cliente, piezas, totales y dirección.
 * Lo usan tanto la vuelta de Stripe como el webhook, para que el cliente y
 * la copia interna reciban el mismo detalle sin consultar la BD dos veces.
 *
 * Si el select completo falla (una instalación sin alguna migración), se
 * cae al aviso mínimo de siempre: un pedido pagado nunca debe quedarse sin
 * correo por un detalle del recibo.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatOrderMoney, shippingServiceLabel, type OrderReceipt } from './orders';
import { round2 } from './pricing';
import { sendOrderConfirmation } from './resend';

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const money = (value: unknown) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};

/** Lee el pedido y sus líneas. Devuelve `null` si no se puede armar. */
export async function loadOrderReceipt(
  db: SupabaseClient,
  orderId: string,
  lang: 'es' | 'en' = 'es'
): Promise<OrderReceipt | null> {
  const { data: order, error } = await db
    .from('orders')
    .select(
      'id, order_number, contact_name, contact_email, contact_phone, subtotal, shipping_cost, total_amount, shipping_method, carrier, shipping_street, shipping_colonia, shipping_city, shipping_state, shipping_postal_code, shipping_references, created_at'
    )
    .eq('id', orderId)
    .maybeSingle();

  if (error) {
    console.error('[receipt] orders', error.code, error.message);
    return null;
  }

  if (!order) return null;

  const { data: rows, error: itemsError } = await db
    .from('order_items')
    .select('product_name, variant_name, size, color, quantity, unit_price')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (itemsError) {
    console.error('[receipt] order_items', itemsError.code, itemsError.message);
  }

  const items = (rows ?? []).map((row: any) => ({
    name:
      text(row.product_name) ||
      text(row.variant_name) ||
      (lang === 'en' ? 'Item' : 'Pieza'),
    variantName: text(row.variant_name) || null,
    size: text(row.size) || null,
    color: text(row.color) || null,
    quantity: money(row.quantity),
    unitPrice: money(row.unit_price),
  }));

  const itemsTotal = round2(
    items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  );
  const storedSubtotal = money(order.subtotal);
  const subtotal = storedSubtotal > 0 ? storedSubtotal : itemsTotal;
  const shipping = money(order.shipping_cost);
  const total = money(order.total_amount);
  const discount = Math.max(0, round2(subtotal + shipping - total));

  const cityState = [text(order.shipping_city), text(order.shipping_state)]
    .filter(Boolean)
    .join(', ');
  const cityLine = [cityState, text(order.shipping_postal_code)]
    .filter(Boolean)
    .join(' ');
  const references = text(order.shipping_references);

  const shippingAddress = [
    text(order.shipping_street),
    text(order.shipping_colonia),
    cityLine,
    references ? `${lang === 'en' ? 'Reference' : 'Referencias'}: ${references}` : '',
  ].filter(Boolean);

  return {
    orderId,
    orderNumber: text(order.order_number) || orderId,
    customerName:
      text(order.contact_name) || (lang === 'en' ? 'Customer' : 'Cliente'),
    customerEmail: text(order.contact_email),
    customerPhone: text(order.contact_phone) || null,
    createdAt: order.created_at ?? null,
    items,
    subtotal,
    shipping,
    discount,
    total,
    shippingMethod: shippingServiceLabel(order.shipping_method ?? order.carrier),
    shippingAddress,
  };
}

/**
 * Confirma un pedido pagado y manda la copia del recibo.
 *
 * Lo llaman el webhook de Stripe y las dos vueltas de pago. El correo lleva
 * BCC fijo a `ORDER_COPY_EMAIL` (ver `resend.ts`).
 */
export async function sendOrderReceipt({
  db,
  orderId,
  lang = 'es',
}: {
  db: SupabaseClient;
  orderId: string;
  lang?: 'es' | 'en';
}) {
  const receipt = await loadOrderReceipt(db, orderId, lang).catch((err: any) => {
    console.error('[receipt] no se pudo leer el detalle:', err?.message);
    return null;
  });

  if (receipt) {
    if (!receipt.customerEmail) return { ok: false, reason: 'no_email' };

    return sendOrderConfirmation({
      to: receipt.customerEmail,
      orderNumber: receipt.orderNumber,
      customerName: receipt.customerName,
      total: formatOrderMoney(receipt.total),
      lang,
      receipt,
    });
  }

  // Respaldo: el aviso mínimo que ya existía, sin detalle de piezas.
  const { data: order } = await db
    .from('orders')
    .select('contact_email, contact_name, order_number, total_amount')
    .eq('id', orderId)
    .maybeSingle();

  if (!order?.contact_email) return { ok: false, reason: 'no_email' };

  return sendOrderConfirmation({
    to: order.contact_email,
    orderNumber: order.order_number ?? orderId,
    customerName:
      order.contact_name ?? (lang === 'en' ? 'Customer' : 'Cliente'),
    total: `$${Number(order.total_amount ?? 0).toFixed(2)}`,
    lang,
  });
}
