/**
 * Precios: única fuente de verdad del monto a cobrar.
 *
 * Corre en el servidor (`/api/checkout`). El navegador solo manda
 * variantId + cantidad; los importes salen de `product_variants`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { FREE_SHIPPING_THRESHOLD, STANDARD_SHIPPING, TENANT_ID } from './constants';
import { demoPrice, isDemoMode } from './demo';
import { productName } from './product-texts';
import { variantLabel } from './variant-texts';
import type { Lang } from './i18n';

export { FREE_SHIPPING_THRESHOLD, STANDARD_SHIPPING, CURRENCY } from './constants';

export interface PricedItem {
  variantId: string;
  productId: string;
  productSlug?: string | null;
  name: string;
  variantName: string;
  price: number;
  qty: number;
  image?: string | null;
  size?: string | null;
  color?: string | null;
}

/** Reglas de envío editables desde el panel (`store_settings`). */
export interface ShippingRules {
  /** Subtotal a partir del cual el envío es gratis. */
  freeFrom: number;
  /** Costo del envío estándar. */
  cost: number;
}

export const DEFAULT_SHIPPING_RULES: ShippingRules = {
  freeFrom: FREE_SHIPPING_THRESHOLD,
  cost: STANDARD_SHIPPING,
};

/** Envío estándar, gratis a partir del umbral configurado. En demo siempre es gratis. */
export function shippingCostFor(subtotal: number, rules: ShippingRules = DEFAULT_SHIPPING_RULES) {
  if (isDemoMode()) return 0;
  return subtotal >= rules.freeFrom || subtotal <= 0 ? 0 : rules.cost;
}

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Importe con dos decimales y separador de miles, sin símbolo: 1,234.00 */
export function formatAmount(n: number): string {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Importe con símbolo: $35.00 */
export function formatMoney(n: number): string {
  return `$${formatAmount(n)}`;
}

/** Alias histórico (mismo formato USD). Preferir `formatAmount`. */
export const formatMXN = formatAmount;

export interface RawRequestedItem {
  variantId?: unknown;
  qty?: unknown;
}

export class PricingError extends Error {}

/** Mensajes de validación del carrito en el idioma de la compra. */
const pricingCopy = {
  es: {
    empty: 'El carrito está vacío.',
    qty: 'Cantidad inválida.',
    max: 'Máximo 99 piezas por artículo.',
    check: 'No pudimos validar tu carrito. Intenta de nuevo.',
    removed: (n: number) =>
      `Retiramos ${n} ${n === 1 ? 'pieza' : 'piezas'} que ya no están disponibles.`,
    unavailable: 'Una pieza de tu carrito ya no está disponible.',
    gone: (name: string) => `"${name}" ya no está disponible.`,
    piece: 'Una pieza',
  },
  en: {
    empty: 'Your cart is empty.',
    qty: 'Invalid quantity.',
    max: 'Maximum 99 pieces per item.',
    check: "We couldn't validate your cart. Try again.",
    removed: (n: number) =>
      `We removed ${n} ${n === 1 ? 'item' : 'items'} that are no longer available.`,
    unavailable: 'An item in your cart is no longer available.',
    gone: (name: string) => `"${name}" is no longer available.`,
    piece: 'An item',
  },
};

/**
 * Recalcula los items del pedido a partir de la base de datos.
 * Nunca confía en precios, nombres ni imágenes enviados por el cliente.
 */
export async function priceItems(
  supabase: SupabaseClient,
  requested: RawRequestedItem[],
  lang: Lang = 'es'
): Promise<PricedItem[]> {
  const copy = pricingCopy[lang === 'en' ? 'en' : 'es'];

  if (!Array.isArray(requested) || requested.length === 0) {
    throw new PricingError(copy.empty);
  }

  // Une duplicados y descarta cantidades inválidas
  const quantities = new Map<string, number>();
  for (const raw of requested) {
    const variantId = typeof raw?.variantId === 'string' ? raw.variantId.trim() : '';
    const qty = Math.floor(Number(raw?.qty));
    if (!variantId) continue;
    if (!Number.isFinite(qty) || qty <= 0) throw new PricingError(copy.qty);
    if (qty > 99) throw new PricingError(copy.max);

    const next = (quantities.get(variantId) ?? 0) + qty;
    if (next > 99) throw new PricingError(copy.max);
    quantities.set(variantId, next);
  }

  if (quantities.size === 0) throw new PricingError(copy.empty);

  const { data, error } = await supabase
    .from('product_variants')
    .select(
      'id, product_id, name, size, color, price, is_deleted, products!inner(id, name, name_en, slug, tenant_id, is_active, is_deleted, product_images(url, position))'
    )
    .in('id', [...quantities.keys()]);

  if (error) throw new PricingError(copy.check);

  const rows = data ?? [];
  if (rows.length !== quantities.size) {
    // Filtrar los items que sí existen
    const validVariantIds = new Set(rows.map((r: any) => r.id));
    const removed: string[] = [];
    const filteredRequests: RawRequestedItem[] = [];
    for (const raw of requested) {
      const variantId = typeof raw?.variantId === 'string' ? raw.variantId.trim() : '';
      if (validVariantIds.has(variantId)) {
        filteredRequests.push(raw);
      } else {
        removed.push(variantId);
      }
    }
    
    if (filteredRequests.length === 0) {
      throw new PricingError(copy.removed(removed.length));
    }

    if (rows.length !== filteredRequests.length) {
      throw new PricingError(copy.unavailable);
    }
  }

  return rows.map((row: any) => {
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    if (!product || product.is_deleted || !product.is_active || product.tenant_id !== TENANT_ID) {
      throw new PricingError(
        copy.gone(product ? productName(product, lang) : copy.piece)
      );
    }
    if (row.is_deleted) {
      throw new PricingError(copy.gone(productName(product, lang)));
    }

    const images = [...(product.product_images ?? [])].sort(
      (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)
    );

    return {
      variantId: row.id,
      productId: row.product_id,
      productSlug: product.slug ?? null,
      // El pedido guarda el nombre en el idioma en que compró el cliente.
      name: productName(product, lang),
      variantName: variantLabel(
        { name: row.name, size: row.size, color: row.color },
        lang
      ),
      price: demoPrice(row.price),
      qty: quantities.get(row.id)!,
      image: images[0]?.url ?? null,
      size: row.size ?? null,
      color: row.color ?? null,
    };
  });
}

export function totalsFor(items: PricedItem[], rules: ShippingRules = DEFAULT_SHIPPING_RULES) {
  const subtotal = round2(items.reduce((sum, i) => sum + i.price * i.qty, 0));
  const shipping = shippingCostFor(subtotal, rules);
  return { subtotal, shipping, total: round2(subtotal + shipping) };
}
