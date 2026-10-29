/**
 * Resend — confirmaciones de compra con dominio personalizado.
 *
 * Variables de entorno (Vercel):
 *   RESEND_API_KEY  → clave de Resend
 *   RESEND_DOMAIN  → dominio verificado (ej. dinerossobreproblemas.com)
 */

import { serverEnv } from './env';

const RESEND_API = 'https://api.resend.com/emails';

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
  const apiKey = serverEnv('RESEND_API_KEY') ?? '';
  const domain = serverEnv('RESEND_DOMAIN') ?? 'dinerosobreproblemas.com';

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
        from: `Dinero Sobre Problemas <noreply@${domain}>`,
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
      console.error('[resend] error:', res.status, err);
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
  const apiKey = serverEnv('RESEND_API_KEY') ?? '';
  const domain = serverEnv('RESEND_DOMAIN') ?? 'dinerosobreproblemas.com';
  const to = serverEnv('CONTACT_EMAIL') ?? `hola@${domain}`;

  if (!apiKey) return { ok: false, reason: 'no_key' };

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
        from: `Dinero Sobre Problemas <noreply@${domain}>`,
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
      console.error('[resend] contacto:', res.status, err);
      return { ok: false, reason: 'resend_error', status: res.status };
    }

    return { ok: true };
  } catch (e: any) {
    console.error('[resend] contacto exception:', e?.message);
    return { ok: false, reason: 'exception' };
  }
}
