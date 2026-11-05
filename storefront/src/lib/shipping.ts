/**
 * Selección de envío (cotización FedEx) compartida por checkout y API.
 *
 * Una sola definición del paquete por defecto para que la cotización que ve el
 * cliente y la que recalcula el servidor sean idénticas.
 */

import { quoteRates, type FedexPackage, type FedexRateOption } from './fedex';

/** Peso y medidas por defecto de una pieza de ropa (libras / pulgadas). */
export const DEFAULT_PACKAGE: FedexPackage = { weight: 1.2, length: 12, width: 10, height: 2 };

/** Un paquete por pieza: evita sobrepeso por caja y simplifica el cálculo. */
export function packagesFor(quantity: number): FedexPackage[] {
  const qty = Math.max(1, Math.min(99, Math.floor(Number(quantity)) || 1));
  return Array.from({ length: qty }, () => DEFAULT_PACKAGE);
}

export interface ShippingQuoteInput {
  zip: string;
  city: string;
  state: string;
  quantity: number;
}

export type ShippingQuoteResult =
  | { ok: true; options: FedexRateOption[] }
  | { ok: false; reason: string };

/** Tarifas ordenadas de menor a mayor precio. */
export async function quoteShipping(input: ShippingQuoteInput): Promise<ShippingQuoteResult> {
  const result = await quoteRates({
    destinationZip: input.zip,
    destinationCity: input.city,
    destinationState: input.state || undefined,
    packages: packagesFor(input.quantity),
  });

  if (!result.ok) return { ok: false, reason: result.reason };

  return {
    ok: true,
    options: [...result.data].sort((a, b) => a.amount - b.amount),
  };
}

/** Diferencia aceptable entre lo cotizado en el navegador y lo re-cotizado. */
export const SHIPPING_PRICE_TOLERANCE = 0.01;

export interface ShippingSelection {
  productCode: string;
  amount: number;
}

/** Lee la opción elegida en el navegador. Nunca se confía en `amount`. */
export function readShippingSelection(value: unknown): ShippingSelection | null {
  const raw = (value ?? {}) as Record<string, unknown>;
  const productCode = typeof raw.productCode === 'string' ? raw.productCode.trim() : '';
  const amount = Number(raw.amount);

  if (!productCode) return null;
  if (!Number.isFinite(amount) || amount < 0) return null;

  return { productCode, amount };
}

/** Opción ya confirmada por el servidor. */
export interface ResolvedShipping {
  productCode: string;
  name: string;
  amount: number;
}

/** Resultado de aplicar la selección del navegador sobre una cotización. */
export type ShippingChoice =
  | { status: 'ok'; shipping: ResolvedShipping | null }
  | { status: 'changed'; shipping: ResolvedShipping };

/**
 * Elige la opción que se cobrará. El monto siempre sale de la cotización del
 * servidor; el del navegador solo sirve para detectar que el precio cambió.
 */
export function chooseShippingOption(
  options: FedexRateOption[],
  selection: ShippingSelection | null,
  acceptChange: boolean
): ShippingChoice {
  if (options.length === 0) return { status: 'ok', shipping: null };

  const option =
    (selection && options.find((o) => o.productCode === selection.productCode)) ?? options[0];

  const shipping: ResolvedShipping = {
    productCode: option.productCode,
    name: option.productName,
    amount: Math.round((option.amount + Number.EPSILON) * 100) / 100,
  };

  const changed =
    !!selection && Math.abs(selection.amount - shipping.amount) > SHIPPING_PRICE_TOLERANCE;

  if (changed && !acceptChange) return { status: 'changed', shipping };
  return { status: 'ok', shipping };
}
