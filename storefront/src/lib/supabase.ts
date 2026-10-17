/**
 * Supabase Client para el storefront (Astro)
 * Consultas directas al catálogo: productos, variantes, categorías, imágenes
 */

import { createClient } from '@supabase/supabase-js';

// La anon key es pública por diseño (viaja al navegador); RLS protege los datos.
// Se usan env vars si existen, con fallback al proyecto de producción.
const FALLBACK_URL = 'https://dzrxwmyxxhjonhbfgfvo.supabase.co';
const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6cnh3bXl4eGhqb25oYmZnZnZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3NTI5MTQsImV4cCI6MjEwNzMyODkxNH0.U4Nuekvw7JcM4xx39OHKxIjReyM7_4xrs0iDURu--lY';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || FALLBACK_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

/** Slug del tenant actual (multi-tenant: cambiar por subdominio en el futuro) */
export const TENANT_SLUG = 'dinerosobreproblemas';

/** UUID del tenant de producción (fallback si la resolución falla) */
const FALLBACK_TENANT_ID = '11111111-1111-1111-1111-111111111111';

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

  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .eq('is_deleted', false)
      .maybeSingle();

    if (!error && data?.id) {
      cachedTenantId = data.id;
      return data.id;
    }

    console.error('[supabase] No se pudo resolver el tenant:', slug, error);
  } catch (err) {
    console.error('[supabase] Error resolviendo tenant:', err);
  }

  // Fallback: tenant principal del proyecto (MVP single-tenant)
  cachedTenantId = FALLBACK_TENANT_ID;
  return cachedTenantId;
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
