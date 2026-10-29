/**
 * GET /sitemap.xml
 *
 * El sitio renderiza en SSR (`output: 'server'`), así que `@astrojs/sitemap`
 * no puede enumerar páginas: solo ve las prerenderizadas y aquí no hay
 * ninguna. Por eso el sitemap se arma en runtime:
 *
 *   - rutas fijas en sus dos idiomas (`/tienda` y `/shop`, …)
 *   - todas las piezas activas (`/producto/:slug` y `/product/:slug`)
 *
 * Los alias ingleses se listan a propósito: son URLs reales servidas por el
 * middleware y en el `<head>` se declaran como alternates.
 *
 * `robots.txt` apunta aquí. Si se cae Supabase, se devuelven las rutas fijas:
 * un sitemap incompleto es mejor que un 500.
 */
import type { APIRoute } from 'astro';
import type { AstroCookies } from 'astro';
import { ROUTES, type RouteKey } from '../lib/routes';
import { TENANT_ID } from '../lib/constants';
import { createSupabaseServerClient } from '../lib/supabase-server';

export const prerender = false;

/** Solo lo que un buscador debería indexar (sin cuenta, carrito ni admin). */
const PUBLIC_ROUTES: RouteKey[] = [
  'shop',
  'about',
  'contact',
  'sizes',
  'shipping',
  'returns',
  'privacy',
  'terms',
];

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const urlEntry = (loc: string, changefreq: string, priority: string) =>
  `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

export const GET: APIRoute = async ({
  site,
  request,
  cookies,
}: {
  site: URL | undefined;
  request: Request;
  cookies: AstroCookies;
}) => {
  const base = (site ?? new URL(request.url).origin).toString().replace(/\/+$/, '');

  const entries: string[] = [urlEntry(`${base}/`, 'weekly', '1.0')];

  for (const key of PUBLIC_ROUTES) {
    const route = ROUTES[key];
    entries.push(urlEntry(`${base}${route.es}`, 'monthly', '0.7'));
    if (route.en !== route.es) {
      entries.push(urlEntry(`${base}${route.en}`, 'monthly', '0.7'));
    }
  }

  // Piezas activas, en los dos idiomas de ruta.
  let productSlugs: string[] = [];
  try {
    const supabase = createSupabaseServerClient(request, cookies);
    const { data } = await supabase
      .from('products')
      .select('slug')
      .eq('tenant_id', TENANT_ID)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .not('slug', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1000);

    productSlugs = (data ?? [])
      .map((row: { slug: string | null }) => row.slug)
      .filter((slug): slug is string => Boolean(slug));
  } catch {
    // Sin base de datos: el sitemap queda con las rutas fijas.
  }

  for (const slug of productSlugs) {
    const encoded = encodeURIComponent(slug);
    entries.push(urlEntry(`${base}/producto/${encoded}`, 'weekly', '0.8'));
    entries.push(urlEntry(`${base}/product/${encoded}`, 'weekly', '0.8'));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
};
