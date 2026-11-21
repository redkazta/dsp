/**
 * GET /api/admin/orders — pedidos del panel.
 *
 * Solo staff. Lee con service role por el mismo motivo que la bandeja de
 * mensajes: las policies de `orders` dependen de `is_admin()` y, si la
 * allowlist o la función no están al día, la consulta del navegador devuelve
 * 0 filas aunque el pedido exista. Así el panel muestra el dato real y el
 * acceso sigue validado por el rol (middleware).
 *
 * No se filtra por tenant: la tienda tiene una sola. Sí se respeta
 * `is_deleted`.
 */
import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '../../../lib/supabase-server';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const GET: APIRoute = async (context: any) => {
  const { locals } = context;

  if (!locals?.isStaff) return json({ error: 'forbidden' }, 403);

  const db = createSupabaseAdminClient();
  if (!db) return json({ error: 'not_configured' }, 503);

  const { data, error } = await db
    .from('orders')
    .select('*, order_items(*), order_status_history(status, notes, created_at)')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[admin] orders', error.code, error.message);
    return json({ error: error.message }, 500);
  }

  return json({ orders: data ?? [] });
};
