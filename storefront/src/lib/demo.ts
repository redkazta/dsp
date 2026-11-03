/**
 * Modo demo — precios de vitrina a 6 centavos.
 *
 * Se activa con `PUBLIC_DEMO_MODE=true` y se desactiva igual. Es una variable
 * de build: al cambiarla hay que volver a desplegar (Vercel → Deployments).
 *
 * Qué hace:
 *   · Todo precio > 0 se muestra y se cobra como `DEMO_PRICE` (0.06 USD).
 *   · El envío es gratis y los cupones no aplican, para que una compra de
 *     prueba cueste exactamente 6 centavos por pieza.
 *   · El panel (`/admin`) NO cambia: ahí se siguen viendo los precios reales
 *     del catálogo, que es lo que se administra.
 *   · El sitio se marca `noindex` mientras el modo está activo (ver
 *     `BaseLayout.astro`), para no indexar precios de prueba.
 *
 * Los precios se siguen recalculando en servidor: `priceItems()` pasa cada
 * importe por `demoPrice()`, así que el navegador no puede saltárselo.
 */

/** Precio único en modo demo (USD). */
export const DEMO_PRICE = 0.06;

/** ¿Está activo el modo demo? Acepta `true` / `1` / `yes`. */
export function isDemoMode(): boolean {
  const raw = String((import.meta.env.PUBLIC_DEMO_MODE as string | undefined) ?? '')
    .trim()
    .toLowerCase();

  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on';
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
