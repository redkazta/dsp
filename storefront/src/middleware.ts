/**
 * Middleware global.
 * - Refresca la sesión de Supabase en cookies.
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

  return next();
});
