/**
 * Autenticación de clientes con Supabase Auth
 * Soporta email/password y OAuth (Google).
 *
 * Perfil homologado: mismo conjunto de campos para cualquier método de alta.
 * La fuente de verdad es la tabla `customer_profiles` en Postgres, así que
 * `ensureProfile()` repara perfiles de Google que llegaron incompletos.
 */

import { supabase } from './supabase';

export interface SignUpProfile {
  firstName: string;
  lastName?: string;
  phone?: string;
  birthdate?: string;
  marketing?: boolean;
}

export interface Profile {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  phone: string | null;
  birthdate: string | null;
  marketing_opt_in: boolean;
  avatar_url: string | null;
  role: string | null;
}

const TENANT_ID = '11111111-1111-1111-1111-111111111111';

/** Junta nombre + apellidos en un solo campo legible */
export function composeFullName(firstName?: string | null, lastName?: string | null) {
  return [firstName, lastName].filter(Boolean).join(' ').trim();
}

/** Registro con email y contraseña */
export async function signUp(email: string, password: string, profile: SignUpProfile) {
  const firstName = profile.firstName.trim();
  const lastName = (profile.lastName ?? '').trim();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        full_name: composeFullName(firstName, lastName),
        phone: profile.phone?.trim() || null,
        birthdate: profile.birthdate || null,
        marketing_opt_in: Boolean(profile.marketing),
      },
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

/**
 * Garantiza que exista el perfil del usuario con los datos disponibles.
 * Cubre a quién entró por Google: rellena nombre, apellidos, foto y rol.
 */
export async function ensureProfile(): Promise<Profile | null> {
  const user = await getUser();
  if (!user) return null;

  const meta = user.user_metadata ?? {};

  const { data: existing } = await supabase
    .from('customer_profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  const googleFirst = (meta.given_name as string) ?? null;
  const googleLast = (meta.family_name as string) ?? null;
  const fallbackName = (meta.full_name as string) ?? (meta.name as string) ?? null;

  const firstName =
    (meta.first_name as string) ?? existing?.first_name ?? googleFirst ?? fallbackName?.split(' ')[0] ?? null;
  const lastName =
    (meta.last_name as string) ??
    existing?.last_name ??
    googleLast ??
    fallbackName?.split(' ').slice(1).join(' ') ??
    null;

  const patch: Record<string, unknown> = {
    id: user.id,
    tenant_id: existing?.tenant_id ?? TENANT_ID,
    email: user.email ?? existing?.email ?? null,
    first_name: firstName,
    last_name: lastName,
    full_name: composeFullName(firstName, lastName) || fallbackName,
    phone: (meta.phone as string) ?? existing?.phone ?? null,
    birthdate: (meta.birthdate as string) ?? existing?.birthdate ?? null,
    marketing_opt_in: existing?.marketing_opt_in ?? Boolean(meta.marketing_opt_in),
    avatar_url: (meta.avatar_url as string) ?? existing?.avatar_url ?? null,
    role: existing?.role ?? 'customer',
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('customer_profiles')
    .upsert(patch, { onConflict: 'id' })
    .select('*')
    .maybeSingle();

  if (error || !data) {
    // RLS o red: devolvemos lo que alcanzamos a conocer
    return {
      id: user.id,
      email: user.email ?? null,
      first_name: firstName,
      last_name: lastName,
      full_name: composeFullName(firstName, lastName) || fallbackName,
      phone: (meta.phone as string) ?? null,
      birthdate: (meta.birthdate as string) ?? null,
      marketing_opt_in: Boolean(meta.marketing_opt_in),
      avatar_url: (meta.avatar_url as string) ?? null,
      role: existing?.role ?? 'customer',
    };
  }

  return data as Profile;
}

/** Perfil extendido (tabla customer_profiles) */
export async function getProfile(): Promise<Profile | null> {
  return ensureProfile();
}

/** Actualizar perfil */
export async function updateProfile(
  patch: Partial<Pick<Profile, 'first_name' | 'last_name' | 'phone' | 'birthdate' | 'marketing_opt_in'>>
) {
  const user = await getUser();
  if (!user) throw new Error('No autenticado');

  const next = { ...patch };
  if ('first_name' in patch || 'last_name' in patch) {
    const current = await ensureProfile();
    (next as any).full_name = composeFullName(
      patch.first_name ?? current?.first_name,
      patch.last_name ?? current?.last_name
    );
  }

  const { error } = await supabase
    .from('customer_profiles')
    .update({ ...next, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  return { error };
}

/** Pedidos y wishlist */
export async function getMyOrders() {
  const { getMyOrders: list } = await import('./orders');
  return list();
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
