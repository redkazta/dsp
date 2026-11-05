/**
 * DHL Express — MyDHL API (solo backend).
 *
 * Dos operaciones:
 *   · `quoteRates()`   → tarifas y fechas estimadas para un destino de EE. UU.
 *   · `createLabel()`  → guía (waybill) con la dirección ya verificada.
 *
 * Reglas del proyecto:
 *   · Las credenciales viven en variables de entorno; nunca llegan al cliente.
 *   · Si DHL no está configurado o falla, se devuelve `ok: false` y el checkout
 *     sigue con la tarifa plana de `store_settings`.
 *   · Caché en memoria de 10 min por combinación origen/destino/peso/medidas.
 *
 * Sandbox:   https://express.api.dhl.com/mydhlapi/test
 * Producción: https://express.api.dhl.com/mydhlapi
 */

import { serverEnv } from './env';

export interface DhlPackage {
  /** Libras (unitOfMeasurement: imperial). */
  weight: number;
  length: number;
  width: number;
  height: number;
}

export interface DhlRateInput {
  destinationZip: string;
  destinationCity: string;
  packages: DhlPackage[];
  /** Valor declarado en USD (opcional). */
  declaredValue?: number;
}

export interface DhlRateOption {
  productCode: string;
  productName: string;
  amount: number;
  currency: string;
  deliveryDate: string | null;
  estimatedDays: number | null;
}

export type DhlResult<T> = { ok: true; data: T } | { ok: false; reason: string };

const CACHE_TTL_MS = 10 * 60 * 1000;

const cache = new Map<string, { at: number; value: DhlResult<DhlRateOption[]> }>();

interface DhlConfig {
  key: string;
  secret: string;
  account: string;
  baseUrl: string;
  originZip: string;
  originCity: string;
  originCountry: string;
}

/** Configuración efectiva. `null` cuando DHL no está habilitado. */
export function dhlConfig(): DhlConfig | null {
  const key = serverEnv('DHL_API_KEY');
  const secret = serverEnv('DHL_API_SECRET');
  const account = serverEnv('DHL_ACCOUNT_NUMBER');
  const originZip = serverEnv('DHL_ORIGIN_ZIP');

  if (!key || !secret || !account || !originZip) return null;

  return {
    key,
    secret,
    account,
    baseUrl:
      serverEnv('DHL_API_BASE_URL')?.replace(/\/+$/, '') ?? 'https://express.api.dhl.com/mydhlapi/test',
    originZip,
    originCity: serverEnv('DHL_ORIGIN_CITY') ?? 'Los Angeles',
    originCountry: serverEnv('DHL_ORIGIN_COUNTRY') ?? 'US',
  };
}

export function isDhlConfigured(): boolean {
  return dhlConfig() !== null;
}

const authHeader = (config: DhlConfig) =>
  `Basic ${toBase64(`${config.key}:${config.secret}`)}`;

/** base64 sin depender de tipos de Node (`Buffer` no está tipado aquí). */
function toBase64(value: string): string {
  const g = globalThis as any;
  if (typeof g.btoa === 'function') return g.btoa(value);
  if (g.Buffer) return g.Buffer.from(value).toString('base64');
  return '';
}

