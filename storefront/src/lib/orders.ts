/**
 * Pedidos: creación desde el checkout, lectura para el cliente y
 * seguimiento desde el panel de administración.
 *
 * Sin stock: todo se produce bajo pedido, así que nunca se descuenta
 * inventario y cada orden entra al flujo de diseño → producción.
 */

import { supabase } from './supabase';
import { TENANT_ID } from './constants';
import { getUser } from './auth';
import { clearCart, formatMXN } from './cart';

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

export const STATUS_HINT: Record<OrderStatus, string> = {
  pending: 'Esperando confirmación del pago simulado.',
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
  simulated: 'Tarjeta (simulado)',
  stripe: 'Stripe',
  transfer: 'Transferencia',
  cash: 'Contra entrega',
};

export const FREE_SHIPPING_THRESHOLD = 1500;
export const STANDARD_SHIPPING = 150;

export function shippingCostFor(subtotal: number) {
  return subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : STANDARD_SHIPPING;
}

export interface CheckoutItem {
  variantId: string;
  productId: string;
  name: string;
  variantName: string;
  price: number;
  qty: number;
  image?: string;
  size?: string | null;
  color?: string | null;
}

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

/**
 * Tarjeta simulada: acepta cualquier número con 16 dígitos,
 * menos el 4000 0000 0000 0002 que se usa para probar el rechazo.
 */
export function validateSimulatedCard(card: {
  number: string;
  name: string;
  expiry: string;
  cvv: string;
}) {
  const digits = card.number.replace(/\D/g, '');
  const expiry = card.expiry.trim();
  const cvv = card.cvv.replace(/\D/g, '');

  if (digits.length !== 16) return { ok: false as const, error: 'El número debe tener 16 dígitos.' };
  if (digits === '4000000000000002')
    return { ok: false as const, error: 'Tarjeta rechazada (prueba de pago fallido).' };
  if (!card.name.trim()) return { ok: false as const, error: 'Escribe el nombre en la tarjeta.' };
  if (!/^\d{2}\s*\/\s*\d{2}$/.test(expiry))
    return { ok: false as const, error: 'Vigencia con formato MM/AA.' };
  if (cvv.length < 3) return { ok: false as const, error: 'CVV de 3 o 4 dígitos.' };

  return { ok: true as const };
}

/** Crea el pedido + items y registra el pago simulado */
export async function createOrder(
  items: CheckoutItem[],
  customer: CheckoutCustomer,
  payment: { method: string; approved: boolean }
): Promise<CreatedOrder> {
  if (items.length === 0) throw new Error('El carrito está vacío.');

  const user = await getUser();
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const shipping = shippingCostFor(subtotal);
  const total = subtotal + shipping;

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      tenant_id: TENANT_ID,
      user_id: user?.id ?? null,
      status: payment.approved ? 'confirmed' : 'pending',
      payment_status: payment.approved ? 'approved' : 'pending',
      payment_method: payment.method,
      subtotal,
      shipping_cost: shipping,
      total_amount: total,
      shipping_method: shipping === 0 ? 'free' : 'standard',
      contact_name: `${customer.firstName} ${customer.lastName}`.trim(),
      contact_email: customer.email,
      contact_phone: customer.phone,
      shipping_street: customer.street,
      shipping_colonia: customer.colonia,
      shipping_city: customer.city,
      shipping_state: customer.state,
      shipping_postal_code: customer.postalCode,
      shipping_references: customer.references ?? null,
      notes: customer.notes ?? null,
    })
    .select('id, order_number, total_amount')
    .single();

  if (error || !order) throw new Error(error?.message ?? 'No se pudo crear el pedido.');

  const rows = items.map((i) => ({
    order_id: order.id,
    product_variant_id: i.variantId,
    product_id: i.productId,
    product_name: i.name,
    variant_name: i.variantName,
    size: i.size ?? null,
    color: i.color ?? null,
    image_url: i.image ?? null,
    quantity: i.qty,
    unit_price: i.price,
  }));

  const { error: itemsError } = await supabase.from('order_items').insert(rows);
  if (itemsError) throw new Error(itemsError.message);

  await supabase.from('payments').insert({
    tenant_id: TENANT_ID,
    order_id: order.id,
    amount: total,
    provider: 'simulated',
    provider_transaction_id: `SIM-${Date.now()}`,
    status: payment.approved ? 'completed' : 'failed',
  });

  clearCart();

  return {
    id: order.id,
    order_number: order.order_number,
    total_amount: Number(order.total_amount),
  };
}

/** Pedidos del cliente con sus items */
export async function getMyOrders() {
  const user = await getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('user_id', user.id)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  return data ?? [];
}

/** Un pedido por id (para /confirmacion y /pedido/[id]) */
export async function getOrderById(id: string, opts: { admin?: boolean } = {}) {
  const query = supabase.from('orders').select('*, order_items(*)').eq('id', id);

  if (!opts.admin) {
    const user = await getUser();
    if (!user) return null;
    query.eq('user_id', user.id);
  }

  const { data } = await query.maybeSingle();
  return data;
}

/** Seguimiento: historial de estados de un pedido */
export async function getOrderHistory(orderId: string) {
  const { data } = await supabase
    .from('order_status_history')
    .select('status, notes, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  return data ?? [];
}

export function formatOrderMoney(n: number) {
  return `$${formatMXN(Number(n))}`;
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
