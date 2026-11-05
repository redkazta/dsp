/**
 * Catálogo único de regiones de EE. UU. (fuente de verdad).
 *
 * Lo consumen el checkout (select de estado), el panel de admin y las
 * validaciones del servidor. Cambiar aquí es cambiar en todas partes; si una
 * región no se debe ofrecer, se apaga con `enabledForShipping`.
 *
 * No hay validación de direcciones contra APIs externas: solo se comprueba el
 * formato. La existencia real la revisa el operador a mano desde el panel.
 */

export type UsRegionType = 'state' | 'district' | 'territory';

export interface UsRegion {
  /** ISO 3166-2:US (dos letras). */
  code: string;
  name: string;
  type: UsRegionType;
  /**
   * Si aparece en el select del checkout. Los territorios con logística
   * limitada se dejan en `false` (siguen aceptándose en admin para corregir
   * pedidos históricos).
   */
  enabledForShipping: boolean;
}

export const US_REGIONS: UsRegion[] = [
  { code: 'AL', name: 'Alabama', type: 'state', enabledForShipping: true },
  { code: 'AK', name: 'Alaska', type: 'state', enabledForShipping: true },
  { code: 'AZ', name: 'Arizona', type: 'state', enabledForShipping: true },
  { code: 'AR', name: 'Arkansas', type: 'state', enabledForShipping: true },
  { code: 'CA', name: 'California', type: 'state', enabledForShipping: true },
  { code: 'CO', name: 'Colorado', type: 'state', enabledForShipping: true },
  { code: 'CT', name: 'Connecticut', type: 'state', enabledForShipping: true },
  { code: 'DE', name: 'Delaware', type: 'state', enabledForShipping: true },
  { code: 'DC', name: 'District of Columbia', type: 'district', enabledForShipping: true },
  { code: 'FL', name: 'Florida', type: 'state', enabledForShipping: true },
  { code: 'GA', name: 'Georgia', type: 'state', enabledForShipping: true },
  { code: 'HI', name: 'Hawaii', type: 'state', enabledForShipping: true },
  { code: 'ID', name: 'Idaho', type: 'state', enabledForShipping: true },
  { code: 'IL', name: 'Illinois', type: 'state', enabledForShipping: true },
  { code: 'IN', name: 'Indiana', type: 'state', enabledForShipping: true },
  { code: 'IA', name: 'Iowa', type: 'state', enabledForShipping: true },
  { code: 'KS', name: 'Kansas', type: 'state', enabledForShipping: true },
  { code: 'KY', name: 'Kentucky', type: 'state', enabledForShipping: true },
  { code: 'LA', name: 'Louisiana', type: 'state', enabledForShipping: true },
  { code: 'ME', name: 'Maine', type: 'state', enabledForShipping: true },
  { code: 'MD', name: 'Maryland', type: 'state', enabledForShipping: true },
  { code: 'MA', name: 'Massachusetts', type: 'state', enabledForShipping: true },
  { code: 'MI', name: 'Michigan', type: 'state', enabledForShipping: true },
  { code: 'MN', name: 'Minnesota', type: 'state', enabledForShipping: true },
  { code: 'MS', name: 'Mississippi', type: 'state', enabledForShipping: true },
  { code: 'MO', name: 'Missouri', type: 'state', enabledForShipping: true },
  { code: 'MT', name: 'Montana', type: 'state', enabledForShipping: true },
  { code: 'NE', name: 'Nebraska', type: 'state', enabledForShipping: true },
  { code: 'NV', name: 'Nevada', type: 'state', enabledForShipping: true },
  { code: 'NH', name: 'New Hampshire', type: 'state', enabledForShipping: true },
  { code: 'NJ', name: 'New Jersey', type: 'state', enabledForShipping: true },
  { code: 'NM', name: 'New Mexico', type: 'state', enabledForShipping: true },
  { code: 'NY', name: 'New York', type: 'state', enabledForShipping: true },
  { code: 'NC', name: 'North Carolina', type: 'state', enabledForShipping: true },
  { code: 'ND', name: 'North Dakota', type: 'state', enabledForShipping: true },
  { code: 'OH', name: 'Ohio', type: 'state', enabledForShipping: true },
  { code: 'OK', name: 'Oklahoma', type: 'state', enabledForShipping: true },
  { code: 'OR', name: 'Oregon', type: 'state', enabledForShipping: true },
  { code: 'PA', name: 'Pennsylvania', type: 'state', enabledForShipping: true },
  { code: 'RI', name: 'Rhode Island', type: 'state', enabledForShipping: true },
  { code: 'SC', name: 'South Carolina', type: 'state', enabledForShipping: true },
  { code: 'SD', name: 'South Dakota', type: 'state', enabledForShipping: true },
  { code: 'TN', name: 'Tennessee', type: 'state', enabledForShipping: true },
  { code: 'TX', name: 'Texas', type: 'state', enabledForShipping: true },
  { code: 'UT', name: 'Utah', type: 'state', enabledForShipping: true },
  { code: 'VT', name: 'Vermont', type: 'state', enabledForShipping: true },
  { code: 'VA', name: 'Virginia', type: 'state', enabledForShipping: true },
  { code: 'WA', name: 'Washington', type: 'state', enabledForShipping: true },
  { code: 'WV', name: 'West Virginia', type: 'state', enabledForShipping: true },
  { code: 'WI', name: 'Wisconsin', type: 'state', enabledForShipping: true },
  { code: 'WY', name: 'Wyoming', type: 'state', enabledForShipping: true },

  // Territorios. DHL entrega en PR, GU y VI; AS y MP quedan apagados por
  // logística. Se activan cambiando el flag (no hay que tocar código).
  { code: 'PR', name: 'Puerto Rico', type: 'territory', enabledForShipping: true },
  { code: 'GU', name: 'Guam', type: 'territory', enabledForShipping: true },
  { code: 'VI', name: 'U.S. Virgin Islands', type: 'territory', enabledForShipping: true },
  { code: 'AS', name: 'American Samoa', type: 'territory', enabledForShipping: false },
  { code: 'MP', name: 'Northern Mariana Islands', type: 'territory', enabledForShipping: false },
];

