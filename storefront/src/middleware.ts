/**
 * Middleware global.
 * - Refresca la sesión de Supabase en cookies.
 * - Expone nombre y rol al HTML renderizado (header, cuenta).
 * - Bloquea /admin antes de renderizar: sin sesión → /entrar, sin rol → /.
 */

import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient } from './lib/supabase-server';

export const onRequest = defineMiddleware(async (context: any, next: any) => {
  const supabase = createSupabaseServerClient(context.request, context.cookies);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = context.url;

  let firstName: string | null = null;
  let phone: string | null = null;
  let role: string | null = null;

  if (user) {
    const meta = user.user_metadata ?? {};

    // Si el perfil falla (RLS, red), el header no se cae: usa los metadatos.
    let profile: { first_name: string | null; full_name: string | null; phone: string | null; role: string | null } | null =
      null;

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
      (fallbackName.split(' ')[0] ?? (user.email ?? '').split('@')[0]);

    phone = profile?.phone ?? (meta.phone as string) ?? null;
    role = profile?.role ?? null;

    // Rutas privadas: solo staff
    if (pathname.startsWith('/admin')) {
      if (!role || ['admin', 'seller'].includes(role) === false) {
        return context.redirect('/', 302);
      }
    }

    // Con sesión, /entrar y /registro no tienen sentido
    if (pathname === '/entrar' || pathname === '/registro') {
      return context.redirect('/cuenta', 302);
    }
  } else if (pathname.startsWith('/admin')) {
    return context.redirect('/entrar', 302);
  }

  context.locals.user = user;
  context.locals.isAuthenticated = Boolean(user);
  context.locals.firstName = firstName;
  context.locals.phone = phone;
  context.locals.role = role;

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
