/**
 * Middleware global.
 * - Refresca la sesión de Supabase en cookies.
 * - Expone nombre y rol al HTML renderizado (header, cuenta).
 * - Bloquea /admin antes de renderizar: sin sesión → /entrar, sin rol → /.
 */

import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient } from './lib/supabase-server';

export const onRequest = defineMiddleware(async (context, next) => {
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

    const { data: profile } = await supabase
      .from('customer_profiles')
      .select('first_name, full_name, phone, role')
      .eq('id', user.id)
      .maybeSingle();

    firstName =
      profile?.first_name ??
      (meta.given_name as string) ??
      (meta.first_name as string) ??
      ((profile?.full_name as string) ?? (meta.full_name as string) ?? '').split(' ')[0] ||
      (user.email ?? '').split('@')[0];

    phone = profile?.phone ?? (meta.phone as string) ?? null;
    role = profile?.role ?? null;

    // Rutas privadas: solo staff
    if (pathname.startsWith('/admin')) {
      if (!role || !['admin', 'seller'].includes(role)) {
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
    response.headers.set('x-authenticated', user ? '1' : '0');
    response.headers.set('Cache-Control', 'private, no-store');
  }

  return response;
});
