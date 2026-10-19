/**
 * Constantes compartidas del storefront.
 *
 * Regla: todo lo que el navegador y el servidor deben calcular igual
 * (envío, folios, roles) vive aquí y se importa desde `lib/pricing.ts`.
 */

export const TENANT_ID = '11111111-1111-1111-1111-111111111111';
export const TENANT_SLUG = 'dinerosobreproblemas';

/** Moneda de la tienda. Un solo lugar para cambiarla. */
export const CURRENCY = 'USD';

/** Envío estándar y umbral de envío gratis (en CURRENCY) */
export const FREE_SHIPPING_THRESHOLD = 150;
export const STANDARD_SHIPPING = 15;

/** Roles con acceso al panel */
export const STAFF_ROLES = ['admin', 'seller'] as const;

/** Prefijo de las notas internas que guarda el checkout en `orders.notes` */
export const CHECKOUT_NOTES_MARKER = '[checkout]';

/**
 * Respuesta hermética para recursos sobre los que no queremos
 * filtrar nada por esta vía.
 */
export const NOT_FOUND_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
} as const;
