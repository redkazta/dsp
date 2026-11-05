/**
 * /api/admin/order-address — verificación manual de la dirección de envío.
 *
 * Solo staff. La captura del cliente no se valida contra ningún servicio: el
 * operador revisa, corrige y marca el estado desde el panel. Cada campo que
 * cambia queda registrado en `order_address_audit`.
 *
 *   GET  ?orderId=<uuid>  → { address, audit }
 *   POST { orderId, address, verificationStatus, notes }
 */
import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '../../../lib/supabase-server';
import { isUsPostalCode, usStateCode } from '../../../lib/us';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const STATUSES = new Set(['pending', 'verified', 'corrected', 'invalid']);

const text = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Campo del formulario → columna de `orders`. */
const FIELDS = {
  line1: 'shipping_street',
  line2: 'shipping_colonia',
  city: 'shipping_city',
  state: 'shipping_state',
  zip: 'shipping_postal_code',
  country: 'shipping_country',
  phone: 'contact_phone',
} as const;

type FieldKey = keyof typeof FIELDS;

const COLUMNS = [
  'order_number',
  'shipping_street',
  'shipping_colonia',
  'shipping_city',
  'shipping_state',
  'shipping_postal_code',
  'shipping_country',
  'contact_phone',
  'address_verification_status',
  'address_verification_notes',
  'address_verified_at',
].join(', ');

function toAddress(row: any) {
  return {
    line1: row?.shipping_street ?? '',
    line2: row?.shipping_colonia ?? '',
    city: row?.shipping_city ?? '',
    state: row?.shipping_state ?? '',
    zip: row?.shipping_postal_code ?? '',
    country: row?.shipping_country ?? 'US',
    phone: row?.contact_phone ?? '',
    verificationStatus: row?.address_verification_status ?? 'pending',
    notes: row?.address_verification_notes ?? '',
    verifiedAt: row?.address_verified_at ?? null,
  };
}

export const GET: APIRoute = async ({ locals, url }: any) => {
  if (!locals?.isStaff) return json({ error: 'forbidden' }, 403);

  const orderId = url.searchParams.get('orderId') ?? '';
  if (!orderId) return json({ error: 'invalid_body' }, 400);

  const db = createSupabaseAdminClient();
  if (!db) return json({ error: 'not_configured' }, 503);

  const { data: order, error } = await db.from('orders').select(COLUMNS).eq('id', orderId).maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!order) return json({ error: 'not_found' }, 404);

  const { data: audit } = await db
    .from('order_address_audit')
    .select('changed_at, field, old_value, new_value')
    .eq('order_id', orderId)
    .order('changed_at', { ascending: false })
    .limit(50);

  return json({ address: toAddress(order), audit: audit ?? [] });
};

export const POST: APIRoute = async ({ locals, request }: any) => {
  if (!locals?.isStaff) return json({ error: 'forbidden' }, 403);

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const orderId = text(payload?.orderId, 100);
  if (!orderId) return json({ error: 'invalid_body' }, 400);

  const input = payload?.address ?? {};
  const status = text(payload?.verificationStatus, 20) || 'pending';
  if (!STATUSES.has(status)) return json({ error: 'invalid_status' }, 400);

  const address = {
    line1: text(input?.line1, 200),
    line2: text(input?.line2, 120),
    city: text(input?.city, 100),
    state: usStateCode(text(input?.state, 50)),
    zip: text(input?.zip, 10),
    country: 'US',
    phone: text(input?.phone, 30),
  };

  // Solo formato: existencia de la dirección la decide el operador.
  if (!address.line1 || !address.city) return json({ error: 'missing_address' }, 400);
  if (!address.state) return json({ error: 'invalid_state' }, 400);
  if (!isUsPostalCode(address.zip)) return json({ error: 'invalid_zip' }, 400);

  const db = createSupabaseAdminClient();
  if (!db) return json({ error: 'not_configured' }, 503);

  const { data: current, error: readError } = await db
    .from('orders')
    .select(COLUMNS)
    .eq('id', orderId)
    .maybeSingle();

  if (readError) return json({ error: readError.message }, 500);
  if (!current) return json({ error: 'not_found' }, 404);

  const before = toAddress(current);

  const patch: Record<string, unknown> = {
    address_verification_status: status,
    address_verification_notes: text(payload?.notes, 1000) || null,
    updated_at: new Date().toISOString(),
  };

  // Cambio de estado: se firma con quién y cuándo.
  if (status !== before.verificationStatus && status !== 'pending') {
    patch.address_verified_by = locals.user?.id ?? null;
    patch.address_verified_at = new Date().toISOString();
  }

  const changes: Array<{ field: FieldKey; oldValue: string; newValue: string }> = [];

  for (const key of Object.keys(FIELDS) as FieldKey[]) {
    const column = FIELDS[key];
    const next = address[key];
    const prev = String((current as any)[column] ?? '');

    if ((next ?? '') !== prev) {
      patch[column] = next || null;
      changes.push({ field: key, oldValue: prev, newValue: next });
    }
  }

  const { error: updateError } = await db.from('orders').update(patch).eq('id', orderId);
  if (updateError) {
    console.error('[order-address] update', updateError.code, updateError.message);
    return json({ error: updateError.message }, 500);
  }

  if (changes.length > 0) {
    const { error: auditError } = await db.from('order_address_audit').insert(
      changes.map((c) => ({
        order_id: orderId,
        changed_by: locals.user?.id ?? null,
        field: FIELDS[c.field],
        old_value: c.oldValue || null,
        new_value: c.newValue || null,
      }))
    );

    // La dirección ya se guardó: un fallo del log no se oculta, pero tampoco
    // tumba la respuesta.
    if (auditError) {
      console.error('[order-address] audit', auditError.code, auditError.message);
    }
  }

  return json({ ok: true, changed: changes.length, verificationStatus: status });
};
