/**
 * POST /api/shipping/quote — tarifas FedEx para un destino de EE. UU.
 *
 * Público (lo usa el checkout). Nunca devuelve credenciales ni detalles de
 * FedEx: solo opciones en USD o un aviso para que el cliente siga con la
 * tarifa plana configurada en `store_settings`.
 *
 *   POST { zip, city, state?, items: [{ qty }] }
 *   → { configured, options: [{ productCode, productName, amount, currency, estimatedDays }] }
 */
import type { APIRoute } from 'astro';
import { isUsPostalCode } from '../../../lib/us';
import { isFedexConfigured, quoteRates, type FedexPackage } from '../../../lib/fedex';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

/** Peso y medidas por defecto de una pieza de ropa (libras / pulgadas). */
const DEFAULT_PACKAGE: FedexPackage = { weight: 1.2, length: 12, width: 10, height: 2 };

export const POST: APIRoute = async ({ request }) => {
  if (!isFedexConfigured()) {
    return json({ configured: false, options: [] });
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const zip = typeof payload?.zip === 'string' ? payload.zip.trim() : '';
  const city = typeof payload?.city === 'string' ? payload.city.trim() : '';
  const state = typeof payload?.state === 'string' ? payload.state.trim() : '';

  if (!isUsPostalCode(zip)) return json({ error: 'invalid_zip' }, 400);

  const items: any[] = Array.isArray(payload?.items) ? payload.items : [];
  const quantity = Math.max(
    1,
    Math.min(99, items.reduce((n: number, i: any) => n + (Number(i?.qty) || 0), 0) || 1)
  );

  // Un paquete por pieza: simplifica el cálculo y evita sobrepeso por caja.
  const packages: FedexPackage[] = Array.from({ length: quantity }, () => DEFAULT_PACKAGE);

  const result = await quoteRates({
    destinationZip: zip,
    destinationCity: city,
    destinationState: state || undefined,
    packages,
  });

  if (!result.ok) {
    // El checkout no se rompe: cae a la tarifa plana.
    return json({ configured: true, options: [], reason: result.reason });
  }

  return json({ configured: true, options: result.data });
};
