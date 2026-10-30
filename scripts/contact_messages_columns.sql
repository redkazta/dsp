-- ============================================================
-- contact_messages: creación completa (idempotente)
-- ------------------------------------------------------------
-- Pegar TODO el archivo en el SQL Editor y pulsar "Run" sin seleccionar
-- nada. Si el editor ejecuta solo lo seleccionado, el CREATE se pierde y
-- el ALTER falla con 42P01 ("relation contact_messages does not exist").
--
-- Sin FKs a propósito: así no depende de que `tenants` o `auth` estén
-- accesibles desde el rol del editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id UUID,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'es',
  status TEXT NOT NULL DEFAULT 'new',
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Si la tabla ya existía con una versión anterior, se completan columnas.
DO $$
BEGIN
  IF to_regclass('public.contact_messages') IS NOT NULL THEN
    ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS tenant_id UUID;
    ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS user_id UUID;
    ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS lang TEXT DEFAULT 'es';
    ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new';
    ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS user_agent TEXT;
  END IF;
END $$;

-- RLS activo, sin policy de INSERT: solo escribe el service role.
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_contact_messages_created
  ON public.contact_messages (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_messages_status
  ON public.contact_messages (status);

NOTIFY pgrst, 'reload schema';

-- Verificación: debe devolver 0 filas, no un error.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'contact_messages'
ORDER BY ordinal_position;
