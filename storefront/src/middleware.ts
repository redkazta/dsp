/**
 * Middleware global.
 * Bloquea /admin antes de renderizar: sin sesión → /entrar, sin rol → /.
 */

import { defineMiddleware } from 'astro:middleware';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dzrxwmyxxhjonhbfgfvo.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6cnh3bXl4eGhqb25oYmZnZnZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3NTI5MTQsImV4cCI6MjEwNzMyODkxNH0.U4Nuekvw7JcM4xx39OHKxIjReyM7_4xrs0iDURu--lY';

function extractAccessToken(cookieHeader: string): string | null {
  // Supabase guarda la sesión en sb-<ref>-auth-token (o en chunks .0, .1)
  const matches = [...cookieHeader.matchAll(/sb-[a-z0-9]+-auth-token(?:\.\d+)?=([^;]+)/gi)];
  if (matches.length === 0) return null;

  const raw = matches.map((m) => decodeURIComponent(m[1])).join('');

  try {
    const parsed = JSON.parse(raw.startsWith('base64-') ? atob(raw.slice(7)) : raw);
    if (typeof parsed?.access_token === 'string') return parsed.access_token;
    if (typeof parsed?.[0] === 'string') return parsed[0];
    return null;
  } catch {
    return null;
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  if (!context.url.pathname.startsWith('/admin')) return next();

  const token = extractAccessToken(context.request.headers.get('cookie') ?? '');
  if (!token) return context.redirect('/entrar?next=/admin', 302);

  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL || SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );

  const { data: userData, error } = await supabase.auth.getUser(token);
  if (error || !userData.user) return context.redirect('/entrar?next=/admin', 302);

  const { data: profile } = await supabase
    .from('customer_profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (!profile || !['admin', 'seller'].includes(profile.role)) {
    return context.redirect('/?error=sin-permisos', 302);
  }

  return next();
});
