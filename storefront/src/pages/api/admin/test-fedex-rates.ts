// TEMPORAL: eliminar antes de producción
/**
 * GET /api/admin/test-fedex-rates — diagnóstico de tarifas FedEx (sandbox).
 *
 * Solo staff autenticado. Cotiza desde el origen configurado
 * (`FEDEX_ORIGIN_*`) hacia cinco ZIPs de prueba y devuelve, por ZIP, el
 * resultado normalizado **y la respuesta cruda de FedEx** para inspección.
 *
 * Restricción de Rating Data: la respuesta cruda solo viaja en esta respuesta
 * HTTP al admin autenticado; no se persiste, no se cachea y no se loguea.
 *
 *   200 { origin, baseUrl, results: [...] }
 *   401 sin sesión · 403 con sesión que no es staff · 503 FedEx sin configurar
 */
import type { APIRoute } from 'astro';
import { fedexConfig, quoteRatesRaw, type FedexRateOption } from '../../../lib/fedex';
import { DEFAULT_PACKAGE } from '../../../lib/shipping';
import { lookupZipcode } from '../../../lib/zipcodes';

export const prerender = false;

const TEST_ZIPS = ['10001', '90001', '60601', '33101', '98101'] as const;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });

interface FedexIssue {
  code: string | null;
  message: string | null;
}

function issuesFrom(raw: any, key: 'warnings' | 'errors'): FedexIssue[] {
  const list = Array.isArray(raw?.[key]) ? raw[key] : [];
  return list.map((item: any) => ({
    code: item?.code ?? item?.errorCode ?? null,
    message: item?.message ?? item?.localizedMessage ?? null,
  }));
}

function cheapest(options: FedexRateOption[]): FedexRateOption | null {
  return options.reduce<FedexRateOption | null>(
    (best, option) => (best === null || option.amount < best.amount ? option : best),
    null
  );
}

export const GET: APIRoute = async ({ locals }: any) => {
  if (!locals?.user) return json({ error: 'unauthorized' }, 401);
  if (!locals?.isStaff) return json({ error: 'forbidden' }, 403);

  const config = fedexConfig();
  if (!config) return json({ error: 'fedex_not_configured' }, 503);

  const results = [];

  // Secuencial: 5 llamadas caben en el timeout de la función y no se dispara
  // el rate limit de FedEx. Un fallo en un ZIP no corta los demás.
  for (const zip of TEST_ZIPS) {
    const entry = lookupZipcode(zip);
    const quote = await quoteRatesRaw({
      destinationZip: zip,
      destinationCity: entry?.city ?? '',
      destinationState: entry?.state,
      packages: [DEFAULT_PACKAGE],
    });

    const best = cheapest(quote.options);

    results.push({
      zip,
      city: entry?.city ?? null,
      state: entry?.state ?? null,
      status: quote.ok ? 'ok' : 'error',
      reason: quote.reason,
      error: quote.error,
      fedexStatus: quote.status,
      priceUsd: best ? best.amount : null,
      currency: best ? best.currency : null,
      estimatedDays: best ? best.estimatedDays : null,
      deliveryDate: best ? best.deliveryDate : null,
      services: quote.options,
      warnings: issuesFrom(quote.raw, 'warnings'),
      errors: issuesFrom(quote.raw, 'errors'),
      // Respuesta cruda de FedEx (solo en esta respuesta; no se persiste).
      raw: quote.raw,
    });
  }

  return json({
    temporary: true,
    origin: {
      zip: config.originZip,
      city: config.originCity,
      state: config.originState,
      country: config.originCountry,
    },
    baseUrl: config.baseUrl,
    results,
  });
};
