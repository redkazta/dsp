/**
 * /api/admin/settings — configuración de la tienda (ERP).
 *
 * Solo staff. Lee y escribe con service role; el navegador nunca toca la tabla.
 *
 *   GET  → { settings }
 *   POST { freeShippingThreshold, standardShipping, contactEmail, lowStockThreshold }
 */
import type { APIRoute } from 'astro';
import { getStoreSettings, saveStoreSettings } from '../../../lib/settings';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const GET: APIRoute = async (context: any) => {
  if (!context.locals?.isStaff) return json({ error: 'forbidden' }, 403);

  const settings = await getStoreSettings();
  return json({ settings });
};

export const POST: APIRoute = async (context: any) => {
  if (!context.locals?.isStaff) return json({ error: 'forbidden' }, 403);

  let payload: any;
  try {
    payload = await context.request.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const contactEmail = String(payload?.contactEmail ?? '').trim();
  if (contactEmail && !EMAIL.test(contactEmail)) {
    return json({ error: 'Revisa el correo de contacto.' }, 400);
  }

  try {
    const settings = await saveStoreSettings({
      freeShippingThreshold: payload?.freeShippingThreshold,
      standardShipping: payload?.standardShipping,
      contactEmail: contactEmail || undefined,
      lowStockThreshold: payload?.lowStockThreshold,
    });

    return json({ ok: true, settings });
  } catch (err: any) {
    console.error('[settings] save', err?.message);
    return json({ error: err?.message ?? 'No se pudo guardar.' }, 500);
  }
};
