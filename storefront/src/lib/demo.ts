/**
 * Precios de prueba a 6 centavos — HARDCODEADO (sin switch).
 *
 * Todo precio > 0 se muestra y se cobra como `DEMO_PRICE`. No hay variable de
 * entorno: para volver a los precios reales, borra este módulo y sus usos, o
 * deja `PRICES_ARE_DEMO` en `false`.
 *
 * Efectos:
 *   · Catálogo, carrito, favoritos y Stripe cobran 0.06 USD por pieza.
 *   · El envío es gratis (para que una compra de prueba cueste 6 centavos).
 *   · Los cupones quedan desactivados.
 *   · El panel (`/admin`) NO cambia: ahí se ven y editan los precios reales.
 */

/** Precio único de vitrina (USD). */
export const DEMO_PRICE = 0.06;

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
 *   (una pieza gratis sigue gratis, no se "sube" a 6 centavos).
 */
export function demoPrice(price: number | string | null | undefined): number {
  const value = Number(price);
  if (!Number.isFinite(value) || value <= 0) return Number.isFinite(value) ? value : 0;
  return isDemoMode() ? DEMO_PRICE : value;
}
