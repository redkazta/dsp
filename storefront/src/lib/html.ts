/**
 * Utilidades seguras para HTML.
 *
 * Las páginas SSR (hoy) usan `innerHTML` para pintar pedidos, wishlist y
 * mensajes del navegador. Todo valor que venga del usuario o de Supabase
 * debe pasar por `escapeHtml` antes de interpolarse.
 */

const MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (ch) => MAP[ch] ?? ch);
}

/** URL de imagen o producto: solo rutas y http(s), nunca `javascript:`. */
export function safeUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  const url = value.trim();

  if (url.startsWith('/')) return escapeHtml(url);
  if (/^https?:\/\//i.test(url)) return escapeHtml(url);
  if (url.startsWith('data:image/')) return escapeHtml(url);
  return '';
}

/** Mensajes de error legibles para el visitante (nunca detalles de Postgres). */
export function friendlyError(
  code: string | null | undefined,
  fallback: string,
  lang: 'es' | 'en' = 'es'
) {
  if (lang === 'en') {
    switch (code) {
      case 'NO_SESSION':
        return 'Sign in or create an account to complete the order.';
      case 'BAD_REQUEST':
        return 'Check your contact and shipping details.';
      case 'AUTH_UNAVAILABLE':
        return "We couldn't validate your session. Try again in a moment.";
      case 'CARD_DECLINED':
        return 'The card was declined. Try another one.';
      case 'PAYMENT_UNAVAILABLE':
        return 'Card payment is not available right now.';
      case 'PAYMENT_ERROR':
        return "We couldn't start the payment. Try again in a moment.";
      case 'UNAVAILABLE':
        return 'An item in your cart is no longer available.';
      case 'STORAGE':
        return "We couldn't save your cart. Try again.";
      default:
        return fallback;
    }
  }

  switch (code) {
    case 'NO_SESSION':
      return 'Inicia sesión o crea tu cuenta para completar el pedido.';
    case 'BAD_REQUEST':
      return 'Revisa los datos de contacto y envío.';
    case 'AUTH_UNAVAILABLE':
      return 'No pudimos validar tu sesión. Intenta de nuevo en un momento.';
    case 'CARD_DECLINED':
      return 'La tarjeta fue rechazada. Prueba con otra.';
    case 'PAYMENT_UNAVAILABLE':
      return 'El pago con tarjeta no está disponible en este momento.';
    case 'PAYMENT_ERROR':
      return 'No pudimos iniciar el pago. Intenta de nuevo en un momento.';
    case 'UNAVAILABLE':
      return 'Una pieza de tu carrito ya no está disponible.';
    case 'STORAGE':
      return 'No pudimos guardar tu carrito. Intenta de nuevo.';
    default:
      return fallback;
  }
}
