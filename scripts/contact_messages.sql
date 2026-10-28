-- ============================================================
-- Mensajes de contacto
-- ------------------------------------------------------------
-- El formulario de /contacto (/contact) guarda aquí cada envío.
-- Antes solo abría el cliente de correo del visitante (`mailto:`),
-- así que los mensajes se perdían si no enviaba el correo.
--
-- Ejecutar UNA vez. Es idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    -- Idioma en que se envió, para responder en el mismo.
    lang TEXT NOT NULL DEFAULT 'es',
    -- Estado de la conversación (bandeja simple, sin tabla aparte).
    status TEXT NOT NULL DEFAULT 'new'
      CHECK (status IN ('new', 'read', 'replied', 'archived')),
    -- Trazabilidad mínima; útil si algún día hay spam.
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created
    ON public.contact_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_messages_status
    ON public.contact_messages(status);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Nadie lee desde el navegador: el envío pasa por /api/contact con
-- service role, y la lectura es solo del staff (admin).
DROP POLICY IF EXISTS "contact_staff_read" ON public.contact_messages;
CREATE POLICY "contact_staff_read" ON public.contact_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customer_profiles p
       WHERE p.id = auth.uid()
         AND p.role IN ('owner', 'admin', 'staff')
    )
  );

-- El staff puede marcar como leído / archivado.
DROP POLICY IF EXISTS "contact_staff_update" ON public.contact_messages;
CREATE POLICY "contact_staff_update" ON public.contact_messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customer_profiles p
       WHERE p.id = auth.uid()
         AND p.role IN ('owner', 'admin', 'staff')
    )
  );

-- Verificación.
SELECT count(*) AS mensajes FROM public.contact_messages;
