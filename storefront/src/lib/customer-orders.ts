/**
 * Lectura de pedidos del cliente desde el servidor (SSR).
 *
 * El HTML ya trae los pedidos: nada de "Cargando…" sobre una página vacía
 * y el `order_number` es legible por URL (`DSP-001042`).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface CustomerOrderItem {
  id?: string;
  product_slug?: string | null;
  product_name: string | null;
  variant_name: string | null;
  size: string | null;
  color: string | null;
  image_url: string | null;
  quantity: number;
  unit_price: number;
}

export interface CustomerOrder {
  id: string;
  order_number: string | null;
  status: string;
  payment_status: string | null;
  payment_method: string | null;
  subtotal: number;
  shipping_cost: number;
  total_amount: number;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  shipping_street: string | null;
  shipping_colonia: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_postal_code: string | null;
  shipping_references: string | null;
  tracking_number: string | null;
  carrier: string | null;
  notes: string | null;
  created_at: string;
  order_items: CustomerOrderItem[];
  order_status_history: Array<{ status: string; notes: string | null; created_at: string }>;
}

const SELECT =
  'id, order_number, status, payment_status, payment_method, subtotal, shipping_cost, total_amount, contact_name, contact_email, contact_phone, shipping_street, shipping_colonia, shipping_city, shipping_state, shipping_postal_code, shipping_references, tracking_number, carrier, notes, created_at, order_items(*), order_status_history(status, notes, created_at)';

const STATUS_ORDER: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  design: 2,
  preparing: 3,
  ready: 4,
  shipped: 5,
  delivered: 6,
};

function sortHistory(order: any): CustomerOrder {
  const history = [...(order.order_status_history ?? [])].sort(
    (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  return { ...order, order_status_history: history } as CustomerOrder;
}

export async function listCustomerOrders(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('orders')
    .select(SELECT)
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(50);

  return (data ?? []).map(sortHistory);
}

/** Un pedido por UUID o por folio (`DSP-001042`), siempre del dueño. */
export async function getCustomerOrder(
  supabase: SupabaseClient,
  userId: string,
  idOrNumber: string
) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrNumber);

  const { data } = await supabase
    .from('orders')
    .select(SELECT)
    .eq('user_id', userId)
    .eq(isUuid ? 'id' : 'order_number', idOrNumber)
    .eq('is_deleted', false)
    .maybeSingle();

  return data ? sortHistory(data) : null;
}

/** Estado "real" para la barra de progreso (los cerrados se muestran aparte). */
export function progressIndex(status: string) {
  return STATUS_ORDER[status] ?? -1;
}
