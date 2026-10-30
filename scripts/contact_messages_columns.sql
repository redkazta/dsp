-- ============================================================
-- contact_messages: tabla y columnas que usa /api/contact
-- ------------------------------------------------------------
-- Si la tabla no existe, o se creó con una versión anterior del script,
-- el INSERT falla (PGRST204/PGRST205) y el formulario responde 500
-- (`save_failed`). Esto lo deja completo.
--
-- Ejecutar UNA vez en el SQL Editor. Es idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lang TEXT DEFAULT 'es',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Colchón: si alguna columna base faltara en una tabla vieja.
ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- RLS activo, sin policy de INSERT: solo escribe el service role.
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';

-- Verificación: deben aparecer todas las columnas que usa el API.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'contact_messages'
ORDER BY ordinal_position;
