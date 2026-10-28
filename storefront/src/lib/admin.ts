/**
 * Operaciones del panel de administración.
 * Todas las escrituras pasan por RLS: solo `admin` o `seller`.
 */

import { supabase } from './supabase';

export interface AdminProduct {
  id: string;
  name: string;
  /** Nombre en inglés (vacío = se usa el español). */
  name_en?: string | null;
  slug: string | null;
  description: string | null;
  /** Descripción en inglés (vacía = se usa la española). */
  description_en?: string | null;
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
    /** Nombre en inglés (vacío = se usa el español). */
    name_en?: string;
    description: string;
    /** Descripción en inglés (vacía = se usa la española). */
    description_en?: string;
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
      name_en: input.name_en?.trim() || null,
      slug,
      description: input.description || null,
      description_en: input.description_en?.trim() || null,
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
    name_en?: string | null;
    description?: string | null;
    description_en?: string | null;
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

/** Detalle completo de un producto para el editor. */
export async function getProduct(id: string): Promise<AdminProduct | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*, product_variants(*), product_images(*), categories(id, name)')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  // Imágenes ordenadas por posición (portada primero)
  data.product_images = [...(data.product_images ?? [])].sort(
    (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)
  );

  return data as AdminProduct;
}

/** Variante: nombre, talla, color, precio y stock. */
export async function updateVariant(
  variantId: string,
  patch: { name?: string; size?: string | null; color?: string | null; price?: number; stock?: number }
) {
  const { error } = await supabase.from('product_variants').update(patch).eq('id', variantId);
  if (error) throw new Error(error.message);
}

/** Agrega una variante (nueva talla o color) al producto. */
export async function createVariant(input: {
  productId: string;
  name: string;
  size: string | null;
  color: string | null;
  price: number;
  stock: number;
}) {
  const { error } = await supabase.from('product_variants').insert({
    product_id: input.productId,
    name: input.name,
    size: input.size,
    color: input.color,
    price: input.price,
    stock: input.stock,
  });

  if (error) throw new Error(error.message);
}

/** Elimina una variante. */
export async function deleteVariant(variantId: string) {
  const { error } = await supabase.from('product_variants').delete().eq('id', variantId);
  if (error) throw new Error(error.message);
}

/** Adjunta una imagen ya subida al producto. */
export async function addProductImage(input: {
  productId: string;
  url: string;
  alt?: string | null;
  position?: number;
}) {
  const { error } = await supabase.from('product_images').insert({
    product_id: input.productId,
    url: input.url,
    alt_text: input.alt ?? null,
    position: input.position ?? 0,
  });

  if (error) throw new Error(error.message);
}

export async function deleteProductImage(imageId: string) {
  const { error } = await supabase.from('product_images').delete().eq('id', imageId);
  if (error) throw new Error(error.message);
}

/** Reordena la galería: el índice del arreglo pasa a ser la posición. */
export async function reorderProductImages(orderedIds: string[]) {
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from('product_images')
      .update({ position: i })
      .eq('id', orderedIds[i]);

    if (error) throw new Error(error.message);
  }
}

/**
 * Sube una imagen al bucket público y devuelve la URL.
 */
export async function uploadProductImage(file: File, slugHint: string): Promise<string> {
  const allowed = ['jpg', 'jpeg', 'png', 'webp', 'avif'];
  const rawExt = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  const ext = allowed.includes(rawExt) ? rawExt : 'jpg';

  if (!file.type.startsWith('image/')) throw new Error('El archivo debe ser una imagen.');
  if (file.size > 8 * 1024 * 1024) throw new Error('La imagen no puede pasar de 8 MB.');

  // slugHint puede venir del nombre del producto: se limpia antes de tocar
  // la ruta del bucket (nada de '/', '..' ni caracteres de control).
  const safeSlug = (slugHint || 'pieza')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '') || 'pieza';

  const path = `${safeSlug.slice(0, 60)}-${Date.now()}.${ext}`;

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
  const paid = orders.filter((o: { status: string }) =>
    ['confirmed', 'design', 'preparing', 'ready', 'shipped', 'delivered'].includes(o.status)
  );

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const monthRevenue = paid
    .filter((o: { created_at: string }) => new Date(o.created_at) >= startOfMonth)
    .reduce((sum: number, o: { total_amount: number }) => sum + Number(o.total_amount), 0);

  return {
    totalOrders: orders.length,
    pendingOrders: orders.filter((o: { status: string }) => o.status === 'pending').length,
    inProduction: orders.filter((o: { status: string }) => ['confirmed', 'design', 'preparing'].includes(o.status)).length,
    readyOrders: orders.filter((o: { status: string }) => o.status === 'ready').length,
    monthRevenue,
    totalRevenue: paid.reduce((sum: number, o: { total_amount: number }) => sum + Number(o.total_amount), 0),
    products: productsRes.data?.length ?? 0,
    activeProducts: productsRes.data?.filter((p: { is_active: boolean }) => p.is_active).length ?? 0,
    customers: customersRes.data?.length ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Mensajes de contacto
// ---------------------------------------------------------------------------

export type ContactStatus = 'new' | 'read' | 'replied' | 'archived';

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  lang: string;
  status: ContactStatus;
  user_agent: string | null;
  created_at: string;
}

/** Etiquetas del estado, alineadas con el CHECK de la tabla. */
export const CONTACT_STATUS_LABEL: Record<ContactStatus, string> = {
  new: 'Nuevo',
  read: 'Leído',
  replied: 'Respondido',
  archived: 'Archivado',
};

/**
 * Bandeja de mensajes del formulario de contacto.
 *
 * `status` filtra por estado; `search` busca en nombre, correo, asunto y
 * cuerpo. La lectura la permite RLS solo a `admin` y `seller`.
 */
export async function listContactMessages(
  tenantId: string,
  options: { status?: ContactStatus | 'all'; search?: string; limit?: number } = {}
): Promise<ContactMessage[]> {
  const { status = 'all', search = '', limit = 100 } = options;

  let query = supabase
    .from('contact_messages')
    .select('id, name, email, subject, message, lang, status, user_agent, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status !== 'all') query = query.eq('status', status);

  // Se escapan las comas: rompen el filtro `or()` de PostgREST.
  const term = search.trim().replace(/[%,()]/g, ' ').trim();
  if (term) {
    query = query.or(
      `name.ilike.%${term}%,email.ilike.%${term}%,subject.ilike.%${term}%,message.ilike.%${term}%`
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ContactMessage[];
}

/** Cuántos mensajes sin leer hay (para el badge del panel). */
export async function countNewContactMessages(tenantId: string): Promise<number> {
  const { count, error } = await supabase
    .from('contact_messages')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'new');

  if (error) return 0;
  return count ?? 0;
}

/** Cambia el estado de un mensaje (leído, respondido, archivado). */
export async function updateContactStatus(id: string, status: ContactStatus) {
  const { error } = await supabase.from('contact_messages').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
}

/** Borra un mensaje. Solo staff, por RLS. */
export async function deleteContactMessage(id: string) {
  const { error } = await supabase.from('contact_messages').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
