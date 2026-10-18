-- =====================================================
-- Autenticación de clientes · Supabase Auth + perfiles
-- Ejecuta en Supabase → SQL Editor
-- =====================================================

-- 1. Perfil de cliente ligado a auth.users
CREATE TABLE IF NOT EXISTS customer_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    email TEXT,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_profiles_tenant ON customer_profiles(tenant_id);

ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;

-- Cada usuario ve y edita solo su propio perfil
DROP POLICY IF EXISTS "profile_select_own" ON customer_profiles;
CREATE POLICY "profile_select_own" ON customer_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "profile_update_own" ON customer_profiles;
CREATE POLICY "profile_update_own" ON customer_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profile_insert_own" ON customer_profiles;
CREATE POLICY "profile_insert_own" ON customer_profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- 2. Crear perfil automáticamente al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.customer_profiles (id, tenant_id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    '11111111-1111-1111-1111-111111111111',
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Direcciones del cliente
CREATE TABLE IF NOT EXISTS customer_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    label TEXT DEFAULT 'Casa',
    street TEXT NOT NULL,
    colonia TEXT,
    city TEXT NOT NULL,
    state TEXT,
    postal_code TEXT,
    country TEXT DEFAULT 'MX',
    phone TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_addresses_user ON customer_addresses(user_id);

ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "address_all_own" ON customer_addresses;
CREATE POLICY "address_all_own" ON customer_addresses
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. Vincular pedidos al usuario autenticado
ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- El cliente ve solo sus pedidos
DROP POLICY IF EXISTS "orders_select_own" ON orders;
CREATE POLICY "orders_select_own" ON orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- =====================================================
-- Verificación
-- =====================================================
SELECT 'customer_profiles' AS tabla, count(*) FROM customer_profiles
UNION ALL
SELECT 'customer_addresses', count(*) FROM customer_addresses;
