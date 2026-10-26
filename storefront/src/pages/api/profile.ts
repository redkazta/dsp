/**
 * GET /api/profile — datos básicos del usuario para el checkout.
 */
import type { APIRoute } from 'astro';
import type { AstroCookies } from 'astro';
import { createSupabaseServerClient } from '../../lib/supabase-server';

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies }: { request: Request; cookies: AstroCookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });

  return new Response(JSON.stringify({
    id: user.id,
    email: user.email,
    name: user.user_metadata?.name ?? user.user_metadata?.full_name ?? null,
    phone: user.user_metadata?.phone ?? null,
  }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
};
