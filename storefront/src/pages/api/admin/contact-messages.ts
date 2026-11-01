/**
 * /api/admin/contact-messages — bandeja de mensajes del formulario.
 *
 * Solo staff. Lee y escribe con service role para no depender de las policies
 * de RLS de `contact_messages` (si el script no se corrió, la lectura devolvía
 * 0 filas y la bandeja se veía vacía aunque los mensajes existieran).
 *
 *   GET  ?status=all|new|read|replied|archived&search=texto
 *   GET  ?count=1                → { count } de mensajes sin leer
 *   POST { id, action: 'status', status }
 *   POST { id, action: 'delete' }
 */
import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '../../../lib/supabase-server';
import { TENANT_ID } from '../../../lib/constants';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const STATUSES = new Set(['new', 'read', 'replied', 'archived']);

export const GET: APIRoute = async (context: any) => {
  const { locals, url } = context;

  if (!locals?.isStaff) return json({ error: 'forbidden' }, 403);

  const db = createSupabaseAdminClient();
  if (!db) return json({ error: 'not_configured' }, 503);

  if (url.searchParams.get('count') === '1') {
    const { count, error } = await db
      .from('contact_messages')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_ID)
      .eq('status', 'new');

    if (error) return json({ error: error.message }, 500);
    return json({ count: count ?? 0 });
  }

  const status = url.searchParams.get('status') ?? 'all';
  const search = (url.searchParams.get('search') ?? '').trim();

  // Conteos por estado (para las pestañas), independientes del filtro activo.
  const [allCount, newCount, readCount, repliedCount, archivedCount] = await Promise.all([
    db.from('contact_messages').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID),
    db.from('contact_messages').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('status', 'new'),
    db.from('contact_messages').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('status', 'read'),
    db.from('contact_messages').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('status', 'replied'),
    db.from('contact_messages').select('id', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID).eq('status', 'archived'),
  ]);

  const counts = {
    all: allCount.count ?? 0,
    new: newCount.count ?? 0,
    read: readCount.count ?? 0,
    replied: repliedCount.count ?? 0,
    archived: archivedCount.count ?? 0,
  };

  let query = db
    .from('contact_messages')
    .select('id, name, email, subject, message, lang, status, user_agent, created_at')
    .eq('tenant_id', TENANT_ID)
    .order('created_at', { ascending: false })
    .limit(100);

  if (STATUSES.has(status)) query = query.eq('status', status);

  // Se limpian comas y paréntesis: rompen el filtro `or()` de PostgREST.
  const term = search.replace(/[%,()]/g, ' ').trim();
  if (term) {
    query = query.or(
      `name.ilike.%${term}%,email.ilike.%${term}%,subject.ilike.%${term}%,message.ilike.%${term}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error('[admin] contact-messages', error.code, error.message);
    return json({ error: error.message }, 500);
  }

  return json({ messages: data ?? [], counts });
};

export const POST: APIRoute = async (context: any) => {
  const { locals, request } = context;

  if (!locals?.isStaff) return json({ error: 'forbidden' }, 403);

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const id = typeof payload?.id === 'string' ? payload.id : '';
  const action = typeof payload?.action === 'string' ? payload.action : '';

  if (!id || !['status', 'delete'].includes(action)) {
    return json({ error: 'invalid_body' }, 400);
  }

  const db = createSupabaseAdminClient();
  if (!db) return json({ error: 'not_configured' }, 503);

  if (action === 'delete') {
    const { error } = await db.from('contact_messages').delete().eq('id', id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  const status = typeof payload?.status === 'string' ? payload.status : '';
  if (!STATUSES.has(status)) return json({ error: 'invalid_body' }, 400);

  const { error } = await db.from('contact_messages').update({ status }).eq('id', id);
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, status });
};
