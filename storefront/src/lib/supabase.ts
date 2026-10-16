/**
 * Supabase Client for WildForgeLabs Storefront
 * Configuración para consultas directas al catálogo
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper para obtener productos con variantes
export async function getProducts(tenantId: string, options: {
  page?: number;
  limit?: number;
  categoryId?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
} = {}) {
  const { page = 1, limit = 20, categoryId, search, minPrice, maxPrice } = options;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('products')
    .select(`
      *,
      product_variants (*),
      categories (*)
    `, { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .eq('is_deleted', false)
    .range(from, to)
    .order('created_at', { ascending: false });

  if (categoryId) {
    query = query.eq('categories.id', categoryId);
  }

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  if (minPrice) {
    query = query.gte('base_price', minPrice);
  }

  if (maxPrice) {
    query = query.lte('base_price', maxPrice);
  }

  return query;
}

// Helper para obtener un producto por slug
export async function getProductBySlug(tenantId: string, slug: string) {
  return supabase
    .from('products')
    .select(`
      *,
      product_variants (*),
      categories (*)
    `)
    .eq('tenant_id', tenantId)
    .eq('slug', slug)
    .eq('is_active', true)
    .eq('is_deleted', false)
    .single();
}

// Helper para obtener categorías
export async function getCategories(tenantId: string) {
  return supabase
    .from('categories')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_deleted', false)
    .order('name');
}

// Helper para obtener stock disponible
export async function getAvailableStock(productVariantId: string) {
  const { data, error } = await supabase
    .from('product_variants')
    .select('stock')
    .eq('id', productVariantId)
    .single();

  return { stock: data?.stock || 0, error };
}