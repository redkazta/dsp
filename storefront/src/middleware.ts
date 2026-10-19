/**
 * Middleware global.
 * - Refresca la sesión de Supabase en cookies.
 * - Expone si hay sesión al HTML renderizado (header, cuenta).
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

  // Rutas privadas: solo staff
  if (pathname.startsWith('/admin')) {
    if (!user) return context.redirect('/entrar', 302);

    const { data: profile } = await supabase
      .from('customer_profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || !['admin', 'seller'].includes(profile.role)) {
      return context.redirect('/', 302);
    }
  }

  // Con sesión, /entrar y /registro no tienen sentido
  if (user && (pathname === '/entrar' || pathname === '/registro')) {
    return context.redirect('/cuenta', 302);
  }

  context.locals.user = user;
  context.locals.isAuthenticated = Boolean(user);

  const response = await next();

  if (response.headers.get('content-type')?.includes('text/html')) {
    response.headers.set('x-authenticated', user ? '1' : '0');
    response.headers.set('Cache-Control', 'private, no-store');
  }

  return response;
});
