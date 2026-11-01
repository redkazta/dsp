-- =====================================================
-- Stock para pruebas: 50 piezas en cada variante vendible
--
-- 1) Diagnóstico: qué variantes hay, con stock y si su producto existe.
-- 2) Pone stock = 50 en todas las variantes de productos activos.
-- 3) Verificación.
--
-- Idempotente: correrlo otra vez vuelve a dejar 50.
-- Para volver al "sin límite" de los jeans: stock = 999.
-- =====================================================

-- 1. Diagnóstico ------------------------------------------------------
SELECT
    COALESCE(p.name, '(producto borrado o inactivo)') AS producto,
    p.is_active,
    v.name AS variante,
    v.size,
    v.color,
    v.stock,
    v.is_deleted,
    v.id AS variant_id
FROM public.product_variants v
LEFT JOIN public.products p ON p.id = v.product_id
ORDER BY v.stock ASC, p.name NULLS LAST, v.name;

-- Variantes huérfanas (su producto ya no existe o está oculto por RLS)
SELECT count(*) AS variantes_huerfanas
FROM public.product_variants v
LEFT JOIN public.products p ON p.id = v.product_id
WHERE p.id IS NULL AND v.is_deleted = false;

-- 2. Stock de prueba --------------------------------------------------
UPDATE public.product_variants v
   SET stock = 50,
       updated_at = now()
  FROM public.products p
 WHERE p.id = v.product_id
   AND p.is_active = true
   AND p.is_deleted = false
   AND v.is_deleted = false;

-- 3. Verificación -----------------------------------------------------
SELECT p.name AS producto, v.name AS variante, v.stock
FROM public.product_variants v
JOIN public.products p ON p.id = v.product_id
WHERE p.is_active = true
  AND p.is_deleted = false
  AND v.is_deleted = false
ORDER BY p.name, v.name;

NOTIFY pgrst, 'reload schema';
