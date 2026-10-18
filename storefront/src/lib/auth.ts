/**
 * Autenticación de clientes con Supabase Auth
 * Soporta email/password y OAuth (Google).
 */

import { supabase } from './supabase';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
}

/** Registro con email y contraseña */
export async function signUp(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${window.location.origin}/cuenta`,
    },
  });
  return { data, error };
}

/** Inicio de sesión con email y contraseña */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

/** Login con Google */
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/cuenta`,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
  return { data, error };
}

/** Cerrar sesión */
export async function signOut() {
  return supabase.auth.signOut();
}

/** Usuario actual */
export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/** Sesión actual */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Perfil extendido (tabla customer_profiles) */
export async function getProfile(): Promise<Profile | null> {
  const user = await getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('customer_profiles')
    .select('id, email, full_name, phone, avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  if (data) return data as Profile;

  return {
    id: user.id,
    email: user.email ?? null,
    full_name: (user.user_metadata?.full_name as string) ?? null,
    phone: null,
    avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
  };
}

/** Actualizar perfil */
export async function updateProfile(patch: Partial<Pick<Profile, 'full_name' | 'phone'>>) {
  const user = await getUser();
  if (!user) throw new Error('No autenticado');

  const { error } = await supabase
    .from('customer_profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  return { error };
}

/** Pedidos del usuario */
export async function getMyOrders() {
  const user = await getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return data ?? [];
}

/** Direcciones del usuario */
export async function getMyAddresses() {
  const user = await getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('customer_addresses')
    .select('*')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false });

  return data ?? [];
}
