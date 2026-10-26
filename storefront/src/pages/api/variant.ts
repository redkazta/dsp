/**
 * /api/variant?product=<uuid>
 *
 * Devuelve la variante "por defecto" de un producto para poder llevarlo al
 * carrito desde la wishlist sin abrir la ficha.
 *
 * Criterio: la primera variante con stock, ordenada por talla y precio.
 * Si ninguna tiene stock, devuelve la primera de todas (con stock 0) para
 * que el cliente pueda decir "no disponible" en vez de fallar en silencio.
 */
import type { APIRoute } from 'astro';
import type { AstroCookies } from 'astro';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '../../lib/supabase-server';
import { TENANT_ID } from '../../lib/constants';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function defaultVariant(supabase: SupabaseClient, productId: string) {
  const { data: product } = await supabase
    .from('products')
    .select('id, tenant_id, is_active, is_deleted')
    .eq('id', productId)
    .maybeSingle();

  if (!product || product.is_deleted || !product.is_active || product.tenant_id !== TENANT_ID) {
    return null;
  }

  const { data } = await supabase
    .from('product_variants')
    .select('id, name, size, color, price, stock, is_deleted')
    .eq('product_id', productId)
    .eq('is_deleted', false)
    .order('stock', { ascending: false })
    .order('price', { ascending: true })
    .limit(1);

  const row = (data ?? [])[0] as any;
  if (!row) return null;

  return {
    id: row.id,
    name: row.name ?? '',
    size: row.size ?? null,
    color: row.color ?? null,
    price: Number(row.price) || 0,
    stock: Number(row.stock) || 0,
  };
}

export const GET: APIRoute = async ({ request, cookies }: { request: Request; cookies: AstroCookies }) => {
  const url = new URL(request.url);
  const productId = url.searchParams.get('product') ?? '';

  if (!UUID.test(productId)) return json({ error: 'Producto inválido' }, 400);

  const supabase = createSupabaseServerClient(request, cookies);
  const variant = await defaultVariant(supabase, productId);

  if (!variant) return json({ error: 'Producto no disponible' }, 404);
  return json({ variant });
};
