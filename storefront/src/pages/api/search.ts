/**
 * GET /api/search?q=… → resultados ligeros para el buscador del header.
 * Solo devuelve piezas activas del tenant.
 */
import type { APIRoute } from 'astro';
import type { AstroCookies } from 'astro';
import { createSupabaseServerClient } from '../../lib/supabase-server';
import { TENANT_ID } from '../../lib/constants';
import { categoryName, type Lang } from '../../lib/i18n';
import { productName } from '../../lib/product-texts';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const GET: APIRoute = async ({
  request,
  cookies,
  locals,
}: {
  request: Request;
  cookies: AstroCookies;
  locals: App.Locals;
}) => {
  const lang = (locals?.lang ?? 'es') as Lang;
  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, 60);
  if (q.length < 2) return json({ results: [] });

  // Escapa comodines de LIKE para que el término sea literal
  const term = q.replace(/[%_,]/g, (ch) => `\\${ch}`);

  const supabase = createSupabaseServerClient(request, cookies);

  const { data, error } = await supabase
    .from('products')
    .select('id, name, name_en, slug, base_price, categories(name, slug), product_variants(price), product_images(url, position)')
    .eq('tenant_id', TENANT_ID)
    .eq('is_active', true)
    .eq('is_deleted', false)
    .ilike('name', `%${term}%`)
    .order('created_at', { ascending: false })
    .limit(6);

  if (error) return json({ results: [] }, 200);

  const results = (data ?? []).map((p: any) => {
    const images = [...(p.product_images ?? [])].sort(
      (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)
    );
    const variants = p.product_variants ?? [];

    return {
      id: p.id,
      name: productName(p, lang),
      slug: p.slug ?? p.id,
      category: categoryName(lang, p.categories),
      price: Number(variants[0]?.price ?? p.base_price ?? 0),
      image: images[0]?.url ?? null,
    };
  });

  return json({ results });
};
