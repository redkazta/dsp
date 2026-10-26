/**
 * Middleware global.
 *
 * - Refresca la sesión de Supabase en cookies.
 * - Resuelve nombre, correo y rol una sola vez por request y los publica
 *   en `Astro.locals` (HTML server-rendered, sin parpadeos).
 * - Bloquea /admin antes de renderizar y protege /cuenta y /checkout.
 * - Los assets y los endpoints no pagan el costo de `getUser()`.
 */

import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient } from './lib/supabase-server';
import { STAFF_ROLES, NOT_FOUND_HEADERS } from './lib/constants';
import { LANG_COOKIE, langFromAcceptHeader, normalizeLang } from './lib/i18n';

/** Rutas que no necesitan sesión ni consultas a Supabase. */
const PUBLIC_ASSET = /^\/(_astro|_image|fonts|images|icons)\/|^\/(favicon|og-image|robots|sitemap)\./i;
const PUBLIC_FILE = /\.(?:css|js|mjs|map|svg|png|jpe?g|webp|avif|gif|ico|woff2?|ttf|otf|txt|xml|json)$/i;

/** Se pueden visitar con o sin sesión. */
const PUBLIC_PAGES = new Set(['/entrar', '/registro', '/recuperar', '/nueva-password']);

/** Exigen sesión. */
const PRIVATE_PREFIXES = ['/cuenta', '/checkout', '/confirmacion'];

const isStaffRole = (role: string | null) =>
  role !== null && (STAFF_ROLES as readonly string[]).includes(role);

/** `next` seguro: solo rutas internas. */
function safeNext(raw: string | null, fallback = '/cuenta') {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return fallback;
  return raw;
}

export const onRequest = defineMiddleware(async (context: any, next: any) => {
  const { pathname } = context.url;

  if (PUBLIC_ASSET.test(pathname) || (PUBLIC_FILE.test(pathname) && !pathname.startsWith('/api/'))) {
    return next();
  }

  const supabase = createSupabaseServerClient(context.request, context.cookies);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let firstName: string | null = null;
  let phone: string | null = null;
  let role: string | null = null;

  if (user) {
    const meta = user.user_metadata ?? {};

    // Si el perfil falla (RLS, red), el header no se cae: usa los metadatos.
    let profile: {
      first_name: string | null;
      full_name: string | null;
      phone: string | null;
      role: string | null;
    } | null = null;

    try {
      const { data } = await supabase
        .from('customer_profiles')
        .select('first_name, full_name, phone, role')
        .eq('id', user.id)
        .maybeSingle();

      profile = data;
    } catch {
      profile = null;
    }

    const fallbackName = (profile?.full_name as string) ?? (meta.full_name as string) ?? '';

    firstName =
      profile?.first_name ??
      (meta.given_name as string) ??
      (meta.first_name as string) ??
      (fallbackName.split(' ')[0] || (user.email ?? '').split('@')[0] || null);

    phone = profile?.phone ?? (meta.phone as string) ?? null;

    // El rol se decide aquí. Solo cuenta si viene de la tabla (no del metadata,
    // que el usuario puede manipular al registrarse).
    role = profile?.role ?? null;
  }

  const isStaff = isStaffRole(role);

  // ---------- Rutas privadas del panel ----------
  // Para cualquier visitante sin permisos de staff (con o sin sesión) el panel
  // no existe: se manda a la portada con un redirect normal, sin 401/403 que
  // delaten que /admin es una ruta real.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (!user || !isStaff) {
      return context.redirect('/', 307);
    }
  }

  // ---------- Rutas privadas del cliente ----------
  if (PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (!user) return context.redirect(`/entrar?next=${encodeURIComponent(pathname + context.url.search)}`, 302);
  }

  // ---------- Con sesión, las pantallas de acceso no tienen sentido ----------
  if (user && ['/entrar', '/registro'].includes(pathname)) {
    return context.redirect(safeNext(context.url.searchParams.get('next'), '/cuenta'), 302);
  }

  // ---------- Correo de recuperación: vuelve con un código a /nueva-password ----------
  if (user && pathname === '/recuperar') {
    return context.redirect('/nueva-password', 302);
  }

  context.locals.user = user;
  context.locals.isAuthenticated = Boolean(user);
  context.locals.firstName = firstName;
  context.locals.phone = phone;
  context.locals.email = user?.email ?? null;
  context.locals.role = role;
  context.locals.isStaff = isStaff;

  // ---------- Idioma (cookie propia o Accept-Language) ----------
  // Se resuelve en servidor: el HTML sale ya traducido, sin parpadeo.
  const cookieLang = context.cookies.get(LANG_COOKIE)?.value;
  context.locals.lang = cookieLang
    ? normalizeLang(cookieLang)
    : langFromAcceptHeader(context.request.headers.get('accept-language'));

  const response = await next();

  if (response.headers.get('content-type')?.includes('text/html')) {
    // Las cookies del refresh que escribe `next()` deben conservarse
    const out = new Response(response.body, response);
    out.headers.set('x-authenticated', user ? '1' : '0');
    out.headers.set('Cache-Control', 'private, no-store');
    return out;
  }

  return response;
});
