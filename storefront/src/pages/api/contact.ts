/**
 * /api/contact — recibe los mensajes de /contacto y /contact.
 *
 * Antes el formulario solo abría el cliente de correo del visitante
 * (`mailto:`), así que si no enviaba el mensaje no quedaba rastro. Ahora:
 *
 *   1. se guarda en `contact_messages` (fuente de verdad)
 *   2. se envía un aviso por correo con Resend, si está configurado
 *
 * Escribir con service role es a propósito: la tabla tiene RLS sin policy
 * de INSERT, así que el navegador no puede insertar ni leer nada. El API
 * valida y guarda.
 */
import type { APIRoute } from 'astro';
import type { AstroCookies } from 'astro';
import { createSupabaseAdminClient, createSupabaseServerClient } from '../../lib/supabase-server';
import { TENANT_ID } from '../../lib/constants';
import { normalizeLang } from '../../lib/i18n';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const max = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Límite simple en memoria por IP. No es un WAF, pero frena el abuso obvio
// sin añadir otra dependencia ni tabla.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_PER_WINDOW) {
    hits.set(ip, list);
    return true;
  }
  list.push(now);
  hits.set(ip, list);
  return false;
}

export const POST: APIRoute = async ({
  request,
  cookies,
}: {
  request: Request;
  cookies: AstroCookies;
}) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  if (rateLimited(ip)) return json({ error: 'rate_limited' }, 429);

  // Honeypot: un campo que solo los bots rellenan.
  if (max(body?.company, 100)) return json({ ok: true });

  const name = max(body?.name, 120);
  const email = max(body?.email, 200).toLowerCase();
  const subject = max(body?.subject, 160);
  const message = max(body?.message, 5000);

  if (name.length < 2) return json({ error: 'invalid_name' }, 400);
  if (!EMAIL.test(email)) return json({ error: 'invalid_email' }, 400);
  if (subject.length < 3) return json({ error: 'invalid_subject' }, 400);
  if (message.length < 10) return json({ error: 'invalid_message' }, 400);

  const lang = normalizeLang(body?.lang ?? cookies.get('dsp_lang')?.value);

  // La sesión la decide el servidor, no el navegador: un invitado no puede
  // hacerse pasar por usuario enviando un id en el cuerpo.
  let userId: string | null = null;
  let userEmail: string | null = null;
  try {
    const supabaseUser = createSupabaseServerClient(request, cookies);
    const { data } = await supabaseUser.auth.getUser();
    userId = data.user?.id ?? null;
    userEmail = data.user?.email?.toLowerCase() ?? null;
  } catch {
    userId = null;
  }

  // Con sesión, el correo es el de la cuenta: evita suplantar a terceros
  // desde un formulario autenticado.
  const finalEmail = userEmail ?? email;

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    // Sin service role no se puede guardar: mejor decir la verdad que
    // fingir que se envió. El log dice exactamente qué falta en Vercel.
    console.error(
      '[contact] falta SUPABASE_SERVICE_ROLE_KEY (Vercel → Settings → Environment Variables, scope Production). El mensaje no se guardó.'
    );
    return json({ error: 'not_configured' }, 503);
  }

  const { error } = await supabase.from('contact_messages').insert({
    tenant_id: TENANT_ID,
    user_id: userId,
    name,
    email: finalEmail,
    subject,
    message,
    lang,
    user_agent: max(request.headers.get('user-agent'), 300) || null,
  });

  if (error) {
    console.error('[contact] no se pudo guardar:', error.code, error.message);
    return json({ error: 'save_failed' }, 500);
  }

  // Aviso por correo (mejor esfuerzo: no bloquea la respuesta).
  try {
    const { sendContactNotification } = await import('../../lib/resend');
    const sent = await sendContactNotification({ name, email, subject, message, lang });

    if (!sent.ok) {
      console.warn('[contact] el mensaje se guardó pero el aviso no salió:', sent.reason, sent.status ?? '');
    }
  } catch (err: any) {
    // El mensaje ya está guardado; perder el aviso no rompe nada.
    console.error('[contact] aviso por correo:', err?.message);
  }

  return json({ ok: true });
};
