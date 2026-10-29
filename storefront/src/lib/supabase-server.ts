/**
 * Supabase Server Client (SSR)
 *
 * Reglas:
 * - Las variables `PUBLIC_*` son públicas por diseño (RLS protege los datos).
 * - El service role NUNCA se expone al navegador. Solo lo usa el cliente
 *   "admin" para el checkout y el formulario de contacto.
 * - Las variables de servidor se leen con `serverEnv()`, que mira
 *   `process.env` en runtime: `import.meta.env` las deja grabadas al compilar.
 */

import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';
import { serverEnv } from './env';

/** Respaldo: la anon key es pública por diseño (RLS protege los datos). */
const FALLBACK_URL = 'https://dzrxwmyxxhjonhbfgfvo.supabase.co';
const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6cnh3bXl4eGhqb25oYmZnZnZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3NTI5MTQsImV4cCI6MjEwNzMyODkxNH0.U4Nuekvw7JcM4xx39OHKxIjReyM7_4xrs0iDURu--lY';

export function getSupabaseConfig() {
  return {
    url: import.meta.env.PUBLIC_SUPABASE_URL || FALLBACK_URL,
    anonKey: import.meta.env.PUBLIC_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY,
  };
}

/** Cliente atado a la sesión del visitante (respeta RLS). */
export function createSupabaseServerClient(request: Request, cookies: AstroCookies) {
  const { url, anonKey } = getSupabaseConfig();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get('Cookie') ?? '').map(
          (c: { name: string; value: string }) => ({ name: c.name, value: c.value ?? '' })
        );
      },
      setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
        cookiesToSet.forEach(({ name, value, options }) => cookies.set(name, value, { ...options, path: '/' }));
      },
    },
  });
}

/** ¿Está configurada la llave de servicio? (checkout sin RLS de cliente) */
export function hasServiceRole() {
  return Boolean(serverEnv('SUPABASE_SERVICE_ROLE_KEY'));
}

/**
 * Cliente con service role. Solo servidor: crea pedidos ya validados.
 * Si no hay llave, devuelve null y el checkout cae al flujo RLS (que exige sesión).
 */
export function createSupabaseAdminClient() {
  const key = serverEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!key) return null;

  const { url } = getSupabaseConfig();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
