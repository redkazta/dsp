/**
 * DHL Express — MyDHL API (solo backend).
 *
 *   · `quoteRates()`   → GET /rates (una pieza) o POST /rates (varias piezas)
 *   · `createLabel()`  → POST /shipments (guía + waybill)
 *
 * Reglas:
 *   · Credenciales por variables de entorno; nunca llegan al cliente.
 *   · La tarifa que se usa es `totalPrice[].currencyType = BILLC` (negociada).
 *   · Nunca se devuelve ni se loguea el Rating Data crudo.
 *   · Caché en memoria de 10 min. Jamás en base de datos.
 *   · Si DHL falla, `ok: false` y el checkout sigue con la tarifa plana.
 *
 * Entornos:
 *   test       https://express.api.dhl.com/mydhlapi/test
 *   producción https://express.api.dhl.com/mydhlapi
 *   mock       https://api-mock.dhl.com/mydhlapi
 */

import { serverEnv } from './env';

export const DHL_API_VERSION = '3.4.1';

export interface DhlPackage {
  /** Libras si `unitOfMeasurement` es imperial. */
  weight: number;
  length: number;
  width: number;
  height: number;
}

export interface DhlRateInput {
  destinationZip: string;
  destinationCity: string;
  packages: DhlPackage[];
  declaredValue?: number;
}

export interface DhlRateOption {
  productCode: string;
  productName: string;
  /** Tarifa negociada (`BILLC`). */
  amount: number;
  currency: string;
  deliveryDate: string | null;
  estimatedDays: number | null;
}

export type DhlResult<T> = { ok: true; data: T } | { ok: false; reason: string };

export interface DhlDocument {
  /** `label`, `waybillDoc`, … */
  type: string;
  imageFormat: string;
  /** Contenido base64 tal como lo entrega DHL. */
  content: string;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const RATE_TIMEOUT_MS = 2000;
const SHIPMENT_TIMEOUT_MS = 8000;

const cache = new Map<string, { at: number; value: DhlResult<DhlRateOption[]> }>();

interface DhlConfig {
  key: string;
  secret: string;
  account: string;
  baseUrl: string;
  originZip: string;
  originCity: string;
  originCountry: string;
  originAddress: string;
  originCompany: string;
  originPhone: string;
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
    originAddress: serverEnv('DHL_ORIGIN_ADDRESS') ?? '',
    originCompany: serverEnv('DHL_ORIGIN_COMPANY') ?? 'Dinero Sobre Problemas',
    originPhone: serverEnv('DHL_ORIGIN_PHONE') ?? '',
  };
}

export function isDhlConfigured(): boolean {
  return dhlConfig() !== null;
}

/** base64 sin depender de tipos de Node (`Buffer` no está tipado aquí). */
function toBase64(value: string): string {
  const g = globalThis as any;
  if (typeof g.btoa === 'function') return g.btoa(value);
  if (g.Buffer) return g.Buffer.from(value).toString('base64');
  return '';
}

const authHeader = (config: DhlConfig) =>
  `Basic ${toBase64(`${config.key}:${config.secret}`)}`;

/**
 * Llamada a MyDHL. Devuelve el JSON ya parseado y lanza con un mensaje útil.
 * `JSON.stringify` no agrega BOM; el header es explícito en UTF-8.
 */
