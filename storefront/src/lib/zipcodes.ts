/**
 * Catálogo local de ZIP codes de EE. UU.
 *
 * Fuente: dataset público de Vega (`vega-datasets/data/zipcodes.csv`), que se
 * convierte a `data/us_zipcodes.json` con `scripts/build-us-zipcodes.mjs`.
 * Se carga una sola vez al arrancar el backend y se indexa en un `Map` para
 * que el lookup sea O(1) y no dependa de ninguna API externa.
 *
 * Solo se expone el resultado de una consulta puntual; el catálogo completo
 * nunca sale del servidor.
 */

import zipcodeRows from '../../../data/us_zipcodes.json';

export interface ZipcodeEntry {
  city: string;
  state: string;
}

type ZipcodeRow = { zip: string; city: string; state: string };

const ZIPCODE_MAP = new Map<string, ZipcodeEntry>();

for (const row of zipcodeRows as ZipcodeRow[]) {
  ZIPCODE_MAP.set(row.zip, { city: row.city, state: row.state });
}

/** Cuántos ZIP codes tiene el catálogo (para diagnóstico y pruebas). */
export const ZIPCODE_COUNT = ZIPCODE_MAP.size;

/**
 * Normaliza un código postal de EE. UU. a sus cinco primeros dígitos.
 * Acepta `12345` y `12345-6789`; cualquier otra forma devuelve `''`.
 */
export function normalizeZip(value: string): string {
  const raw = value.trim();
  if (/^\d{5}$/.test(raw)) return raw;

  const zip5 = raw.split('-')[0];
  return /^\d{5}$/.test(zip5) && /^\d{5}(-\d{4})?$/.test(raw) ? zip5 : '';
}

/**
 * Busca un ZIP en el catálogo.
 *
 * @param value ZIP de 5 dígitos o ZIP+4.
 * @returns `{ city, state }` o `null` si no existe o el formato no es válido.
 */
export function lookupZipcode(value: string): ZipcodeEntry | null {
  const zip = normalizeZip(value);
  if (!zip) return null;
  return ZIPCODE_MAP.get(zip) ?? null;
}
