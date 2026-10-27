/**
 * Productos de la portada: intercala categorías (playera, jean, playera, jean…)
 * para que el carrusel no muestre dos piezas iguales seguidas.
 *
 * Corre en el servidor (SSR) y usa el cliente del storefront (anon key, RLS
 * público), igual que el resto de lecturas de catálogo.
 */

import { supabase, TENANT_ID } from './supabase';

export interface HomeSlide {
  id: string;
  slug: string;
  name: string;
  price: number;
  category: string | null;
  /** Prenda con detalles reflectivos (`products.is_reflective`). */
  isReflective: boolean;
  /** Todas las fotos de la pieza: la primera es la portada. */
  images: string[];
}

/** Una foto por lista, sin repetir, con la portada primero. */
function imagesOf(product: any): string[] {
  const sorted = [...(product.product_images ?? [])].sort(
    (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)
  );
  return [...new Set(sorted.map((img: any) => img?.url).filter(Boolean))] as string[];
}

/**
 * Toma las piezas activas del tenant, las agrupa por categoría y las va
 * sacando por turnos. Si una categoría se queda sin piezas, las demás siguen.
 */
export async function getHomeSlides(
  options: { perCategory?: number; max?: number } = {}
): Promise<HomeSlide[]> {
  const { perCategory = 8, max = 12 } = options;

  const { data, error } = await supabase
    .from('products')
    .select(
      'id, name, slug, base_price, is_reflective, created_at, categories(id, name), product_variants(price), product_images(url, position)'
    )
    .eq('tenant_id', TENANT_ID)
    .eq('is_active', true)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(120);

  if (error || !data) return [];

  // Normaliza y descarta piezas sin foto (no se pueden mostrar en el hero).
  const products = data
    .map((p: any) => {
      const category = Array.isArray(p.categories) ? p.categories[0] : p.categories;
      const images = imagesOf(p);
      const price = Number(p.product_variants?.[0]?.price ?? p.base_price ?? 0);

      return {
        id: p.id,
        slug: p.slug ?? p.id,
        name: p.name,
        price,
        category: category?.name ?? null,
        isReflective: Boolean(p.is_reflective),
        images,
        categoryId: category?.id ?? '__none__',
      };
    })
    .filter((p: any) => p.images.length > 0);

  // Agrupa conservando el orden (más recientes primero) y el cupo por categoría.
  const buckets = new Map<string, HomeSlide[]>();

  for (const p of products) {
    const bucket = buckets.get(p.categoryId) ?? [];
    if (bucket.length >= perCategory) continue;

    bucket.push({
      id: p.id,
      slug: p.slug,
      name: p.name,
      price: p.price,
      category: p.category,
      isReflective: p.isReflective,
      images: p.images,
    });
    buckets.set(p.categoryId, bucket);
  }

  // Turnos: una pieza de cada categoría, en el orden en que aparecieron.
  const queues = [...buckets.values()];
  const slides: HomeSlide[] = [];
  let added = true;

  while (added && slides.length < max) {
    added = false;
    for (const queue of queues) {
      const next = queue.shift();
      if (next) {
        slides.push(next);
        added = true;
        if (slides.length >= max) break;
      }
    }
  }

  return slides;
}
