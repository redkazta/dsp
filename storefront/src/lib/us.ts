/**
 * Envíos solo dentro de Estados Unidos.
 *
 * La lista se usa en el checkout (select de estado) y en el servidor
 * (`readCustomer`) para no aceptar direcciones de otros países ni estados
 * inventados. Cuando se abran envíos internacionales, este módulo es el único
 * sitio que hay que tocar.
 */

export const US_STATES: Array<{ code: string; name: string }> = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

const CODES = new Set(US_STATES.map((s) => s.code));

/** ¿Es un estado/territorio de EE. UU.? Acepta código (`CA`) o nombre. */
export function isUsState(value: string): boolean {
  const raw = value.trim();
  if (!raw) return false;

  const upper = raw.toUpperCase();
  if (CODES.has(upper)) return true;

  return US_STATES.some((s) => s.name.toLowerCase() === raw.toLowerCase());
}

/** Normaliza a código de dos letras. */
export function usStateCode(value: string): string {
  const raw = value.trim();
  if (!raw) return '';

  const upper = raw.toUpperCase();
  if (CODES.has(upper)) return upper;

  return US_STATES.find((s) => s.name.toLowerCase() === raw.toLowerCase())?.code ?? '';
}

/** ZIP de EE. UU.: 12345 o 12345-6789. */
export function isUsPostalCode(value: string): boolean {
  return /^\d{5}(-\d{4})?$/.test(value.trim());
}
