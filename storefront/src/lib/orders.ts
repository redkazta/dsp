/**
 * Pedidos: tipos del flujo de producción bajo pedido.
 *
 * La creación vive en el servidor (`lib/checkout.ts` → Stripe) y la lectura
 * para el cliente en `lib/customer-orders.ts` (Supabase SSR).
 *
 * Sin stock: todo se produce bajo pedido, así que nunca se descuenta
 * inventario y cada orden entra al flujo de diseño → producción.
 */

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'design'
  | 'preparing'
  | 'ready'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned';

/** Flujo principal de producción bajo pedido */
export const STATUS_FLOW: OrderStatus[] = [
  'pending',
  'confirmed',
  'design',
  'preparing',
  'ready',
  'shipped',
  'delivered',
];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pago pendiente',
  confirmed: 'Pago confirmado',
  design: 'En diseño',
  preparing: 'En producción',
  ready: 'Listo para enviar',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
  returned: 'Devuelto',
};

/** Mismas claves, en inglés (la usan las pantallas del cliente). */
export const STATUS_LABEL_EN: Record<OrderStatus, string> = {
  pending: 'Payment pending',
  confirmed: 'Payment confirmed',
  design: 'In design',
  preparing: 'In production',
  ready: 'Ready to ship',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
};

export const STATUS_HINT_EN: Record<OrderStatus, string> = {
  pending: 'Waiting for Stripe to confirm the payment.',
  confirmed: 'Payment approved. We have it.',
  design: 'We review the design of your piece with you.',
  preparing: 'Pressed and sewn by hand.',
  ready: 'Finished and packed, ready for the courier.',
  shipped: 'On the way. Check your tracking number.',
  delivered: 'Delivered. Thanks for trusting us.',
  cancelled: 'The order was not produced.',
  returned: 'The piece was returned.',
};

/** Elige el diccionario de estatus según el idioma. */
export function orderLabels(lang: 'es' | 'en') {
  return lang === 'en'
    ? { status: STATUS_LABEL_EN, hint: STATUS_HINT_EN }
    : { status: STATUS_LABEL, hint: STATUS_HINT };
}

export const STATUS_HINT: Record<OrderStatus, string> = {
  pending: 'Esperando la confirmación del pago en Stripe.',
  confirmed: 'Pago aprobado. Ya lo tenemos.',
  design: 'Revisamos contigo el diseño de la pieza.',
  preparing: 'Se prensa y confecciona a mano.',
  ready: 'Terminado y empacado, listo para paquetería.',
  shipped: 'En camino. Consulta tu número de guía.',
  delivered: 'Entregado. Gracias por la confianza.',
  cancelled: 'El pedido no se fabricó.',
  returned: 'Se devolvió la pieza.',
};

/** Siguientes estados permitidos (para el admin) */
export const NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['design', 'cancelled'],
  design: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  failed: 'Rechazado',
  refunded: 'Reembolsado',
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  stripe: 'Stripe',
  simulated: 'Tarjeta (simulado, obsoleto)',
  transfer: 'Transferencia',
  cash: 'Contra entrega',
};

export interface CheckoutCustomer {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  colonia: string;
  city: string;
  state: string;
  postalCode: string;
  references?: string;
  notes?: string;
}
export interface CreatedOrder {
  id: string;
  order_number: string | null;
  total_amount: number;
}
/** Rastreo: enlace según paquetería (si no reconocemos, búsqueda en Google). */
export function trackingUrl(carrier: string | null | undefined, trackingNumber: string) {
  const n = encodeURIComponent(trackingNumber);
  const c = (carrier ?? '').toLowerCase();

  if (c.includes('dhl')) return `https://www.dhl.com/mx-es/home/tracking.html?tracking-id=${n}`;
  if (c.includes('fedex')) return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
  if (c.includes('estafeta')) return `https://www.estafeta.com/Herramientas/Rastreo?wayBill=${n}`;
  if (c.includes('ups')) return `https://www.ups.com/track?tracknum=${n}`;

  return `https://www.google.com/search?q=${encodeURIComponent(`${carrier ?? ''} ${trackingNumber}`.trim())}`;
}

export function formatOrderMoney(n: number) {
  return `$${Number(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatOrderDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatOrderDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
