/**
 * Precios de prueba al mínimo de Stripe — HARDCODEADO (sin switch).
 *
 * Cada artículo cuesta exactamente **10.00 MXN**, que es el mínimo que Stripe
 * acepta por cargo cuando la cuenta liquida en MXN (1000 centavos). Para que
 * sea exacto y no dependa del tipo de cambio, la sesión de pago se crea en MXN
 * en vez de convertir desde USD.
 *
 * Si se cobrara en USD habría que acertar la conversión (hoy ~$0.54) y
 * cualquier movimiento del peso rompería el checkout.
 *
 * Efectos:
 *   · Catálogo, carrito, favoritos y Stripe cobran 10.00 por pieza (MXN).
 *   · El envío es gratis.
 *   · Los cupones quedan desactivados.
 *   · El panel (`/admin`) NO cambia: ahí se ven y editan los precios reales.
 *
 * Con llaves live esto cobra dinero real (10 MXN + comisión por prueba).
 * Para volver a precios reales: `PRICES_ARE_DEMO = false`.
 */

/** Precio único de vitrina, en la moneda de demo. Piso de Stripe en MXN. */
export const DEMO_PRICE = 10;

/** Moneda de la sesión de pago en modo demo. */
export const DEMO_CURRENCY = 'MXN';

/** Interruptor del código. `false` = precios reales de la base de datos. */
const PRICES_ARE_DEMO = true;

/** `true` en todo el sitio: precios simbólicos y envío gratis. */
export function isDemoMode(): boolean {
  return PRICES_ARE_DEMO;
}

/**
 * Precio que se muestra y se cobra.
 *
 * - Fuera de demo: devuelve el precio tal cual.
 * - En demo: cualquier precio positivo pasa a `DEMO_PRICE`; el 0 se respeta
 *   (una pieza gratis sigue gratis, no se "sube" al precio de demo).
 */
export function demoPrice(price: number | string | null | undefined): number {
  const value = Number(price);
  if (!Number.isFinite(value) || value <= 0) return Number.isFinite(value) ? value : 0;
  return isDemoMode() ? DEMO_PRICE : value;
}
