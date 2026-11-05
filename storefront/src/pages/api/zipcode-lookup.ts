/**
 * GET /api/zipcode-lookup?zip=76104 — ciudad y estado desde el catálogo local.
 *
 * Público y de solo lectura. No requiere auth ni llama a APIs externas: el
 * catálogo vive en `data/us_zipcodes.json` y se indexa en memoria al arrancar.
 * Solo devuelve el resultado de la consulta, nunca el catálogo completo.
 *
 *   200 { city: 'Fort Worth', state: 'TX' }
 *   200 { city: null, state: null }        ZIP con formato válido pero desconocido
 *   400 { error: 'invalid_zip' }           formato distinto de 5 dígitos
 */
import type { APIRoute } from 'astro';
import { lookupZipcode } from '../../lib/zipcodes';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // El catálogo es estático: se puede cachear, pero no para siempre (se
      // actualiza cuando se reemplaza el JSON).
      'Cache-Control': 'public, max-age=86400',
    },
  });

export const GET: APIRoute = async ({ request }) => {
  const zip = new URL(request.url).searchParams.get('zip')?.trim() ?? '';

  if (!/^\d{5}$/.test(zip)) return json({ error: 'invalid_zip' }, 400);

  const entry = lookupZipcode(zip);
  return json({ city: entry?.city ?? null, state: entry?.state ?? null });
};
