/**
 * POST /api/admin/shipment — genera la guía FedEx de un pedido.
 *
 * Solo staff, y solo si la dirección ya fue verificada a mano. Reglas:
 *   · `pending` o `invalid` → 409 (no se gasta guía).
 *   · FedEx rechaza la dirección → el pedido pasa a `invalid` y se avisa.
 *   · La guía se guarda en Storage y se envía al cliente por correo.
 *
 *   POST { orderId, productCode? }
 *   → { ok, trackingNumber, labelUrl }
 */
import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '../../../lib/supabase-server';
import { createLabel, isFedexConfigured, labelBlockReason } from '../../../lib/fedex';
import { DEFAULT_PACKAGE } from '../../../lib/shipping';
import { sendShippingLabel } from '../../../lib/resend';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

/** Peso y medidas por defecto de una pieza (libras / pulgadas). */
const LABEL_PACKAGE = DEFAULT_PACKAGE;

const LABEL_BUCKET = 'shipping-labels';

/** base64 → bytes, sin depender de los tipos de Node. */
function decodeBase64(value: string): Uint8Array {
  const g = globalThis as any;
  if (g.Buffer) return g.Buffer.from(value, 'base64');
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export const POST: APIRoute = async ({ locals, request }: any) => {
  if (!locals?.isStaff) return json({ error: 'forbidden' }, 403);
  if (!isFedexConfigured()) return json({ error: 'fedex_not_configured' }, 503);

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const orderId = typeof payload?.orderId === 'string' ? payload.orderId.trim() : '';
  const productCode = typeof payload?.productCode === 'string' ? payload.productCode.trim() : '';
  if (!orderId) return json({ error: 'invalid_body' }, 400);

  const db = createSupabaseAdminClient();
  if (!db) return json({ error: 'not_configured' }, 503);

  const { data: order } = await db
    .from('orders')
    .select(
      'id, order_number, contact_name, contact_email, contact_phone, shipping_street, shipping_colonia, shipping_city, shipping_state, shipping_postal_code, address_verification_status, carrier, tracking_number, notes'
    )
    .eq('id', orderId)
    .maybeSingle();

  if (!order) return json({ error: 'not_found' }, 404);

  const verification = order.address_verification_status ?? 'pending';

  const blocked = labelBlockReason(verification);
  if (blocked) return json({ error: blocked === 'invalid' ? 'address_invalid' : 'address_not_verified' }, 409);

  if (order.tracking_number) {
    return json({ error: 'already_shipped', trackingNumber: order.tracking_number }, 409);
  }

  const result = await createLabel({
    orderNumber: String(order.order_number ?? order.id),
    destination: {
      name: String(order.contact_name ?? 'Customer'),
      line1: String(order.shipping_street ?? ''),
      line2: String(order.shipping_colonia ?? ''),
      city: String(order.shipping_city ?? ''),
      state: String(order.shipping_state ?? ''),
      zip: String(order.shipping_postal_code ?? ''),
      phone: String(order.contact_phone ?? ''),
      email: String(order.contact_email ?? ''),
    },
    packages: [LABEL_PACKAGE],
    productCode: productCode || 'FEDEX_GROUND',
  });

  if (!result.ok) {
    // Dirección rechazada por FedEx: se marca para que el operador la corrija.
    if (result.reason === 'address_rejected') {
      await db
        .from('orders')
        .update({
          address_verification_status: 'invalid',
          address_verification_notes: 'FedEx rechazó la dirección al generar la guía.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      return json({ error: 'address_rejected' }, 422);
    }

    return json({ error: result.reason }, 502);
  }

  const { trackingNumber, documents } = result.data;

  // 1. Guardar el PDF en Storage (best-effort: si el bucket no existe, la
  //    guía sigue válida y se envía por correo).
  let labelUrl: string | null = null;
  const label = documents.find((d) => d.type === 'label' || d.imageFormat === 'PDF') ?? documents[0];

  if (label?.content) {
    try {
      const path = `${orderId}/${trackingNumber}.pdf`;
      const { error: uploadError } = await db.storage
        .from(LABEL_BUCKET)
        .upload(path, decodeBase64(label.content), { contentType: 'application/pdf', upsert: true });

      if (uploadError) {
        console.warn('[shipment] storage:', uploadError.message);
      } else {
        labelUrl = db.storage.from(LABEL_BUCKET).getPublicUrl(path).data.publicUrl;
      }
    } catch (err: any) {
      console.warn('[shipment] storage exception:', err?.message);
    }
  }

  // 2. Pedido: guía + folio.
  const { error: updateError } = await db
    .from('orders')
    .update({
      carrier: 'FedEx',
      tracking_number: trackingNumber,
      ...(labelUrl ? { shipping_label_url: labelUrl } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (updateError) return json({ error: updateError.message }, 500);

  // 3. Correo al cliente con la guía adjunta (best-effort).
  if (order.contact_email) {
    const { data: langRow } = await db.from('orders').select('lang').eq('id', orderId).maybeSingle();
    const lang: 'es' | 'en' = (langRow as any)?.lang === 'en' ? 'en' : 'es';

    try {
      await sendShippingLabel({
        to: String(order.contact_email),
        orderNumber: order.order_number ? String(order.order_number) : null,
        trackingNumber,
        pdfBase64: label?.content ?? null,
        imageFormat: label?.imageFormat ?? 'PDF',
        lang,
      });
    } catch (err: any) {
      console.warn('[shipment] correo:', err?.message);
    }
  }

  return json({ ok: true, trackingNumber, labelUrl });
};
