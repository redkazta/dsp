/**
 * Precios: única fuente de verdad del monto a cobrar.
 *
 * Corre en el servidor (`/api/orders`). El navegador solo manda
 * variantId + cantidad; los importes salen de `product_variants`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { FREE_SHIPPING_THRESHOLD, STANDARD_SHIPPING, TENANT_ID } from './constants';

export { FREE_SHIPPING_THRESHOLD, STANDARD_SHIPPING };

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

/** Envío estándar, gratis a partir del umbral. */
export function shippingCostFor(subtotal: number) {
  return subtotal >= FREE_SHIPPING_THRESHOLD || subtotal <= 0 ? 0 : STANDARD_SHIPPING;
}

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatMXN(n: number): string {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export interface RawRequestedItem {
  variantId?: unknown;
  qty?: unknown;
}

export class PricingError extends Error {}

/**
 * Recalcula los items del pedido a partir de la base de datos.
 * Nunca confía en precios, nombres ni imágenes enviados por el cliente.
 */
export async function priceItems(
  supabase: SupabaseClient,
  requested: RawRequestedItem[]
): Promise<PricedItem[]> {
  if (!Array.isArray(requested) || requested.length === 0) {
    throw new PricingError('El carrito está vacío.');
  }

  // Une duplicados y descarta cantidades inválidas
  const quantities = new Map<string, number>();
  for (const raw of requested) {
    const variantId = typeof raw?.variantId === 'string' ? raw.variantId.trim() : '';
    const qty = Math.floor(Number(raw?.qty));
    if (!variantId) continue;
    if (!Number.isFinite(qty) || qty <= 0) throw new PricingError('Cantidad inválida.');
    if (qty > 99) throw new PricingError('Máximo 99 piezas por artículo.');

    const next = (quantities.get(variantId) ?? 0) + qty;
    if (next > 99) throw new PricingError('Máximo 99 piezas por artículo.');
    quantities.set(variantId, next);
  }

  if (quantities.size === 0) throw new PricingError('El carrito está vacío.');

  const { data, error } = await supabase
    .from('product_variants')
    .select(
      'id, product_id, name, size, color, price, is_deleted, products!inner(id, name, slug, tenant_id, is_active, is_deleted, product_images(url, position))'
    )
    .in('id', [...quantities.keys()]);

  if (error) throw new PricingError('No pudimos validar tu carrito. Intenta de nuevo.');

  const rows = data ?? [];
  if (rows.length !== quantities.size) {
    throw new PricingError('Una pieza de tu carrito ya no está disponible.');
  }

  return rows.map((row: any) => {
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    if (!product || product.is_deleted || !product.is_active || product.tenant_id !== TENANT_ID) {
      throw new PricingError(`“${product?.name ?? 'Una pieza'}” ya no está disponible.`);
    }
    if (row.is_deleted) {
      throw new PricingError(`“${product.name}” ya no está disponible.`);
    }

    const images = [...(product.product_images ?? [])].sort(
      (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)
    );

    return {
      variantId: row.id,
      productId: row.product_id,
      productSlug: product.slug ?? null,
      name: product.name,
      variantName: row.name ?? [row.size, row.color].filter(Boolean).join(' · '),
      price: Number(row.price),
      qty: quantities.get(row.id)!,
      image: images[0]?.url ?? null,
      size: row.size ?? null,
      color: row.color ?? null,
    };
  });
}

export function totalsFor(items: PricedItem[]) {
  const subtotal = round2(items.reduce((sum, i) => sum + i.price * i.qty, 0));
  const shipping = shippingCostFor(subtotal);
  return { subtotal, shipping, total: round2(subtotal + shipping) };
}
