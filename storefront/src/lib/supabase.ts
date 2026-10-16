/**
 * Supabase Client para el storefront (Astro)
 * Consultas directas al catálogo: productos, variantes, categorías
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

export interface GetProductsOptions {
  page?: number;
  limit?: number;
  categoryId?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
}

/**
 * Productos activos del tenant, con variantes y categoría.
 */
export async function getProducts(tenantId: string, options: GetProductsOptions = {}) {
  const { page = 1, limit = 20, categoryId, search, minPrice, maxPrice } = options;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('products')
    .select('*, product_variants(*), categories(*)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .eq('is_deleted', false)
    .range(from, to)
    .order('created_at', { ascending: false });

  if (categoryId) query = query.eq('categories.id', categoryId);
  if (search) query = query.ilike('name', `%${search}%`);
  if (minPrice != null) query = query.gte('base_price', minPrice);
  if (maxPrice != null) query = query.lte('base_price', maxPrice);

  return query;
}

/**
 * Un producto por ID, con variantes y categoría.
 */
export async function getProductById(tenantId: string, id: string) {
  return supabase
    .from('products')
    .select('*, product_variants(*), categories(*)')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .eq('is_deleted', false)
    .single();
}

/**
 * Categorías del tenant.
 */
export async function getCategories(tenantId: string) {
  return supabase
    .from('categories')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_deleted', false)
    .order('name');
}
