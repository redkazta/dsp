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

/** Sitio público para los enlaces de los correos. */
const SITE =
  (serverEnv('SITE_URL') ?? 'https://www.dinerosobreproblemas.com').replace(/\/$/, '');

/** Envoltorio común: fondo negro, tipografía de la marca, pie con soporte. */
function emailShell(title: string, body: string, lang: 'es' | 'en' = 'es') {
  const footer =
    lang === 'en'
      ? `Reply to this email and a person will answer you. · <a href="${SITE}" style="color:#FFE28A;text-decoration:none">dinerosobreproblemas.com</a>`
      : `Responde a este correo y te contesta una persona. · <a href="${SITE}" style="color:#FFE28A;text-decoration:none">dinerosobreproblemas.com</a>`;

  return `<!doctype html>
<html lang="${lang}">
  <body style="margin:0;padding:0;background:#0a0a0a;color:#f5f5f5;font-family:Inter,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:28px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111111;border:2px solid rgba(255,226,138,0.45);">
            <tr>
              <td style="padding:22px 24px 18px;border-bottom:1px solid rgba(255,255,255,0.12);">
                <p style="margin:0;font-size:20px;letter-spacing:0.18em;color:#f5f5f5;">¡D$P!</p>
                <p style="margin:4px 0 0;font-size:9px;letter-spacing:0.34em;text-transform:uppercase;color:#FFE28A;">Dinero Sobre Problemas</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <h1 style="margin:0 0 14px;font-size:18px;letter-spacing:0.06em;color:#FFE28A;text-transform:uppercase;">${title}</h1>
                ${body}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;border-top:1px solid rgba(255,255,255,0.12);font-size:11px;line-height:1.6;color:rgba(255,255,255,0.55);">
                ${footer}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

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
  const { apiKey, from, contactEmail } = resendConfig();

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
        // Las respuestas las atiende una persona, no el remitente técnico.
        reply_to: contactEmail,
        subject: `Confirmación de pedido #${orderNumber}`,
        html: emailShell(
          `Pedido #${orderNumber}`,
          `<p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.85);">
             ¡Gracias por tu compra, ${customerName}!
           </p>
           <p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.85);">
             Tu pedido <strong style="color:#ffffff;">#${orderNumber}</strong> quedó confirmado.
           </p>
           <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.85);">
             Total pagado: <strong style="color:#FFE28A;">${total}</strong>
           </p>
           <p style="margin:0 0 18px;font-size:13px;line-height:1.6;color:rgba(255,255,255,0.6);">
             Te avisamos en cuanto tu pieza entre a producción y de nuevo cuando salga a camino.
           </p>
           <p style="margin:0;">
             <a href="${SITE}/cuenta#pedidos" style="display:inline-block;padding:12px 22px;background:#FFE28A;color:#0a0a0a;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;text-decoration:none;font-weight:700;">
               Ver mi pedido
             </a>
           </p>`
        ),
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

/**
 * Recordatorio de carrito / checkout abandonado.
 *
 * Se programa al abrir Stripe y se cancela si el pago se aprueba. El retraso
 * sale de `CART_REMINDER_DELAY_SECONDS` (3600 por defecto; en pruebas, 10).
 */
export async function sendCartReminder({
  to,
  orderNumber,
  total,
  lang = 'es',
}: {
  to: string;
  orderNumber: string | null;
  total: string;
  lang?: 'es' | 'en';
}) {
  const { apiKey, from, contactEmail } = resendConfig();

  if (!apiKey) {
    console.warn('[resend] RESEND_API_KEY no configurado; no se envía el recordatorio.');
    return { ok: false, reason: 'no_key' };
  }

  const es = lang !== 'en';
  const title = es ? 'Tu carrito sigue aquí' : 'Your cart is still here';
  const subject = es ? '¿Terminamos tu pedido? · ¡D$P!' : 'Shall we finish your order? · ¡D$P!';

  const body = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.85);">
      ${es ? 'Vimos que dejaste tu pedido a medias. No te lo guardamos para siempre, pero sigue disponible por ahora.' : 'You left your order half done. We cannot hold it forever, but it is still available for now.'}
    </p>
    ${
      orderNumber
        ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.85);">
             ${es ? 'Pedido' : 'Order'} <strong style="color:#ffffff;">#${orderNumber}</strong> · <strong style="color:#FFE28A;">${total}</strong>
           </p>`
        : ''
    }
    <p style="margin:0 0 18px;font-size:13px;line-height:1.6;color:rgba(255,255,255,0.6);">
      ${es ? 'Si ya terminaste, ignora este correo. Si tienes dudas, respóndelo y te contesta una persona.' : 'If you already checked out, ignore this email. If you have questions, reply and a person will answer.'}
    </p>
    <p style="margin:0;">
      <a href="${SITE}/carrito" style="display:inline-block;padding:12px 22px;background:#FFE28A;color:#0a0a0a;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;text-decoration:none;font-weight:700;">
        ${es ? 'Volver al carrito' : 'Back to cart'}
      </a>
    </p>`;

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
        reply_to: contactEmail,
        subject,
        html: emailShell(title, body, lang),
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[resend] recordatorio:', res.status, err);
      return { ok: false, reason: 'resend_error', status: res.status };
    }

    console.info('[resend] recordatorio de carrito enviado a', to);
    return { ok: true };
  } catch (e: any) {
    console.error('[resend] recordatorio exception:', e?.message);
    return { ok: false, reason: 'exception' };
  }
}
