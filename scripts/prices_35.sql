-- =====================================================
-- Precios de venta a 35.00 USD
--
-- Fuerza el precio de todos los productos y variantes del tenant a $35.00.
-- Es el precio con el que se vendió antes de las pruebas de pago.
--
-- Idempotente: se puede correr varias veces.
-- OJO: sobrescribe cualquier precio editado desde el panel.
--
-- Si el catálogo ya está en 35, el bloque 3 no cambia nada; el bloque 1 lo
-- muestra antes de tocar.
-- =====================================================

-- 1. Antes -------------------------------------------------------------
SELECT
    p.name                       AS producto,
    p.base_price,
    min(v.price)                 AS variante_min,
    max(v.price)                 AS variante_max,
    count(*) FILTER (WHERE v.price <> 35.00) AS variantes_fuera_de_35
FROM public.products p
LEFT JOIN public.product_variants v
       ON v.product_id = p.id AND v.is_deleted = false
WHERE p.tenant_id = '11111111-1111-1111-1111-111111111111'
GROUP BY p.id, p.name, p.base_price
ORDER BY p.name;

-- 2. Precio base -------------------------------------------------------
UPDATE public.products
   SET base_price = 35.00,
       updated_at = now()
 WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
   AND base_price <> 35.00;

-- 3. Precio por variante -----------------------------------------------
UPDATE public.product_variants v
   SET price = 35.00,
       updated_at = now()
  FROM public.products p
 WHERE p.id = v.product_id
   AND p.tenant_id = '11111111-1111-1111-1111-111111111111'
   AND v.is_deleted = false
   AND v.price <> 35.00;

-- 4. Después -----------------------------------------------------------
SELECT
    p.name   AS producto,
    v.name   AS variante,
    v.price,
    v.stock
FROM public.product_variants v
JOIN public.products p ON p.id = v.product_id
WHERE p.tenant_id = '11111111-1111-1111-1111-111111111111'
  AND v.is_deleted = false
ORDER BY p.name, v.name;

NOTIFY pgrst, 'reload schema';
