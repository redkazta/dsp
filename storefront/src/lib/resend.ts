/**
 * Resend — confirmaciones de compra con dominio personalizado.
 *
 * Variables de entorno (Vercel):
 *   RESEND_API_KEY  → clave de Resend
 *   RESEND_DOMAIN  → dominio verificado (ej. dinerosobreproblemas.com)
 *
 * `RESEND_DOMAIN` se normaliza: si alguien la guarda como
 * `https://dominio.com`, `@dominio.com` o con espacios, el remitente sale
 * inválido y Resend responde 403/422 sin pista clara.
 *
 * La clave se acepta también como `RESENDAPIKEY` (sin guiones bajos): así
 * está creada hoy en Vercel y renombrarla ahí no es posible.
 *
 * Remitente: se firma con `RESEND_DOMAIN`. Mientras
 * `dinerosobreproblemas.com` no esté verificado en Resend (hoy sale
 * `not_started` y el envío da 403), se usa `wildgvng.com.mx`.
 */

import { serverEnv } from './env';

const RESEND_API = 'https://api.resend.com/emails';

/** Dominio verificado en Resend con el que se firma hoy. */
const SENDING_DOMAIN = 'wildgvng.com.mx';
/** Dominio de la marca: pendiente de DNS en Resend. */
const BRAND_DOMAIN = 'dinerosobreproblemas.com';

/** Nombres aceptados para la clave, en orden de preferencia. */
const API_KEY_NAMES = ['RESEND_API_KEY', 'RESENDAPIKEY'] as const;

/** Primera variable de la lista que exista y no esté vacía. */
export function resendApiKey(): string {
  for (const name of API_KEY_NAMES) {
    const value = serverEnv(name);
    if (value) return value;
  }
  return '';
}

/** Deja `RESEND_DOMAIN` en un hostname limpio. */
function normalizeDomain(raw: string | undefined): string {
  return (raw ?? '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^@/, '')
    .replace(/[/?#].*$/, '')
    .trim()
    .toLowerCase();
}

/** Configuración efectiva de Resend (sin exponer la clave completa). */
export function resendConfig() {
  const apiKey = resendApiKey();
  const requested = normalizeDomain(serverEnv('RESEND_DOMAIN'));

  // Cuando `dinerosobreproblemas.com` pase a `verified` en Resend, elimina la
  // comparación con BRAND_DOMAIN: el remitente debe volver al de la marca.
  const domain =
    !requested || requested === BRAND_DOMAIN ? SENDING_DOMAIN : requested;

  return {
    apiKey,
    domain,
    from: `Dinero Sobre Problemas <noreply@${domain}>`,
    contactEmail: serverEnv('CONTACT_EMAIL')?.trim() || `support@${BRAND_DOMAIN}`,
  };
}

export async function sendOrderConfirmation({
  to,
  orderNumber,
  customerName,
  total,
}: {
  to: string;
  orderNumber: string;
  customerName: string;
  total: string;
}) {
  const { apiKey, from } = resendConfig();

  if (!apiKey) {
    console.warn('[resend] RESEND_API_KEY no configurado; no se envía confirmación.');
    return { ok: false, reason: 'no_key' };
  }

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject: `Confirmación de pedido #${orderNumber}`,
        html: `<h2>¡Gracias por tu pedido, ${customerName}!</h2>
<p>Tu pedido <strong>#${orderNumber}</strong> ha sido confirmado.</p>
<p>Total: <strong>${total}</strong></p>
<p>Te enviaremos más detalles cuando el pedido esté en camino.</p>`,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[resend] error:', res.status, 'from:', from, 'to:', to, err);
      return { ok: false, reason: 'resend_error', status: res.status };
    }

    return { ok: true };
  } catch (e: any) {
    console.error('[resend] exception:', e?.message);
    return { ok: false, reason: 'exception' };
  }
}

/**
 * Aviso interno de un mensaje nuevo del formulario de contacto.
 *
 * Va a `CONTACT_EMAIL` (o al correo de la marca) y lleva `reply_to` del
 * visitante: responder desde el buzón contesta a la persona.
 *
 * Es "mejor esfuerzo": el mensaje ya quedó guardado en
 * `contact_messages`, así que un fallo aquí no rompe el envío.
 */
export async function sendContactNotification({
  name,
  email,
  subject,
  message,
  lang,
}: {
  name: string;
  email: string;
  subject: string;
  message: string;
  lang: string;
}) {
  const { apiKey, from, contactEmail: to } = resendConfig();

  if (!apiKey) {
    console.warn('[resend] RESEND_API_KEY no configurado; no se envía el aviso de contacto.');
    return { ok: false, reason: 'no_key' };
  }

  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        reply_to: email,
        subject: `Contacto (${lang.toUpperCase()}): ${subject}`,
        html: `<h2>Mensaje nuevo desde la tienda</h2>
<p><strong>Nombre:</strong> ${esc(name)}</p>
<p><strong>Email:</strong> ${esc(email)}</p>
<p><strong>Asunto:</strong> ${esc(subject)}</p>
<p><strong>Idioma:</strong> ${esc(lang)}</p>
<hr>
<p style="white-space:pre-wrap">${esc(message)}</p>`,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[resend] contacto:', res.status, 'from:', from, 'to:', to, err);
      return { ok: false, reason: 'resend_error', status: res.status };
    }

    console.info('[resend] aviso de contacto enviado a', to);
    return { ok: true };
  } catch (e: any) {
    console.error('[resend] contacto exception:', e?.message);
    return { ok: false, reason: 'exception' };
  }
}