async function dhlRequest(
  config: DhlConfig,
  method: 'GET' | 'POST',
  path: string,
  { body, timeoutMs }: { body?: unknown; timeoutMs: number }
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers: {
        // `charset=utf-8` evita que algún intermediario agregue BOM.
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json',
        Authorization: authHeader(config),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();
    const data: any = text ? JSON.parse(text) : {};

    // MyDHL puede responder 200 con `warnings` o errores parciales.
    logStructured(path, res.status, data);

    if (!res.ok) {
      throw new Error(data?.detail ?? data?.title ?? data?.message ?? `DHL ${res.status}`);
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

/** Loguea `result.message` y `warnings[]` sin volcar tarifas ni direcciones. */
function logStructured(path: string, status: number, data: any) {
  // Sin query string: no se guardan ZIP ni ciudades en los logs.
  const route = path.split('?')[0];
  const warnings: any[] = Array.isArray(data?.warnings) ? data.warnings : [];
  const resultMessage = data?.result?.message;

  if (warnings.length > 0) {
    console.warn(
      '[dhl]',
      route,
      'warnings:',
      warnings.map((w) => w?.message ?? w?.code ?? 'warning').join(' | ')
    );
  }
  if (resultMessage) {
    console.warn('[dhl]', route, 'result:', String(resultMessage).slice(0, 200));
  }
  if (!status || status >= 400) {
    console.error('[dhl]', route, status, String(data?.detail ?? data?.title ?? '').slice(0, 200));
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

/** Un paquete por llamada: el MVP cotiza una pieza. */
function rateKey(config: DhlConfig, zip: string, packages: DhlPackage[]) {
  return [config.originZip, zip, packages.map((p) => `${p.weight}x${p.length}x${p.width}x${p.height}`).join(',')].join('|');
}

/**
 * Tarifas para un destino de EE. UU.
 *
 * Una pieza → `GET /rates` con query params (recomendado por MyDHL).
 * Varias piezas → `POST /rates` con `packages[]`.
 */
export async function quoteRates(input: DhlRateInput): Promise<DhlResult<DhlRateOption[]>> {
  const config = dhlConfig();
  if (!config) return { ok: false, reason: 'not_configured' };

  const zip = input.destinationZip.trim();
  if (!/^\d{5}(-\d{4})?$/.test(zip)) return { ok: false, reason: 'invalid_zip' };
  if (input.packages.length === 0) return { ok: false, reason: 'no_packages' };

  const key = rateKey(config, zip, input.packages);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const parsed = (await requestRates(config, input, zip)) as any;
  if (!parsed) return { ok: false, reason: 'upstream_error' };

  const options = normalizeRates(parsed);

  const value: DhlResult<DhlRateOption[]> =
    options.length > 0 ? { ok: true, data: options } : { ok: false, reason: 'no_rates' };

  cache.set(key, { at: Date.now(), value });
  return value;
}

async function requestRates(
  config: DhlConfig,
  input: DhlRateInput,
  zip: string
): Promise<unknown | null> {
  const single = input.packages.length === 1;

  try {
    if (single) {
      const p = input.packages[0];
      const params = new URLSearchParams({
        accountNumber: config.account,
        originCountryCode: config.originCountry,
        originPostalCode: config.originZip,
        originCityName: config.originCity,
        destinationCountryCode: 'US',
        destinationPostalCode: zip.split('-')[0],
        destinationCityName: input.destinationCity || 'Unknown',
        weight: String(Math.max(0.1, p.weight)),
        length: String(p.length),
        width: String(p.width),
        height: String(p.height),
        plannedShippingDateAndTime: plannedDate(),
        unitOfMeasurement: 'imperial',
        isCustomsDeclarable: 'false',
        currencyCode: 'USD',
      });

      return await dhlRequest(config, 'GET', `/rates?${params.toString()}`, {
        timeoutMs: RATE_TIMEOUT_MS,
      });
    }

    // Multi-paquete: mismo contrato, en el body.
    return await dhlRequest(config, 'POST', '/rates', {
      timeoutMs: RATE_TIMEOUT_MS,
      body: {
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
        currencyCode: 'USD',
        packages: input.packages.map((p) => ({
          weight: Math.max(0.1, p.weight),
          dimensions: { length: p.length, width: p.width, height: p.height },
        })),
        ...(input.declaredValue
          ? { content: { declaredValue: input.declaredValue, currency: 'USD' } }
          : {}),
      },
    });
  } catch (err: any) {
    // Nunca se cachea un fallo: el siguiente intento vuelve a consultar.
    console.warn('[dhl] rate fallback:', err?.message);
    return null;
  }
}

/** Elige `BILLC` (tarifa negociada) y se queda solo con opciones en USD. */
function normalizeRates(parsed: any): DhlRateOption[] {
  const products: any[] = Array.isArray(parsed?.products) ? parsed.products : [];

  return products
    .map((product) => {
      const prices: any[] = Array.isArray(product?.totalPrice) ? product.totalPrice : [];
      const chosen =
        prices.find((p) => String(p?.currencyType).toUpperCase() === 'BILLC') ??
        prices.find((p) => String(p?.priceCurrency).toUpperCase() === 'USD') ??
        prices[0];

      const capabilities = product?.deliveryCapabilities ?? {};

      return {
        productCode: String(product?.productCode ?? ''),
        productName: String(product?.productName ?? product?.productCode ?? 'DHL'),
        amount: Number(chosen?.price ?? 0),
        currency: String(chosen?.priceCurrency ?? '').toUpperCase(),
        deliveryDate: capabilities?.estimatedDeliveryDateAndTime ?? null,
        estimatedDays:
          typeof capabilities?.totalTransitDays === 'number' ? capabilities.totalTransitDays : null,
      };
    })
    .filter((o) => o.currency === 'USD' && o.amount > 0);
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
 * Genera guía + waybill. El llamador ya validó la dirección en el panel.
 *
 * Devuelve los documentos en base64 (`label`, `waybillDoc`) para que se
 * guarden y se envíen al cliente.
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
  packages: DhlPackage[];
  productCode: string;
  declaredValue?: number;
}): Promise<DhlResult<{ trackingNumber: string; documents: DhlDocument[] }>> {
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
      imageOptions: [
        { typeCode: 'label', isRequested: true },
        { typeCode: 'waybillDoc', isRequested: true },
      ],
    },
    customerDetails: {
      shipperDetails: {
        postalAddress: {
          postalCode: config.originZip,
          cityName: config.originCity,
          countryCode: config.originCountry,
          addressLine1: config.originAddress.slice(0, 50),
          addressLine2: '',
          addressLine3: '',
        },
        contactInformation: {
          phone: config.originPhone,
          companyName: config.originCompany.slice(0, 50),
          fullName: config.originCompany.slice(0, 50),
        },
        typeCode: 'business',
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
          companyName: (input.destination.company ?? '').slice(0, 50),
          fullName: input.destination.name.slice(0, 50),
          email: input.destination.email ?? '',
        },
        typeCode: input.destination.residential === false ? 'business' : 'residential',
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
          { value: `${input.orderNumber}-${i + 1}`.slice(0, 35), typeCode: 'CU' },
        ],
      })),
      ...(input.declaredValue
        ? { declaredValue: input.declaredValue, declaredValueCurrency: 'USD' }
        : {}),
    },
    ...(input.destination.email
      ? {
          shipmentNotification: [
            {
              typeCode: 'email',
              receiverId: input.destination.email,
              languageCode: 'en',
              languageCountryCode: 'US',
            },
          ],
        }
      : {}),
  };

  let parsed: any;
  try {
    parsed = await dhlRequest(config, 'POST', '/shipments', {
      body,
      timeoutMs: SHIPMENT_TIMEOUT_MS,
    });
  } catch (err: any) {
    // Si DHL rechaza la dirección, se avisa al llamador para marcarla inválida.
    const message = String(err?.message ?? '');
    const addressIssue = /address|postal|zip|city/i.test(message);

    console.error('[dhl] label:', message.slice(0, 200));
    return { ok: false, reason: addressIssue ? 'address_rejected' : 'upstream_error' };
  }

  const trackingNumber = String(
    parsed?.shipmentTrackingNumber ?? parsed?.packages?.[0]?.trackingNumber ?? ''
  );

  if (!trackingNumber) return { ok: false, reason: 'no_tracking' };

  const documents: DhlDocument[] = (parsed?.documents ?? [])
    .filter((d: any) => typeof d?.content === 'string' && d.content.length > 0)
    .map((d: any) => ({
      type: String(d?.typeCode ?? d?.type ?? 'label'),
      imageFormat: String(d?.imageFormat ?? 'PDF').toUpperCase(),
      content: String(d.content),
    }));

  return { ok: true, data: { trackingNumber, documents } };
}
