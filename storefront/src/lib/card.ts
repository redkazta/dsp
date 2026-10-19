/**
 * Tarjeta simulada (modo prueba).
 *
 * - 4000 0000 0000 0002 → rechazo (para probar el flujo fallido)
 * - Cualquier otra tarjeta de 16 dígitos con Luhn válido → aprobada
 *
 * Se usa en cliente (feedback inmediato) y en servidor (autoridad),
 * por eso no importa nada del navegador.
 */

export interface CardInput {
  number: string;
  name: string;
  expiry: string;
  cvv: string;
}

export type CardValidation = { ok: true } | { ok: false; error: string };

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

function isExpired(expiry: string) {
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(expiry.trim());
  if (!m) return false;

  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return true;

  const now = new Date();
  // Válida hasta el último día del mes indicado
  return year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
}

export function validateSimulatedCard(card: CardInput): CardValidation {
  const digits = (card.number ?? '').replace(/\D/g, '');
  const cvv = (card.cvv ?? '').replace(/\D/g, '');
  const expiry = (card.expiry ?? '').trim();

  if (digits.length !== 16) return { ok: false, error: 'El número debe tener 16 dígitos.' };
  if (digits === '4000000000000002')
    return { ok: false, error: 'Tarjeta rechazada (prueba de pago fallido).' };
  if (!passesLuhn(digits)) return { ok: false, error: 'Revisa el número de tarjeta.' };
  if (!(card.name ?? '').trim()) return { ok: false, error: 'Escribe el nombre en la tarjeta.' };
  if (!/^\d{2}\s*\/\s*\d{2}$/.test(expiry))
    return { ok: false, error: 'Vigencia con formato MM/AA.' };
  if (isExpired(expiry)) return { ok: false, error: 'La tarjeta está vencida.' };
  if (cvv.length < 3 || cvv.length > 4) return { ok: false, error: 'CVV de 3 o 4 dígitos.' };

  return { ok: true };
}
