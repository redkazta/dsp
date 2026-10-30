-- =====================================================
-- Cupón de lanzamiento: DSPROBLEMAS = 10 % de descuento
--
-- Requiere haber corrido antes `scripts/coupons.sql` (crea la tabla).
-- Idempotente: si el cupón ya existe, actualiza sus valores.
--
-- Reglas del cupón:
--   · 10 % sobre el subtotal (sin envío)
--   · sin mínimo de compra
--   · sin límite de usos ni caducidad
-- Para apagarlo sin borrarlo: is_active = false.
-- =====================================================

INSERT INTO public.coupons (
    tenant_id,
    code,
    kind,
    value,
    min_subtotal,
    max_uses,
    starts_at,
    ends_at,
    is_active
)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'DSPROBLEMAS',
    'percent',
    10,
    0,
    NULL,
    NULL,
    NULL,
    true
)
ON CONFLICT (tenant_id, code) DO UPDATE
   SET kind         = EXCLUDED.kind,
       value        = EXCLUDED.value,
       min_subtotal = EXCLUDED.min_subtotal,
       max_uses     = EXCLUDED.max_uses,
       starts_at    = EXCLUDED.starts_at,
       ends_at      = EXCLUDED.ends_at,
       is_active    = EXCLUDED.is_active;

-- Verificación
SELECT code, kind, value, min_subtotal, max_uses, used_count, is_active
FROM public.coupons
WHERE code = 'DSPROBLEMAS';

NOTIFY pgrst, 'reload schema';
