/**
 * FedEx — Rates and Transit Times API + Ship API (solo backend).
 *
 *   · `quoteRates()`   → POST /rate/v1/rates/quotes
 *   · `createLabel()`  → POST /ship/v1/shipments
 *
 * Reglas:
 *   · OAuth 2.0 `client_credentials`; el token dura 60 min y se cachea ~55 min.
 *   · Credenciales por variables de entorno; nunca llegan al cliente.
 *   · Tarifas en USD y solo servicios domésticos de EE. UU.
 *   · Caché de tarifas en memoria de 10 min. Jamás en base de datos.
 *   · Si FedEx falla, `ok: false` y el checkout sigue con la tarifa plana.
 *
 * Entornos:
 *   sandbox     https://apis-sandbox.fedex.com
 *   producción  https://apis.fedex.com
 */

import { serverEnv } from './env';
import { isUsPostalCode, usStateCode } from './us';

export interface FedexPackage {
  /** Libras. */
  weight: number;
  /** Pulgadas. */
  length: number;
  width: number;
  height: number;
}

export interface FedexRateInput {
  destinationZip: string;
  destinationCity: string;
  destinationState?: string;
  packages: FedexPackage[];
  declaredValue?: number;
}

export interface FedexRateOption {
  /** `serviceType` que luego se envía a /ship. */
  productCode: string;
  productName: string;
  amount: number;
  currency: string;
  deliveryDate: string | null;
  estimatedDays: number | null;
}

export type FedexResult<T> = { ok: true; data: T } | { ok: false; reason: string };

export interface FedexDocument {
  /** `label`, `waybillDoc`, … */
  type: string;
  imageFormat: string;
  /** Contenido base64 tal como lo entrega FedEx. */
  content: string;
}

const TOKEN_TTL_MS = 55 * 60 * 1000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const TOKEN_TIMEOUT_MS = 5000;
const RATE_TIMEOUT_MS = 4000;
const SHIPMENT_TIMEOUT_MS = 12000;

const rateCache = new Map<string, { at: number; value: FedexResult<FedexRateOption[]> }>();

let tokenCache: { key: string; token: string; expiresAt: number } | null = null;

interface FedexConfig {
  clientId: string;
  clientSecret: string;
  account: string;
  baseUrl: string;
  originZip: string;
  originCity: string;
  originState: string;
  originCountry: string;
  originAddress: string;
  originCompany: string;
  originPhone: string;
}

/** Aviso único: no se repite en cada request del servidor. */
let originWarningShown = false;

function warnOrigin(message: string) {
  if (originWarningShown) return;
  originWarningShown = true;
  console.warn('[fedex]', message);
}

/**
 * Configuración efectiva. `null` cuando FedEx no está habilitado.
 *
 * El origen es fijo (bodega). ZIP, ciudad y estado son **obligatorios**: sin
 * ellos no se cotiza, para no mandar un shipper incoherente (ZIP de una
 * ciudad con el nombre de otra). Países distintos de `US` no se aceptan.
 */
export function fedexConfig(): FedexConfig | null {
  const clientId = serverEnv('FEDEX_CLIENT_ID');
  const clientSecret = serverEnv('FEDEX_CLIENT_SECRET');
  const account = serverEnv('FEDEX_ACCOUNT_NUMBER');
  const rawZip = serverEnv('FEDEX_ORIGIN_ZIP');

  if (!clientId || !clientSecret || !account || !rawZip) return null;

  const originZip = rawZip.trim();
  const originCity = (serverEnv('FEDEX_ORIGIN_CITY') ?? '').trim();
  const originState = usStateCode(serverEnv('FEDEX_ORIGIN_STATE') ?? '');
  const originCountry = (serverEnv('FEDEX_ORIGIN_COUNTRY') ?? 'US').toUpperCase();

  if (!isUsPostalCode(originZip)) {
    warnOrigin('FEDEX_ORIGIN_ZIP debe ser un ZIP de EE. UU. (12345 o 12345-6789). No se cotiza con FedEx.');
    return null;
  }

  if (originCountry !== 'US') {
    warnOrigin('FEDEX_ORIGIN_COUNTRY debe ser US. No se cotiza con FedEx.');
    return null;
  }

  if (!originCity || !originState) {
    warnOrigin(
      'FEDEX_ORIGIN_CITY y FEDEX_ORIGIN_STATE son obligatorias cuando FEDEX_ORIGIN_ZIP está definida. No se cotiza con FedEx.'
    );
    return null;
  }

  return {
    clientId,
    clientSecret,
    account,
    baseUrl: serverEnv('FEDEX_BASE_URL')?.replace(/\/+$/, '') ?? 'https://apis-sandbox.fedex.com',
    originZip,
    originCity,
    originState,
    originCountry,
    originAddress: serverEnv('FEDEX_ORIGIN_ADDRESS') ?? '',
    originCompany: serverEnv('FEDEX_ORIGIN_COMPANY') ?? 'Dinero Sobre Problemas',
    originPhone: serverEnv('FEDEX_ORIGIN_PHONE') ?? '',
  };
}

