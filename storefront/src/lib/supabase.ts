/**
 * Supabase Client para el storefront (Astro)
 *
 * La anon key es PÚBLICA por diseño: viaja al navegador en cualquier app Supabase.
 * La seguridad real la da Row Level Security (RLS) en Postgres, no el secreto de la key.
 * Por eso aquí van constantes: evita fallos por env vars mal configuradas en Vercel.
 *
 * Si quieres apuntar a otro proyecto, define PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dzrxwmyxxhjonhbfgfvo.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6cnh3bXl4eGhqb25oYmZnZnZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3NTI5MTQsImV4cCI6MjEwNzMyODkxNH0.U4Nuekvw7JcM4xx39OHKxIjReyM7_4xrs0iDURu--lY';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

/** Slug del tenant actual (multi-tenant: cambiar por subdominio en el futuro) */
export const TENANT_SLUG = 'dinerosobreproblemas';

/** UUID del tenant de producción (única fuente de verdad para el MVP single-tenant) */
const TENANT_ID = '11111111-1111-1111-1111-111111111111';

// Cache en memoria del UUID del tenant
let cachedTenantId: string | null = null;

/**
 * Resuelve el UUID del tenant a partir de su slug.
 * Los productos usan tenant_id (UUID), no el slug.
 */
export async function getTenantId(slug: string = TENANT_SLUG): Promise<string> {
  if (cachedTenantId) return cachedTenantId;

  // UUID directo
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
  } catch {
    // cae al fallback
  }

  cachedTenantId = TENANT_ID;
  return TENANT_ID;
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
  error: string | null;
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

  try {
    const tenantId = await getTenantId(tenantSlug);

    let query = supabase
      .from('products')
      .select('*, product_variants(*), categories(*), product_images(*)', {
        count: 'exact',
      })
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .eq('is_deleted', false);

    if (categoryId) query = query.eq('category_id', categoryId);
    if (search) query = query.ilike('name', `%${search}%`);
    if (minPrice != null) query = query.gte('base_price', minPrice);
    if (maxPrice != null) query = query.lte('base_price', maxPrice);

    const sortMap: Record<string, { column: string; ascending: boolean }> = {
      newest: { column: 'created_at', ascending: false },
      'price-asc': { column: 'base_price', ascending: true },
      'price-desc': { column: 'base_price', ascending: false },
      'name-asc': { column: 'name', ascending: true },
    };
    const { column, ascending } = sortMap[sort] ?? sortMap.newest;

    const { data, count, error } = await query
      .order(column, { ascending })
      .range(from, to);

    if (error) {
      return { data: [], count: 0, error: `${error.code ?? ''} ${error.message}`.trim() };
    }

    return { data: data ?? [], count: count ?? 0, error: null };
  } catch (err: any) {
    return { data: [], count: 0, error: err?.message ?? String(err) };
  }
}

/**
 * Un producto por ID, con variantes, categoría e imágenes.
 */
export async function getProductById(tenantSlug: string, id: string) {
  try {
    const tenantId = await getTenantId(tenantSlug);

    return await supabase
      .from('products')
      .select('*, product_variants(*), categories(*), product_images(*)')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle();
  } catch (err: any) {
    return { data: null, error: { message: err?.message ?? String(err) } };
  }
}

/**
 * Categorías del tenant.
 */
export async function getCategories(tenantSlug: string) {
  try {
    const tenantId = await getTenantId(tenantSlug);

    return await supabase
      .from('categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_deleted', false)
      .order('name');
  } catch (err: any) {
    return { data: [], error: { message: err?.message ?? String(err) } };
  }
}
