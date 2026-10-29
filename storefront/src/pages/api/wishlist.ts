/**
 * /api/wishlist — lista y mutaciones del usuario.
 *
 * GET    → lista del usuario
 * POST   → { merge: WishlistItem[] } fusiona lo local, o { productId, ... } alterna uno
 * DELETE → { productId } quita uno
 *
 * Los datos del producto (nombre, precio, imagen) se leen de la base:
 * el navegador solo puede decir "quiero este productId".
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
const max = (v: unknown, n = 200): string => (typeof v === 'string' ? v.trim().slice(0, n) : '');

function toItem(row: any) {
  return {
    productId: row.product_id,
    slug: row.product_slug ?? null,
    name: row.product_name ?? '',
    price: Number(row.price ?? 0),
    image: row.image_url ?? null,
  };
}

async function resolveUser(request: Request, cookies: AstroCookies) {
  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/**
 * Baja de una pieza. Devuelve cuántas filas se borraron: si es más de una
 * hay duplicados en la base (falta el UNIQUE `user_id, product_id`), y se
 * avisa en el log para poder limpiarlo.
 */
async function deleteWishlistRow(supabase: SupabaseClient, userId: string, productId: string) {
  const { data, error } = await supabase
    .from('wishlist_items')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', productId)
    .select('id');

  const rows = data?.length ?? 0;
  if (rows > 1) {
    console.warn(
      `[wishlist] se borraron ${rows} filas para el producto ${productId}: hay duplicados (aplica scripts/wishlist_dedupe.sql)`
    );
  }

  return { rows, error };
}

async function listItems(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('wishlist_items')
    .select('id, product_id, product_slug, product_name, price, image_url')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  // Un producto = una fila. Si en la base quedaron duplicados de antes del
  // UNIQUE, mostrarlos aquí duplicaría tarjetas y una baja parecería doble.
  const seen = new Set<string>();
  return (data ?? [])
    .filter((row: any) => {
      const key = String(row.product_id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(toItem);
}

/** Lee de catálogo lo mínimo para guardar un favorito confiable. */
async function productSnapshot(supabase: SupabaseClient, productId: string) {
  const { data } = await supabase
    .from('products')
    .select('id, name, slug, base_price, is_active, is_deleted, tenant_id, product_variants(price), product_images(url, position)')
    .eq('id', productId)
    .maybeSingle();

  if (!data || data.is_deleted || !data.is_active || data.tenant_id !== TENANT_ID) return null;

  const variants = (data.product_variants ?? []) as Array<{ price: number }>;
  const images = [...(data.product_images ?? [])].sort(
    (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)
  );

  return {
    product_id: data.id,
    product_slug: data.slug ?? null,
    product_name: data.name,
    price: Number(variants[0]?.price ?? data.base_price ?? 0),
    image_url: (images[0] as any)?.url ?? null,
  };
}

export const GET: APIRoute = async ({ request, cookies }) => {
  const url = new URL(request.url);

  // Catálogo de ids válidos (para limpiar favoritos locales de visitantes)
  if (url.searchParams.has('ids')) {
    const supabase = createSupabaseServerClient(request, cookies);
    const { data } = await supabase
      .from('products')
      .select('id')
      .eq('tenant_id', TENANT_ID)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .limit(500);

    return json({ ids: (data ?? []).map((p: any) => p.id) });
  }

  const { supabase, user } = await resolveUser(request, cookies);
  if (!user) return json({ items: [], guest: true });

  return json({ items: await listItems(supabase, user.id) });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const { supabase, user } = await resolveUser(request, cookies);
  if (!user) return json({ error: 'Inicia sesión para guardar favoritos.', guest: true }, 401);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400);
  }

  // ---------- Fusión de la wishlist local ----------
  if (Array.isArray(body?.merge)) {
    const ids: string[] = [
      ...new Set<string>(
        body.merge
          .map((i: any) => max(i?.productId, 40))
          .filter((id: string) => UUID.test(id))
      ),
    ].slice(0, 50);

    for (const id of ids) {
      const snapshot = await productSnapshot(supabase, id);
      if (snapshot) {
        await supabase
          .from('wishlist_items')
          .upsert({ user_id: user.id, ...snapshot }, { onConflict: 'user_id,product_id', ignoreDuplicates: true });
      }
    }

    return json({ items: await listItems(supabase, user.id) });
  }

  // ---------- Alternar un producto ----------
  const productId = max(body?.productId, 40);
  if (!UUID.test(productId)) return json({ error: 'Producto inválido' }, 400);

  const { data: existing } = await supabase
    .from('wishlist_items')
    .select('id')
    .eq('user_id', user.id)
    .eq('product_id', productId)
    .maybeSingle();

  if (existing) {
    await deleteWishlistRow(supabase, user.id, productId);
    return json({ items: await listItems(supabase, user.id), active: false });
  }

  const snapshot = await productSnapshot(supabase, productId);
  if (!snapshot) return json({ error: 'Producto no disponible' }, 404);

  const { error } = await supabase.from('wishlist_items').insert({ user_id: user.id, ...snapshot });
  if (error) return json({ error: 'No se pudo guardar el favorito' }, 500);

  return json({ items: await listItems(supabase, user.id), active: true });
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  const { supabase, user } = await resolveUser(request, cookies);
  if (!user) return json({ error: 'Inicia sesión para editar favoritos.', guest: true }, 401);

  // Los ids se aceptan por query (`productIds=a,b,c` para bajar varias piezas
  // de golpe, `productId=a` para una) y, como respaldo, en el body.
  const url = new URL(request.url);
  const many = url.searchParams.get('productIds');
  const single = url.searchParams.get('productId');

  const raw = many ? many.split(',') : single ? [single] : [];
  const body = raw.length > 0 ? null : await request.json().catch(() => ({}));

  const ids = [...new Set((raw.length > 0 ? raw : [(body as any)?.productId])
    .map((v) => max(v, 40))
    .filter((v) => UUID.test(v)))];

  if (ids.length === 0) {
    console.warn('[wishlist] DELETE sin productos válidos');
    return json({ error: 'Producto inválido' }, 400);
  }

  const { data, error } = await supabase
    .from('wishlist_items')
    .delete()
    .eq('user_id', user.id)
    .in('product_id', ids)
    .select('id');

  if (error) return json({ error: 'No se pudo quitar el favorito' }, 500);

  const rows = data?.length ?? 0;
  if (rows > ids.length) {
    console.warn(
      `[wishlist] se borraron ${rows} filas para ${ids.length} productos: hay duplicados (aplica scripts/wishlist_dedupe.sql)`
    );
  }

  return json({ items: await listItems(supabase, user.id), deleted: rows });
};
