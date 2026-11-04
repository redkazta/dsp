/**
 * Precios de prueba al mínimo de Stripe — APAGADO.
 *
 * `PRICES_ARE_DEMO = false`: el sitio usa los precios reales de
 * `product_variants` (35.00 USD). Se deja el módulo para volver a probar el
 * flujo de pago sin editar el catálogo: basta poner `true` aquí.
 *
 * Con el interruptor encendido:
 *   · Todo precio > 0 se muestra y se cobra como `DEMO_PRICE`.
 *   · El envío es gratis y los cupones se desactivan.
 *   · El panel (`/admin`) sigue mostrando los precios reales.
 */

/** Precio único de vitrina en USD: 10 MXN convertidos a dólares. */
export const DEMO_PRICE = 0.65;

/** Interruptor del código. `false` = precios reales de la base de datos. */
const PRICES_ARE_DEMO = false;

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