/** Lista plana para los selects: 50 estados + DC (compatibilidad histórica). */
export const US_STATES: Array<{ code: string; name: string }> = US_REGIONS.filter(
  (r) => r.type !== 'territory'
).map(({ code, name }) => ({ code, name }));

/** Regiones que se ofrecen en el checkout. */
export const SHIPPING_REGIONS: Array<{ code: string; name: string }> = US_REGIONS.filter(
  (r) => r.enabledForShipping
).map(({ code, name }) => ({ code, name }));

const ALL_CODES = new Set(US_REGIONS.map((r) => r.code));
const SHIPPING_CODES = new Set(SHIPPING_REGIONS.map((r) => r.code));

/** ¿Es una región de EE. UU.? Acepta código (`CA`) o nombre. */
export function isUsState(value: string): boolean {
  const raw = value.trim();
  if (!raw) return false;

  const upper = raw.toUpperCase();
  if (ALL_CODES.has(upper)) return true;

  return US_REGIONS.some((s) => s.name.toLowerCase() === raw.toLowerCase());
}

/** ¿Se puede enviar ahí? Es lo que valida el servidor al crear el pedido. */
export function isUsShippingRegion(value: string): boolean {
  return SHIPPING_CODES.has(usStateCode(value));
}

/** Normaliza a código de dos letras. */
export function usStateCode(value: string): string {
  const raw = value.trim();
  if (!raw) return '';

  const upper = raw.toUpperCase();
  if (ALL_CODES.has(upper)) return upper;

  return US_REGIONS.find((s) => s.name.toLowerCase() === raw.toLowerCase())?.code ?? '';
}

/** ZIP de EE. UU.: 12345 o 12345-6789. */
export function isUsPostalCode(value: string): boolean {
  return /^\d{5}(-\d{4})?$/.test(value.trim());
}

/** Nombre legible de una región (para admin y correos). */
export function usRegionName(code: string): string {
  const upper = code.trim().toUpperCase();
  return US_REGIONS.find((r) => r.code === upper)?.name ?? code;
}
