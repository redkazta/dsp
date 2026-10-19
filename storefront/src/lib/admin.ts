/**
 * Operaciones del panel de administración.
 * Todas las escrituras pasan por RLS: solo `admin` o `seller`.
 */

import { supabase } from './supabase';

export interface AdminProduct {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  base_price: number;
  cost: number;
  sku: string | null;
  is_active: boolean;
  category_id: string | null;
  created_at: string;
  product_variants?: Array<{
    id: string;
    name: string;
    size: string | null;
    color: string | null;
    price: number;
    stock: number;
  }>;
  product_images?: Array<{ id: string; url: string; position: number }>;
  categories?: { id: string; name: string } | null;
}

export async function isAdmin(): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return false;

  const { data } = await supabase
    .from('customer_profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle();

  return data?.role === 'admin' || data?.role === 'seller';
}

/**
 * Lista todos los productos (incluye inactivos) para el panel.
 */
export async function listAllProducts(tenantId: string): Promise<AdminProduct[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*, product_variants(*), product_images(*), categories(id, name)')
    .eq('tenant_id', tenantId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getCategories(tenantId: string) {
  const { data } = await supabase
    .from('categories')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('is_deleted', false)
    .order('name');

  return data ?? [];
}

/**
 * Crea un producto con una variante por talla y una imagen.
 */
export async function createProduct(
  tenantId: string,
  input: {
    name: string;
    description: string;
    price: number;
    categoryId: string | null;
    sizes: string[]; // ['S','M','L']
    stockPerSize: number;
    color: string;
    imageUrl: string | null;
  }
) {
  const slug = input.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const { data: product, error } = await supabase
    .from('products')
    .insert({
      tenant_id: tenantId,
      name: input.name,
      slug,
      description: input.description || null,
      base_price: input.price,
      category_id: input.categoryId,
      sku: `DSP-${Date.now().toString().slice(-6)}`,
      is_active: true,
    })
    .select()
    .single();

  if (error || !product) throw new Error(error?.message ?? 'No se pudo crear el producto');

  const variants = input.sizes.map((size) => ({
    product_id: product.id,
    name: `${size} · ${input.color}`,
    size,
    color: input.color,
    price: input.price,
    stock: input.stockPerSize,
  }));

  if (variants.length > 0) {
    const { error: vErr } = await supabase.from('product_variants').insert(variants);
    if (vErr) throw new Error(vErr.message);
  }

  if (input.imageUrl) {
    await supabase.from('product_images').insert({
      product_id: product.id,
      url: input.imageUrl,
      alt_text: input.name,
      position: 0,
    });
  }

  return product;
}

export async function updateProduct(
  id: string,
  patch: {
    name?: string;
    description?: string | null;
    base_price?: number;
    category_id?: string | null;
    is_active?: boolean;
  }
) {
  const { error } = await supabase.from('products').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function updateVariantStock(variantId: string, stock: number) {
  const { error } = await supabase
    .from('product_variants')
    .update({ stock })
    .eq('id', variantId);

  if (error) throw new Error(error.message);
}

export async function softDeleteProduct(id: string) {
  const { error } = await supabase
    .from('products')
    .update({ is_deleted: true, deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

/**
 * Sube una imagen al bucket público y devuelve la URL.
 */
export async function uploadProductImage(file: File, slugHint: string): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${slugHint}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, file, { cacheControl: '3600', upsert: false });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Pedidos (todos, para el panel) con items e historial.
 */
export async function listOrders(tenantId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*), order_status_history(status, notes, created_at)')
    .eq('tenant_id', tenantId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Cambia el estado registrando el cambio en el historial.
 * El trigger de Postgres también deja rastro por si se cambia desde SQL.
 */
export async function updateOrderStatus(
  orderId: string,
  status: string,
  extra: { trackingNumber?: string; carrier?: string; notes?: string } = {}
) {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };

  if (extra.trackingNumber !== undefined) patch.tracking_number = extra.trackingNumber || null;
  if (extra.carrier !== undefined) patch.carrier = extra.carrier || null;

  const { error } = await supabase.from('orders').update(patch).eq('id', orderId);
  if (error) throw new Error(error.message);

  await supabase.from('order_status_history').insert({
    order_id: orderId,
    status,
    notes: extra.notes ?? null,
  });
}

/** Notas internas del pedido (solo staff) */
export async function saveOrderNotes(orderId: string, adminNotes: string) {
  const { error } = await supabase
    .from('orders')
    .update({ admin_notes: adminNotes, updated_at: new Date().toISOString() })
    .eq('id', orderId);

  if (error) throw new Error(error.message);
}

/**
 * Métricas para el dashboard.
 */
export async function getDashboardStats(tenantId: string) {
  const [ordersRes, productsRes, customersRes] = await Promise.all([
    supabase
      .from('orders')
      .select('total_amount, status, created_at')
      .eq('tenant_id', tenantId)
      .eq('is_deleted', false),
    supabase
      .from('products')
      .select('id, is_active')
      .eq('tenant_id', tenantId)
      .eq('is_deleted', false),
    supabase
      .from('customer_profiles')
      .select('id')
      .eq('tenant_id', tenantId),
  ]);

  const orders = ordersRes.data ?? [];
  const paid = orders.filter((o) =>
    ['confirmed', 'design', 'preparing', 'ready', 'shipped', 'delivered'].includes(o.status)
  );

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const monthRevenue = paid
    .filter((o) => new Date(o.created_at) >= startOfMonth)
    .reduce((sum, o) => sum + Number(o.total_amount), 0);

  return {
    totalOrders: orders.length,
    pendingOrders: orders.filter((o) => o.status === 'pending').length,
    inProduction: orders.filter((o) => ['confirmed', 'design', 'preparing'].includes(o.status)).length,
    readyOrders: orders.filter((o) => o.status === 'ready').length,
    monthRevenue,
    totalRevenue: paid.reduce((sum, o) => sum + Number(o.total_amount), 0),
    products: productsRes.data?.length ?? 0,
    activeProducts: productsRes.data?.filter((p) => p.is_active).length ?? 0,
    customers: customersRes.data?.length ?? 0,
  };
}
