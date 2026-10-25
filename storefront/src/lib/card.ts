/**
 * Utilidades de tarjeta (solo para formato en el navegador).
 *
 * El cobro ya **no** se valida aquí: la tarjeta se captura en Stripe
 * (Checkout alojado) y su validación la hace el propio Stripe contra el
 * emisor. Este módulo solo conserva `passesLuhn` por si hace falta revisar
 * un número pegado a mano en otro contexto.
 */

/** Algoritmo de Luhn: detecta dígitos mal tecleados. */
export function passesLuhn(digits: string) {
  let sum = 0;
  let double = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return false;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }

  return digits.length > 0 && sum % 10 === 0;
}
