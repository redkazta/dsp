/**
 * Supabase Server Client (SSR)
 * Usa cookies para que el middleware y las páginas SSR vean la sesión.
 */

import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr';
import type { AstroCookies } from 'astro';

export const SUPABASE_URL = 'https://dzrxwmyxxhjonhbfgfvo.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6cnh3bXl4eGhqb25oYmZnZnZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3NTI5MTQsImV4cCI6MjEwNzMyODkxNH0.U4Nuekvw7JcM4xx39OHKxIjReyM7_4xrs0iDURu--lY';

export function createSupabaseServerClient(request: Request, cookies: AstroCookies) {
  const url = import.meta.env.PUBLIC_SUPABASE_URL || SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get('Cookie') ?? '').map((c) => ({
          name: c.name,
          value: c.value ?? '',
        }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookies.set(name, value, { ...options, path: '/' })
        );
      },
    },
  });
}
