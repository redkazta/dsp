-- =====================================================
-- Configuración de la tienda (ERP)
--
-- Valores editables desde /admin/configuracion. Si la fila no existe, el
-- código usa los valores por defecto de `lib/settings.ts`.
-- Idempotente.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.store_settings (
    tenant_id UUID PRIMARY KEY,
    free_shipping_threshold NUMERIC(10, 2) NOT NULL DEFAULT 150,
    standard_shipping NUMERIC(10, 2) NOT NULL DEFAULT 15,
    contact_email TEXT NOT NULL DEFAULT 'support@dinerosobreproblemas.com',
    low_stock_threshold INTEGER NOT NULL DEFAULT 5,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.store_settings (tenant_id)
VALUES ('11111111-1111-1111-1111-111111111111')
ON CONFLICT (tenant_id) DO NOTHING;

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- Solo staff puede leer desde el navegador; las escrituras van con service role.
DROP POLICY IF EXISTS "store_settings_staff_read" ON public.store_settings;
CREATE POLICY "store_settings_staff_read" ON public.store_settings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customer_profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'seller')
    )
  );

NOTIFY pgrst, 'reload schema';