export function isFedexConfigured(): boolean {
  return fedexConfig() !== null;
}

// ------------------------------------------------------------- OAuth 2.0

/** Token vigente, renovándolo si está por expirar. */
async function accessToken(config: FedexConfig): Promise<string> {
  const key = `${config.baseUrl}|${config.clientId}`;
  if (tokenCache && tokenCache.key === key && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOKEN_TIMEOUT_MS);

  try {
    const res = await fetch(`${config.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }).toString(),
      signal: controller.signal,
    });

    const data: any = await res.json().catch(() => ({}));

    if (!res.ok || typeof data?.access_token !== 'string') {
      throw new Error(data?.errors?.[0]?.message ?? `FedEx OAuth ${res.status}`);
    }

    tokenCache = { key, token: data.access_token, expiresAt: Date.now() + TOKEN_TTL_MS };
    return data.access_token;
  } finally {
    clearTimeout(timer);
  }
}

// ------------------------------------------------------------- Request

/**
 * Llamada autenticada a FedEx. Devuelve el JSON ya parseado y lanza con un
 * mensaje útil (sin volcar direcciones ni tarifas a los logs).
 */
async function fedexRequest(
  config: FedexConfig,
  path: string,
  body: unknown,
  timeoutMs: number
): Promise<any> {
  const { status, data } = await fedexFetch(config, path, body, timeoutMs);

  logStructured(path, status, data);

  if (status >= 400) {
    throw new Error(
      data?.errors?.[0]?.message ?? data?.error?.message ?? `FedEx ${status}`
    );
  }

  return data;
}

/**
 * POST autenticado que conserva el status y el cuerpo crudo aunque FedEx
 * responda con error. No loguea nada: lo usa el endpoint temporal de pruebas
 * para devolver la respuesta tal cual al admin.
 */
async function fedexFetch(
  config: FedexConfig,
  path: string,
  body: unknown,
  timeoutMs: number
): Promise<{ status: number; data: any }> {
  const token = await accessToken(config);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${config.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();
    let data: any = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      // FedEx devolvió algo que no es JSON: se conserva para diagnóstico.
      data = { responseText: text };
    }

    return { status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

/** Loguea `errors[]` y `warnings[]` sin volcar detalles sensibles. */
function logStructured(path: string, status: number, data: any) {
  const errors: any[] = Array.isArray(data?.errors) ? data.errors : [];
  const warnings: any[] = Array.isArray(data?.warnings) ? data.warnings : [];

  if (warnings.length > 0) {
    console.warn(
      '[fedex]',
      path,
      'warnings:',
      warnings.map((w) => w?.message ?? w?.code ?? 'warning').join(' | ')
    );
  }
  if (errors.length > 0) {
    console.error(
      '[fedex]',
      path,
      'errors:',
      errors.map((e) => e?.message ?? e?.code ?? 'error').join(' | ')
    );
  }
  if (!status || status >= 400) {
    console.error('[fedex]', path, status);
  }
}

/** Fecha de envío en el formato que exige FedEx (`YYYY-MM-DD`). */
function shipDate(): string {
  const now = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
}

/** Servicios válidos para doméstico: fuera internacional y carga. */
const isDomesticService = (serviceType: string) => {
  const s = serviceType.toUpperCase();
  return !s.includes('INTERNATIONAL') && !s.includes('FREIGHT') && !s.includes('SMART_POST');
};

function rateKey(config: FedexConfig, zip: string, packages: FedexPackage[]) {
  return [
    config.originZip,
    zip,
    packages.map((p) => `${p.weight}x${p.length}x${p.width}x${p.height}`).join(','),
  ].join('|');
}

/**
 * Tarifas para un destino de EE. UU.
 *
 * Una sola llamada a `/rate/v1/rates/quotes` con todos los paquetes.
 */
export async function quoteRates(input: FedexRateInput): Promise<FedexResult<FedexRateOption[]>> {
  const config = fedexConfig();
  if (!config) return { ok: false, reason: 'not_configured' };

  const zip = input.destinationZip.trim();
  if (!/^\d{5}(-\d{4})?$/.test(zip)) return { ok: false, reason: 'invalid_zip' };
  if (input.packages.length === 0) return { ok: false, reason: 'no_packages' };

  const key = rateKey(config, zip, input.packages);
  const hit = rateCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  let parsed: any;
  try {
    parsed = await fedexRequest(
      config,
      '/rate/v1/rates/quotes',
      rateBody(config, input, zip),
      RATE_TIMEOUT_MS
    );
  } catch (err: any) {
    // Nunca se cachea un fallo: el siguiente intento vuelve a consultar.
    console.warn('[fedex] rate fallback:', err?.message);
    return { ok: false, reason: 'upstream_error' };
  }

  const options = normalizeRates(parsed);
  const value: FedexResult<FedexRateOption[]> =
    options.length > 0 ? { ok: true, data: options } : { ok: false, reason: 'no_rates' };

  rateCache.set(key, { at: Date.now(), value });
  return value;
}

export interface FedexRawQuote {
  ok: boolean;
  /** `not_configured`, `invalid_zip`, `no_packages`, `upstream_error` o `no_rates`. */
  reason: string | null;
  /** HTTP status de FedEx (null si no se llegó a llamar). */
  status: number | null;
  options: FedexRateOption[];
  /** Respuesta cruda de FedEx. Solo se devuelve al admin, nunca se persiste. */
  raw: any;
  /** Mensaje de error de FedEx, si lo hubo. */
  error: string | null;
}

/**
 * Igual que `quoteRates`, pero sin caché y conservando la respuesta cruda.
 *
 * Uso exclusivo del endpoint temporal de diagnóstico: no persiste ni loguea la
 * respuesta (restricción de Rating Data).
 */
export async function quoteRatesRaw(input: FedexRateInput): Promise<FedexRawQuote> {
  const config = fedexConfig();
  if (!config) {
    return { ok: false, reason: 'not_configured', status: null, options: [], raw: null, error: null };
  }

  const zip = input.destinationZip.trim();
  if (!/^\d{5}(-\d{4})?$/.test(zip)) {
    return { ok: false, reason: 'invalid_zip', status: null, options: [], raw: null, error: null };
  }

  if (input.packages.length === 0) {
    return { ok: false, reason: 'no_packages', status: null, options: [], raw: null, error: null };
  }

  try {
    const { status, data } = await fedexFetch(
      config,
      '/rate/v1/rates/quotes',
      rateBody(config, input, zip),
      RATE_TIMEOUT_MS
    );

    const options = status < 400 ? normalizeRates(data) : [];
    const ok = status < 400 && options.length > 0;

    return {
      ok,
      reason: status >= 400 ? 'upstream_error' : options.length > 0 ? null : 'no_rates',
      status,
      options,
      raw: data,
      error:
        status >= 400
          ? (data?.errors?.[0]?.message ?? data?.error?.message ?? `FedEx ${status}`)
          : null,
    };
  } catch (err: any) {
    return {
      ok: false,
      reason: 'upstream_error',
      status: null,
      options: [],
      raw: null,
      error: err?.message ?? 'fetch_failed',
    };
  }
}

function rateBody(config: FedexConfig, input: FedexRateInput, zip: string) {
  return {
    accountNumber: { value: config.account },
    requestedShipment: {
      shipper: {
        address: {
          postalCode: config.originZip.split('-')[0],
          city: config.originCity,
          stateOrProvinceCode: config.originState,
          countryCode: config.originCountry,
        },
      },
      recipient: {
        address: {
          postalCode: zip.split('-')[0],
          city: input.destinationCity || undefined,
          stateOrProvinceCode: input.destinationState || undefined,
          countryCode: 'US',
          residential: true,
        },
      },
      pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
      packagingType: 'YOUR_PACKAGING',
      packageCount: input.packages.length,
      rateRequestType: ['ACCOUNT', 'LIST'],
      preferredCurrency: 'USD',
      shipDateStamp: shipDate(),
      isDocumentOnly: false,
      requestedPackageLineItems: input.packages.map((p, i) => ({
        sequenceNumber: i + 1,
        weight: { units: 'LB', value: Math.max(0.1, p.weight) },
        dimensions: {
          length: Math.round(p.length),
          width: Math.round(p.width),
          height: Math.round(p.height),
          units: 'IN',
        },
        ...(input.declaredValue
          ? { declaredValue: { amount: input.declaredValue, currency: 'USD' } }
          : {}),
      })),
    },
  };
}

/** Normaliza `output.rateReplyDetails[]` a opciones en USD. */
function normalizeRates(parsed: any): FedexRateOption[] {
  const details: any[] = Array.isArray(parsed?.output?.rateReplyDetails)
    ? parsed.output.rateReplyDetails
    : [];

  return details
    .map((detail) => {
      const serviceType = String(detail?.serviceType ?? '');

      // Preferimos la tarifa de cuenta (negociada) y, si no, la de lista.
      const rated: any[] = Array.isArray(detail?.ratedShipmentDetails)
        ? detail.ratedShipmentDetails
        : [];
      const chosen =
        rated.find(
          (r) =>
            String(r?.rateType).toUpperCase() === 'ACCOUNT' &&
            String(r?.currency ?? r?.shipmentRateDetail?.totalNetCharge?.currency).toUpperCase() ===
              'USD'
        ) ??
        rated.find(
          (r) =>
            String(r?.currency ?? r?.shipmentRateDetail?.totalNetCharge?.currency).toUpperCase() ===
            'USD'
        );

      const amount = Number(
        chosen?.totalNetCharge ??
          chosen?.shipmentRateDetail?.totalNetCharge?.amount ??
          chosen?.shipmentRateDetail?.totalNetFedExCharge?.amount ??
          0
      );
      const currency = String(
        chosen?.currency ?? chosen?.shipmentRateDetail?.totalNetCharge?.currency ?? ''
      ).toUpperCase();

      const commitment = detail?.commitmentDetails ?? detail?.commitDetails ?? {};
      const operational = detail?.operationalDetail ?? {};
      const transit = Number(operational?.transitTime ?? commitment?.transitDays ?? NaN);

      return {
        productCode: serviceType,
        productName: String(detail?.serviceName ?? detail?.serviceType ?? 'FedEx'),
        amount,
        currency,
        deliveryDate:
          commitment?.commitDate ??
          operational?.deliveryDate ??
          operational?.commitDate ??
          null,
        estimatedDays: Number.isFinite(transit) ? transit : null,
      } as FedexRateOption;
    })
    .filter((o) => isDomesticService(o.productCode) && o.currency === 'USD' && o.amount > 0);
}

// ------------------------------------------------------------------ Guías

/**
 * ¿Se puede generar guía con este estado de verificación?
 *
 * Regla del proyecto: la guía solo sale con la dirección revisada a mano.
 * Devuelve el error a reportar, o `null` si está permitido.
 */
export function labelBlockReason(
  verificationStatus: string | null | undefined
): 'invalid' | 'pending' | null {
  if (verificationStatus === 'verified' || verificationStatus === 'corrected') return null;
  return verificationStatus === 'invalid' ? 'invalid' : 'pending';
}

/**
 * Genera guía (PDF). El llamador ya validó la dirección en el panel.
 *
 * Devuelve los documentos en base64 para guardarlos y enviarlos al cliente.
 */
export async function createLabel(input: {
  orderNumber: string;
  destination: {
    name: string;
    company?: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
    phone?: string;
    email?: string;
    residential?: boolean;
  };
  packages: FedexPackage[];
  productCode: string;
  declaredValue?: number;
}): Promise<FedexResult<{ trackingNumber: string; documents: FedexDocument[] }>> {
  const config = fedexConfig();
  if (!config) return { ok: false, reason: 'not_configured' };

  const body = {
    labelResponseOptions: 'LABEL',
    accountNumber: { value: config.account },
    requestedShipment: {
      shipper: {
        contact: {
          personName: config.originCompany.slice(0, 35),
          companyName: config.originCompany.slice(0, 35),
          phoneNumber: config.originPhone,
        },
        address: {
          streetLines: [config.originAddress].filter(Boolean),
          city: config.originCity,
          stateOrProvinceCode: config.originState,
          postalCode: config.originZip.split('-')[0],
          countryCode: config.originCountry,
        },
      },
      recipients: [
        {
          contact: {
            personName: input.destination.name.slice(0, 35),
            companyName: (input.destination.company ?? '').slice(0, 35) || undefined,
            phoneNumber: input.destination.phone ?? '',
            emailAddress: input.destination.email ?? undefined,
          },
          address: {
            streetLines: [input.destination.line1, input.destination.line2 ?? ''].filter(Boolean),
            city: input.destination.city,
            stateOrProvinceCode: input.destination.state,
            postalCode: input.destination.zip.split('-')[0],
            countryCode: 'US',
            residential: input.destination.residential !== false,
          },
        },
      ],
      shipDatestamp: shipDate(),
      serviceType: input.productCode,
      packagingType: 'YOUR_PACKAGING',
      pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
      shippingChargesPayment: {
        paymentType: 'SENDER',
        payor: {
          responsibleParty: { accountNumber: { value: config.account } },
        },
      },
      labelSpecification: {
        labelFormatType: 'COMMON2D',
        imageType: 'PDF',
        labelStockType: 'PAPER_85X11',
      },
      requestedPackageLineItems: input.packages.map((p, i) => ({
        sequenceNumber: i + 1,
        weight: { units: 'LB', value: Math.max(0.1, p.weight) },
        dimensions: {
          length: Math.round(p.length),
          width: Math.round(p.width),
          height: Math.round(p.height),
          units: 'IN',
        },
        customerReferences: [
          { customerReferenceType: 'CUSTOMER_REFERENCE', value: `${input.orderNumber}-${i + 1}`.slice(0, 35) },
        ],
        ...(input.declaredValue
          ? { declaredValue: { amount: input.declaredValue, currency: 'USD' } }
          : {}),
      })),
    },
  };

  let parsed: any;
  try {
    parsed = await fedexRequest(config, '/ship/v1/shipments', body, SHIPMENT_TIMEOUT_MS);
  } catch (err: any) {
    // Si FedEx rechaza la dirección, se avisa al llamador para marcarla inválida.
    const message = String(err?.message ?? '');
    const addressIssue = /address|postal|zip|city|state|recipient/i.test(message);

    console.error('[fedex] label:', message.slice(0, 200));
    return { ok: false, reason: addressIssue ? 'address_rejected' : 'upstream_error' };
  }

  const shipment = parsed?.output?.transactionShipments?.[0];
  const pieceResponses: any[] = Array.isArray(shipment?.pieceResponses)
    ? shipment.pieceResponses
    : [];

  const trackingNumber = String(
    shipment?.masterTrackingNumber ??
      pieceResponses?.[0]?.trackingNumber ??
      ''
  );

  if (!trackingNumber) return { ok: false, reason: 'no_tracking' };

  const documents: FedexDocument[] = pieceResponses
    .flatMap((piece) => (Array.isArray(piece?.packageDocuments) ? piece.packageDocuments : []))
    .filter((d: any) => typeof d?.content === 'string' && d.content.length > 0)
    .map((d: any) => ({
      type: String(d?.docType ?? 'label').toLowerCase(),
      imageFormat: String(d?.contentType ?? 'PDF').toUpperCase(),
      content: String(d.content),
    }));

  return { ok: true, data: { trackingNumber, documents } };
}
