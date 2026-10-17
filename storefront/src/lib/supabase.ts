/**
 * Supabase Client para el storefront (Astro)
 * Consultas directas al catálogo: productos, variantes, categorías, imágenes
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[supabase] Faltan PUBLIC_SUPABASE_URL o PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-key'
);

/** Slug del tenant actual (multi-tenant: cambiar por subdominio en el futuro) */
export const TENANT_SLUG = 'dinerosobreproblemas';

// Cache en memoria del UUID del tenant (se resuelve una vez por proceso)
let cachedTenantId: string | null = null;

/**
 * Resuelve el UUID del tenant a partir de su slug.
 * La tabla `products` usa tenant_id (UUID), no el slug.
 */
export async function getTenantId(slug: string = TENANT_SLUG): Promise<string | null> {
  if (cachedTenantId) return cachedTenantId;

  // Si ya parece un UUID, úsalo directo
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)) {
    cachedTenantId = slug;
    return slug;
  }

  const { data, error } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .eq('is_deleted', false)
    .maybeSingle();

  if (error || !data) {
    console.error('[supabase] No se pudo resolver el tenant:', slug, error);
    return null;
  }

  cachedTenantId = data.id;
  return data.id;
}

export interface GetProductsOptions {
  page?: number;
  limit?: number;
  categoryId?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'newest' | 'price-asc' | 'price-desc' | 'name-asc';
}

export interface ProductsResult {
  data: any[] | null;
  count: number;
  error: unknown;
}

/**
 * Productos activos del tenant, con variantes, categoría e imágenes.
 */
export async function getProducts(
  tenantSlug: string,
  options: GetProductsOptions = {}
): Promise<ProductsResult> {
  const {
    page = 1,
    limit = 20,
    categoryId,
    search,
    minPrice,
    maxPrice,
    sort = 'newest',
  } = options;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const tenantId = await getTenantId(tenantSlug);
  if (!tenantId) return { data: [], count: 0, error: 'tenant-not-found' };

  let filtered = supabase
    .from('products')
    .select('*, product_variants(*), categories(*), product_images(*)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .eq('is_deleted', false);

  if (categoryId) filtered = filtered.eq('category_id', categoryId);
  if (search) filtered = filtered.ilike('name', `%${search}%`);
  if (minPrice != null) filtered = filtered.gte('base_price', minPrice);
  if (maxPrice != null) filtered = filtered.lte('base_price', maxPrice);

  const sortMap: Record<string, { column: string; ascending: boolean }> = {
    newest: { column: 'created_at', ascending: false },
    'price-asc': { column: 'base_price', ascending: true },
    'price-desc': { column: 'base_price', ascending: false },
    'name-asc': { column: 'name', ascending: true },
  };
  const { column, ascending } = sortMap[sort] ?? sortMap.newest;

  const { data, count, error } = await filtered
    .order(column, { ascending })
    .range(from, to);

  return { data, count: count ?? 0, error };
}

/**
 * Un producto por ID, con variantes, categoría e imágenes.
 */
export async function getProductById(tenantSlug: string, id: string) {
  const tenantId = await getTenantId(tenantSlug);
  if (!tenantId) return { data: null, error: 'tenant-not-found' };

  return supabase
    .from('products')
    .select('*, product_variants(*), categories(*), product_images(*)')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .eq('is_deleted', false)
    .maybeSingle();
}

/**
 * Categorías del tenant.
 */
export async function getCategories(tenantSlug: string) {
  const tenantId = await getTenantId(tenantSlug);
  if (!tenantId) return { data: [], error: 'tenant-not-found' };

  return supabase
    .from('categories')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_deleted', false)
    .order('name');
}
