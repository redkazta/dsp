/**
 * Precios de prueba a $0.65 USD — HARDCODEADO (sin switch).
 *
 * Todo precio > 0 se muestra y se cobra como `DEMO_PRICE`. No hay variable de
 * entorno: para volver a los precios reales, pon `PRICES_ARE_DEMO` en `false`.
 *
 * ¿Por qué 0.65? La cuenta de Stripe liquida en MXN y exige un mínimo de
 * 10 MXN por cargo, validado con conversión. El piso en USD es:
 *
 *     DEMO_PRICE ≥ 10 / tipo_de_cambio + margen
 *
 * Con 18.58 MXN/USD el mínimo ronda 0.54; 0.65 aguanta hasta 15.4 MXN/USD.
 * Si Stripe vuelve a decir "must convert to at least 1000 centavo", sube el
 * valor 0.05 y listo.
 *
 * OJO: con llaves live esto cobra dinero real (comisión incluida).
 *
 * Efectos:
 *   · Catálogo, carrito, favoritos y Stripe cobran 0.65 USD por pieza.
 *   · El envío es gratis.
 *   · Los cupones quedan desactivados.
 *   · El panel (`/admin`) NO cambia: ahí se ven y editan los precios reales.
 */

/** Precio único de vitrina (USD). Por encima del mínimo de Stripe en MXN. */
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
