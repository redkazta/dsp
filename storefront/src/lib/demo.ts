/**
 * Precios de prueba al mínimo de Stripe — HARDCODEADO (sin switch).
 *
 * La tienda sigue en **USD** (no se muestran ni se cobran pesos). Lo que se
 * hace es convertir el piso de Stripe a dólares:
 *
 *     mínimo Stripe = 10.00 MXN por cargo (la cuenta liquida en MXN)
 *     DEMO_PRICE_USD = 10 / tipo_de_cambio + margen
 *
 * Con 18.58 MXN/USD el mínimo exacto ronda $0.54, pero Stripe convierte con su
 * propio tipo de cambio y se mueve todos los días. Se usa **$0.65**, que sigue
 * pasando mientras el peso no baje de 15.4 MXN/USD. Si Stripe llegara a
 * responder `must convert to at least 1000 centavo`, sube 0.05 aquí.
 *
 * Efectos:
 *   · Catálogo, carrito, favoritos y Stripe cobran 0.65 USD por pieza.
 *   · El envío es gratis.
 *   · Los cupones quedan desactivados.
 *   · El panel (`/admin`) NO cambia: ahí se ven y editan los precios reales.
 *
 * Con llaves live cada prueba cobra dinero real (~0.65 USD + comisión).
 * Para volver a precios reales: `PRICES_ARE_DEMO = false`.
 */

/** Precio único de vitrina en USD: 10 MXN convertidos a dólares. */
export const DEMO_PRICE = 0.65;

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