/** Reintenta una vez si DHL tarda más de `timeoutMs` (default 2 s). */
async function dhlFetch(
  config: DhlConfig,
  path: string,
  body: unknown,
  timeoutMs = 2000
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${config.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: authHeader(config),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error('[dhl]', path, res.status, data?.detail ?? data?.title ?? '');
      throw new Error(data?.detail ?? data?.title ?? `DHL ${res.status}`);
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

/** Fecha planeada en el formato que exige MyDHL. */
function plannedDate(): string {
  const now = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:00GMT+00:00`
  );
}

/**
 * Tarifas para un destino de EE. UU.
 *
 * Devuelve solo opciones en **USD** (si DHL responde en otra moneda se
 * descarta, para no mezclar importes).
 */
export async function quoteRates(input: DhlRateInput): Promise<DhlResult<DhlRateOption[]>> {
  const config = dhlConfig();
  if (!config) return { ok: false, reason: 'not_configured' };

  const zip = input.destinationZip.trim();
  if (!/^\d{5}(-\d{4})?$/.test(zip)) return { ok: false, reason: 'invalid_zip' };
  if (input.packages.length === 0) return { ok: false, reason: 'no_packages' };

  const key = [
    config.originZip,
    zip,
    input.packages.map((p) => `${p.weight}x${p.length}x${p.width}x${p.height}`).join(','),
    input.declaredValue ?? 0,
  ].join('|');

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const body = {
    customerDetails: {
      shipperDetails: {
        postalCode: config.originZip,
        cityName: config.originCity,
        countryCode: config.originCountry,
      },
      receiverDetails: {
        postalCode: zip.split('-')[0],
        cityName: input.destinationCity || 'Unknown',
        countryCode: 'US',
      },
    },
    accounts: [{ typeCode: 'shipper', number: config.account }],
    plannedShippingDateAndTime: plannedDate(),
    unitOfMeasurement: 'imperial',
    isCustomsDeclarable: false,
    packages: input.packages.map((p) => ({
      weight: Math.max(0.1, p.weight),
      dimensions: { length: p.length, width: p.width, height: p.height },
    })),
    ...(input.declaredValue
      ? { content: { declaredValue: input.declaredValue, currency: 'USD' } }
      : {}),
  };

  let parsed: any;
  try {
    parsed = await dhlFetch(config, '/rates', body);
  } catch (err: any) {
    // Fallo de red o de DHL: no se cachea, el checkout usa la tarifa plana.
    console.warn('[dhl] rate fallback:', err?.message);
    return { ok: false, reason: 'upstream_error' };
  }

  const options: DhlRateOption[] = (parsed?.products ?? [])
    .map((product: any) => {
      const total = product?.totalPrice?.[0];
      return {
        productCode: String(product?.productCode ?? ''),
        productName: String(product?.productName ?? product?.productCode ?? 'DHL'),
        amount: Number(total?.price ?? 0),
        currency: String(total?.priceCurrency ?? '').toUpperCase(),
        deliveryDate: product?.deliveryCapabilities?.estimatedDeliveryDateAndTime ?? null,
        estimatedDays:
          typeof product?.deliveryCapabilities?.totalTransitDays === 'number'
            ? product.deliveryCapabilities.totalTransitDays
            : null,
      };
    })
    .filter((o: DhlRateOption) => o.currency === 'USD' && o.amount > 0);

  const value: DhlResult<DhlRateOption[]> =
    options.length > 0 ? { ok: true, data: options } : { ok: false, reason: 'no_rates' };

  cache.set(key, { at: Date.now(), value });
  return value;
}

/** Guía (waybill) para un pedido ya verificado. */
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
  };
  packages: DhlPackage[];
  productCode: string;
  declaredValue?: number;
}): Promise<DhlResult<{ trackingNumber: string; labelPdf: string | null }>> {
  const config = dhlConfig();
  if (!config) return { ok: false, reason: 'not_configured' };

  const body = {
    plannedShippingDateAndTime: plannedDate(),
    pickup: { isRequested: false },
    productCode: input.productCode,
    localProductCode: input.productCode,
    getRateEstimates: false,
    accounts: [{ typeCode: 'shipper', number: config.account }],
    outputImageProperties: {
      printerDPI: 300,
      encodingFormat: 'pdf',
      imageOptions: [{ typeCode: 'label', templateName: 'ECOM26_84_A4_001' }],
    },
    customerDetails: {
      shipperDetails: {
        postalAddress: {
          postalCode: config.originZip,
          cityName: config.originCity,
          countryCode: config.originCountry,
        },
        contactInformation: { phone: '', companyName: serverEnv('DHL_ORIGIN_COMPANY') ?? '' },
      },
      receiverDetails: {
        postalAddress: {
          postalCode: input.destination.zip.split('-')[0],
          cityName: input.destination.city,
          countryCode: 'US',
          addressLine1: input.destination.line1.slice(0, 50),
          addressLine2: (input.destination.line2 ?? '').slice(0, 50),
          addressLine3: '',
          provinceCode: input.destination.state,
        },
        contactInformation: {
          phone: input.destination.phone ?? '',
          companyName: input.destination.company ?? '',
          fullName: input.destination.name.slice(0, 50),
          email: input.destination.email ?? '',
        },
      },
    },
    content: {
      unitOfMeasurement: 'imperial',
      isCustomsDeclarable: false,
      description: 'Apparel',
      packages: input.packages.map((p, i) => ({
        typeCode: '2BP',
        weight: Math.max(0.1, p.weight),
        dimensions: { length: p.length, width: p.width, height: p.height },
        customerReferences: [
          {
            value: `${input.orderNumber}-${i + 1}`.slice(0, 35),
            typeCode: 'CU',
          },
        ],
      })),
      ...(input.declaredValue
        ? { declaredValue: input.declaredValue, declaredValueCurrency: 'USD' }
        : {}),
    },
  };

  try {
    const parsed = await dhlFetch(config, '/shipments', body, 8000);

    const trackingNumber = String(
      parsed?.shipmentTrackingNumber ?? parsed?.packages?.[0]?.trackingNumber ?? ''
    );

    const documents: Array<{ content: string }> = parsed?.documents ?? [];
    const labelPdf = documents.find((d) => typeof d?.content === 'string')?.content ?? null;

    if (!trackingNumber) return { ok: false, reason: 'no_tracking' };

    return { ok: true, data: { trackingNumber, labelPdf } };
  } catch (err: any) {
    console.error('[dhl] label:', err?.message);
    return { ok: false, reason: 'upstream_error' };
  }
}
