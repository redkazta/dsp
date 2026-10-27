/**
 * Resend — confirmaciones de compra con dominio personalizado.
 *
 * Variables de entorno (Vercel):
 *   RESEND_API_KEY  → clave de Resend
 *   RESEND_DOMAIN  → dominio verificado (ej. dinerossobreproblemas.com)
 */

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
  const apiKey = (import.meta.env.RESEND_API_KEY as string | undefined) ?? '';
  const domain = (import.meta.env.RESEND_DOMAIN as string | undefined) ?? 'dinerosobreproblemas.com';

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
