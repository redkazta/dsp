-- =====================================================
-- Emails transaccionales (Resend)
-- =====================================================

-- 1. Tabla de emails enviados (auditoría)
CREATE TABLE IF NOT EXISTS public.emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    template TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    provider TEXT,
    provider_message_id TEXT,
    error TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emails_tenant ON public.emails(tenant_id);
CREATE INDEX IF NOT EXISTS idx_emails_order ON public.emails(order_id);
CREATE INDEX IF NOT EXISTS idx_emails_status ON public.emails(status);

-- 2. Configuración de email por tenant
CREATE TABLE IF NOT EXISTS public.email_configs (
    tenant_id UUID PRIMARY KEY,
    provider TEXT NOT NULL DEFAULT 'resend',
    api_key_encrypted TEXT,
    from_email TEXT NOT NULL,
    from_name TEXT NOT NULL,
    reply_to TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Función: enviar email de confirmación de pedido
-- =====================================================
CREATE OR REPLACE FUNCTION public.send_order_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_email TEXT;
    v_name TEXT;
    v_order_number TEXT;
    v_total NUMERIC;
BEGIN
    -- Solo para pedidos confirmados (pago aprobado)
    IF NEW.status = 'confirmed' AND NEW.payment_status = 'approved' THEN
        SELECT contact_email, contact_name INTO v_email, v_name
        FROM public.orders
        WHERE id = NEW.id;

        v_order_number := NEW.order_number;
        v_total := NEW.total_amount;

        -- Registrar el email en la tabla de auditoría
        INSERT INTO public.emails (
            tenant_id, order_id, to_email, subject, template, status, provider
        ) VALUES (
            NEW.tenant_id,
            NEW.id,
            v_email,
            '¡D$P! - Confirmación de pedido ' || v_order_number,
            'order_confirmation',
            'pending',
            'resend'
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_order_confirmed_send_email ON public.orders;
CREATE TRIGGER on_order_confirmed_send_email
  AFTER UPDATE OF status, payment_status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.send_order_confirmation();

-- =====================================================
-- Función: enviar email de cambio de estatus
-- =====================================================
CREATE OR REPLACE FUNCTION public.send_status_change_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_email TEXT;
    v_name TEXT;
    v_order_number TEXT;
    v_status TEXT;
BEGIN
    -- Solo si el estatus cambió y no es el primer estado (ya lo envía el trigger de confirmación)
    IF NEW.status IS DISTINCT FROM OLD.status
       AND OLD.status IS NOT NULL
       AND NEW.status NOT IN ('cancelled', 'returned') THEN

        SELECT contact_email, contact_name INTO v_email, v_name
        FROM public.orders
        WHERE id = NEW.id;

        v_order_number := NEW.order_number;
        v_status := NEW.status;

        INSERT INTO public.emails (
            tenant_id, order_id, to_email, subject, template, status, provider
        ) VALUES (
            NEW.tenant_id,
            NEW.id,
            v_email,
            '¡D$P! - Actualización de tu pedido ' || v_order_number,
            'status_change',
            'pending',
            'resend'
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_order_status_change_send_email ON public.orders;
CREATE TRIGGER on_order_status_change_send_email
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.send_status_change_email();

-- =====================================================
-- Verificación
-- =====================================================
SELECT 'Email setup' AS dato, 'OK' AS estado;