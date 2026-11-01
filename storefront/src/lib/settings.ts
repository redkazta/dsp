/**
 * Configuración de la tienda (ERP).
 *
 * Vive en `store_settings` (una fila por tenant) y se edita desde
 * `/admin/configuracion`. El servidor la lee con service role; el navegador
 * recibe los valores ya resueltos desde la página (nunca consulta la tabla).
 *
 * Si la tabla no existe todavía (script sin correr) o falla la lectura, se
 * usan los valores por defecto de `lib/constants.ts`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from './supabase-server';
import {
  TENANT_ID,
  FREE_SHIPPING_THRESHOLD,
  STANDARD_SHIPPING,
} from './constants';
import type { ShippingRules } from './pricing';

export interface StoreSettings {
  freeShippingThreshold: number;
  standardShipping: number;
  contactEmail: string;
  lowStockThreshold: number;
}

export const DEFAULT_SETTINGS: StoreSettings = {
  freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
  standardShipping: STANDARD_SHIPPING,
  contactEmail: 'support@dinerosobreproblemas.com',
  lowStockThreshold: 5,
};

/** Reglas de envío tal como las consume `lib/pricing.ts`. */
export type { ShippingRules } from './pricing';

export const shippingRulesFrom = (settings: StoreSettings): ShippingRules => ({
  freeFrom: settings.freeShippingThreshold,
  cost: settings.standardShipping,
});

const clamp = (value: unknown, fallback: number, min = 0, max = 100000) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

function mapRow(row: any): StoreSettings {
  if (!row) return DEFAULT_SETTINGS;

  return {
    freeShippingThreshold: clamp(row.free_shipping_threshold, DEFAULT_SETTINGS.freeShippingThreshold),
    standardShipping: clamp(row.standard_shipping, DEFAULT_SETTINGS.standardShipping),
    contactEmail: String(row.contact_email ?? DEFAULT_SETTINGS.contactEmail).trim(),
    lowStockThreshold: clamp(row.low_stock_threshold, DEFAULT_SETTINGS.lowStockThreshold, 0, 999),
  };
}

/** Lee la configuración. Nunca lanza: si algo falla, devuelve los defaults. */
export async function getStoreSettings(db?: SupabaseClient | null): Promise<StoreSettings> {
  const client = db ?? createSupabaseAdminClient();
  if (!client) return DEFAULT_SETTINGS;

  const { data, error } = await client
    .from('store_settings')
    .select('free_shipping_threshold, standard_shipping, contact_email, low_stock_threshold')
    .eq('tenant_id', TENANT_ID)
    .maybeSingle();

  if (error) {
    // Tabla ausente (script sin correr) o RLS: se sigue con los defaults.
    if (error.code !== 'PGRST116') {
      console.warn('[settings] no se pudo leer:', error.code, error.message);
    }
    return DEFAULT_SETTINGS;
  }

  return mapRow(data);
}

/** Guarda solo los campos enviados y devuelve la configuración resultante. */
export async function saveStoreSettings(
  patch: Partial<StoreSettings>,
  db?: SupabaseClient | null
): Promise<StoreSettings> {
  const client = db ?? createSupabaseAdminClient();
  if (!client) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY.');

  const current = await getStoreSettings(client);

  const next: StoreSettings = {
    freeShippingThreshold: clamp(
      patch.freeShippingThreshold ?? current.freeShippingThreshold,
      current.freeShippingThreshold
    ),
    standardShipping: clamp(
      patch.standardShipping ?? current.standardShipping,
      current.standardShipping
    ),
    contactEmail: String(patch.contactEmail ?? current.contactEmail).trim(),
    lowStockThreshold: clamp(
      patch.lowStockThreshold ?? current.lowStockThreshold,
      current.lowStockThreshold,
      0,
      999
    ),
  };

  const { error } = await client.from('store_settings').upsert(
    {
      tenant_id: TENANT_ID,
      free_shipping_threshold: next.freeShippingThreshold,
      standard_shipping: next.standardShipping,
      contact_email: next.contactEmail,
      low_stock_threshold: next.lowStockThreshold,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id' }
  );

  if (error) throw new Error(error.message);

  return next;
}
