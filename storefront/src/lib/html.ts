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
export function friendlyError(code: string | null | undefined, fallback: string) {
  switch (code) {
    case 'NO_SESSION':
      return 'Inicia sesión o crea tu cuenta para completar el pedido.';
    case 'BAD_REQUEST':
      return 'Revisa los datos de contacto y envío.';
    case 'CARD_DECLINED':
      return 'La tarjeta fue rechazada. Prueba con otra.';
    case 'UNAVAILABLE':
      return 'Una pieza de tu carrito ya no está disponible.';
    case 'STORAGE':
      return 'No pudimos guardar tu carrito. Intenta de nuevo.';
    default:
      return fallback;
  }
}
