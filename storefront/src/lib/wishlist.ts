/**
 * Wishlist por usuario.
 *
 * Con sesión se guarda en Supabase (`wishlist_items`), así se ve igual
 * en cualquier dispositivo. Sin sesión vive en localStorage y se
 * fusiona con la nube al iniciar sesión.
 */

import { supabase } from './supabase';
import { getUser } from './auth';

export interface WishlistItem {
  productId: string;
  slug: string | null;
  name: string;
  price: number;
  image: string | null;
}

const KEY = 'dsp_wishlist';

function readLocal(): WishlistItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeLocal(items: WishlistItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('wishlist:updated', { detail: items }));
}

function rowToItem(row: any): WishlistItem {
  return {
    productId: row.product_id,
    slug: row.product_slug,
    name: row.product_name,
    price: Number(row.price ?? 0),
    image: row.image_url,
  };
}

/** Lista actual (nube si hay sesión, local si no) */
export async function getWishlist(): Promise<WishlistItem[]> {
  const user = await getUser();
  if (!user) return readLocal();

  const { data } = await supabase
    .from('wishlist_items')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (data ?? []).map(rowToItem);
}

/** Fusiona la wishlist local con la del usuario que acaba de entrar */
export async function syncWishlist(): Promise<WishlistItem[]> {
  const user = await getUser();
  if (!user) return readLocal();

  const local = readLocal();
  if (local.length > 0) {
    const rows = local.map((i) => ({
      user_id: user.id,
      product_id: i.productId,
      product_slug: i.slug,
      product_name: i.name,
      price: i.price,
      image_url: i.image,
    }));

    await supabase.from('wishlist_items').upsert(rows, {
      onConflict: 'user_id,product_id',
      ignoreDuplicates: true,
    });

    localStorage.removeItem(KEY);
  }

  const items = await getWishlist();
  window.dispatchEvent(new CustomEvent('wishlist:updated', { detail: items }));
  return items;
}

export async function isInWishlist(productId: string): Promise<boolean> {
  const user = await getUser();
  if (!user) return readLocal().some((i) => i.productId === productId);

  const { data } = await supabase
    .from('wishlist_items')
    .select('id')
    .eq('user_id', user.id)
    .eq('product_id', productId)
    .maybeSingle();

  return Boolean(data);
}

/** Agrega o quita. Devuelve true si quedó guardado. */
export async function toggleWishlist(item: WishlistItem): Promise<boolean> {
  const user = await getUser();

  if (!user) {
    const local = readLocal();
    const exists = local.some((i) => i.productId === item.productId);
    const next = exists
      ? local.filter((i) => i.productId !== item.productId)
      : [item, ...local];
    writeLocal(next);

    window.dispatchEvent(
      new CustomEvent(exists ? 'wishlist:removed' : 'wishlist:added', {
        detail: { productId: item.productId, name: item.name },
      })
    );

    return !exists;
  }

  const exists = await isInWishlist(item.productId);

  if (exists) {
    await supabase
      .from('wishlist_items')
      .delete()
      .eq('user_id', user.id)
      .eq('product_id', item.productId);
  } else {
    await supabase.from('wishlist_items').insert({
      user_id: user.id,
      product_id: item.productId,
      product_slug: item.slug,
      product_name: item.name,
      price: item.price,
      image_url: item.image,
    });
  }

  const items = await getWishlist();
  window.dispatchEvent(new CustomEvent('wishlist:updated', { detail: items }));
  window.dispatchEvent(
    new CustomEvent(exists ? 'wishlist:removed' : 'wishlist:added', {
      detail: { productId: item.productId, name: item.name },
    })
  );

  return !exists;
}

export async function removeFromWishlist(productId: string) {
  const user = await getUser();

  if (!user) {
    writeLocal(readLocal().filter((i) => i.productId !== productId));
    return;
  }

  await supabase.from('wishlist_items').delete().eq('user_id', user.id).eq('product_id', productId);

  const items = await getWishlist();
  window.dispatchEvent(new CustomEvent('wishlist:updated', { detail: items }));
  window.dispatchEvent(new CustomEvent('wishlist:removed', { detail: { productId } }));
}

/** Lee la wishlist local sin tocar la red (para pintar al instante) */
export function getLocalWishlist() {
  return readLocal();
}
