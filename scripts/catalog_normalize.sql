-- =====================================================
-- Dejar el catálogo parejo
--
--   · Todos los productos del tenant visibles (is_active = true).
--   · Sin borrados lógicos (is_deleted = false).
--   · 50 piezas en cada variante viva.
--
-- Idempotente. Si algún producto NO debe venderse, ponlo en Off desde el panel
-- después de correr esto.
--
-- Ojo: los jeans que usaban 999 ("sin límite") también quedan en 50.
-- Para devolverles el ilimitado:
--   UPDATE product_variants SET stock = 999 WHERE size IS NULL;
-- =====================================================

-- 1. Antes -------------------------------------------------------------
SELECT
    p.name AS producto,
    p.is_active,
    p.is_deleted,
    count(v.id) FILTER (WHERE v.is_deleted = false) AS variantes,
    coalesce(sum(v.stock) FILTER (WHERE v.is_deleted = false), 0) AS stock_total
FROM public.products p
LEFT JOIN public.product_variants v ON v.product_id = p.id
WHERE p.tenant_id = '11111111-1111-1111-1111-111111111111'
GROUP BY p.id, p.name, p.is_active, p.is_deleted
ORDER BY p.name;

-- 2. Reactivar todo ----------------------------------------------------
UPDATE public.products
   SET is_active = true,
       is_deleted = false,
       deleted_at = NULL,
       updated_at = now()
 WHERE tenant_id = '11111111-1111-1111-1111-111111111111';

-- 3. Stock parejo (50 por variante) ------------------------------------
UPDATE public.product_variants v
   SET stock = 50,
       updated_at = now()
  FROM public.products p
 WHERE p.id = v.product_id
   AND p.tenant_id = '11111111-1111-1111-1111-111111111111'
   AND v.is_deleted = false;

-- 4. Después -----------------------------------------------------------
SELECT
    p.name AS producto,
    v.name AS variante,
    v.size,
    v.color,
    v.stock,
    p.is_active
FROM public.product_variants v
JOIN public.products p ON p.id = v.product_id
WHERE p.tenant_id = '11111111-1111-1111-1111-111111111111'
  AND v.is_deleted = false
ORDER BY p.name, v.name;

NOTIFY pgrst, 'reload schema';
