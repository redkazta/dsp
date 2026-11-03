/**
 * Precios de prueba a $1.00 USD — HARDCODEADO (sin switch).
 *
 * Todo precio > 0 se muestra y se cobra como `DEMO_PRICE`. No hay variable de
 * entorno: para volver a los precios reales, pon `PRICES_ARE_DEMO` en `false`.
 *
 * ¿Por qué 1.00 y no 0.06? La cuenta de Stripe liquida en MXN y exige un
 * mínimo de 10 MXN por cargo. Stripe convierte el importe para validarlo:
 * 0.50 USD ≈ 9.29 MXN → rechazado ("must convert to at least 1000 centavo").
 * 1.00 USD ≈ 18.58 MXN → pasa con margen. El piso real ronda los 0.54 USD,
 * pero el tipo de cambio se mueve; 1.00 no depende del día.
 *
 * Efectos:
 *   · Catálogo, carrito, favoritos y Stripe cobran 1.00 USD por pieza.
 *   · El envío es gratis.
 *   · Los cupones quedan desactivados.
 *   · El panel (`/admin`) NO cambia: ahí se ven y editan los precios reales.
 */

/** Precio único de vitrina (USD). Por encima del mínimo de Stripe en MXN. */
export const DEMO_PRICE = 1;

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
