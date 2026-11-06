-- =====================================================
-- Diagnóstico: ¿por qué "Camisa ¡D$P! V3 Violet" sale AGOTADA?
--
-- Solo lectura: no modifica nada. Idempotente y seguro de repetir.
-- Ejecuta en Supabase → SQL Editor.
--
-- Regla que usa la tienda (ProductCard.astro:61-63 y
-- producto/[slug].astro:80-82):
--
--   const totalStock = variants.reduce((s, v) => s + (v.stock ?? 0), 0);
--   const isSoldOut  = variants.length > 0 && totalStock === 0;
--
-- O sea: la pieza se pinta "Agotado" cuando TIENE variantes pero la suma
-- de stock es 0. Para que eso pase, todas las variantes quedaron en 0
-- (o con stock NULL), o todas están borradas con stock 0.
--
-- =====================================================

-- 1. El producto y sus campos de visibilidad -------------------------
-- Esperado: is_active = true, is_deleted = false, slug
-- 'camisa-dsp-v3-violet'. Si is_active = false no aparecería en la tienda;
-- si is_deleted = true tampoco.
SELECT
  id,
  name,
  slug,
  sku,
  base_price,
  is_active,
  is_deleted,
  deleted_at,
  updated_at
FROM public.products
WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
  AND (slug ILIKE '%violet%' OR name ILIKE '%violet%' OR name ILIKE '%morad%')
ORDER BY name;

-- 2. Todas sus variantes, SIN filtrar borradas -----------------------
-- El stock que importa. Si aquí todo es 0 o NULL, la tarjeta dirá
-- "Agotado" y es correcto para la regla actual.
SELECT
  v.id,
  v.name,
  v.size,
  v.color,
  v.price,
  v.stock,
  v.is_deleted,
  v.created_at,
  v.updated_at
FROM public.product_variants v
JOIN public.products p ON p.id = v.product_id
WHERE p.tenant_id = '11111111-1111-1111-1111-111111111111'
  AND (p.slug ILIKE '%violet%' OR p.name ILIKE '%violet%')
ORDER BY v.color, v.size, v.name;

-- 3. Resumen: el número exacto que evalúa la tarjeta -----------------
-- variantes = 0            → la tarjeta NO marcaría Agotado (regla exige
--                            length > 0). Revisa que existan las tallas.
-- stock_total = 0 y
-- variantes > 0            → Agotado. Esta es la causa.
-- con_stock = 0 pero
-- stock_total > 0          → hay variantes borradas sumando stock: la
--                            tarjeta no dice Agotado pero el selector sale
--                            vacío. Ver punto 5.
SELECT
  p.slug,
  count(v.id)                                             AS variantes,
  count(v.id) FILTER (WHERE v.is_deleted = false)          AS variantes_vivas,
  count(v.id) FILTER (WHERE coalesce(v.stock, 0) > 0)      AS con_stock,
  coalesce(sum(v.stock), 0)                                AS stock_total,
  coalesce(sum(v.stock) FILTER (WHERE v.is_deleted = false), 0) AS stock_vivo,
  bool_or(v.is_deleted)                                    AS alguna_borrada
FROM public.products p
LEFT JOIN public.product_variants v ON v.product_id = p.id
WHERE p.tenant_id = '11111111-1111-1111-1111-111111111111'
  AND (p.slug ILIKE '%violet%' OR p.name ILIKE '%violet%')
GROUP BY p.id, p.slug
ORDER BY p.slug;

-- 4. Comparación con el resto del catálogo ---------------------------
-- Si el violet es el único en 0, es un cambio puntual (admin/seed), no un
-- efecto global de catalog_normalize.sql.
SELECT
  p.name,
  p.slug,
  count(v.id)                                        AS variantes,
  coalesce(sum(v.stock), 0)                          AS stock_total,
  bool_or(v.is_deleted)                              AS alguna_borrada
FROM public.products p
LEFT JOIN public.product_variants v ON v.product_id = p.id
WHERE p.tenant_id = '11111111-1111-1111-1111-111111111111'
  AND p.is_deleted = false
GROUP BY p.id, p.name, p.slug
ORDER BY stock_total ASC, p.name;

-- 5. Variantes borradas que todavía suman stock ----------------------
-- ProductCard no filtra `is_deleted`, así que estas piezas cuentan para
-- `isSoldOut` aunque no se puedan comprar. Debe salir vacío.
SELECT
  p.name AS producto,
  v.name AS variante,
  v.stock
FROM public.product_variants v
JOIN public.products p ON p.id = v.product_id
WHERE p.tenant_id = '11111111-1111-1111-1111-111111111111'
  AND v.is_deleted = true
  AND coalesce(v.stock, 0) > 0
ORDER BY p.name, v.name;

-- =====================================================
-- INTERPRETACIÓN
--
--  · Punto 3 con `stock_total = 0` y `variantes > 0`
--      → causa confirmada. La tienda no descuenta inventario en el
--        checkout (ver lib/orders.ts: "nunca se descuenta inventario"),
--        así que el 0 vino de un seed viejo, de catalog_normalize.sql
--        ejecutado antes de que existieran las variantes, o de una
--        edición manual en admin.
--
--  · Punto 3 con `variantes = 0`
--      → el seed nunca creó S/M/L/XL para esa camisa. Ojo:
--        seed_dsp_products.sql solo crea tallas para los SKU
--        DSP-01, DSP-02, DSP-05, DSP-06 y DSP-07. Una camisa sin tallas
--        NO se marca Agotado, pero no se puede añadir al carrito.
--
--  · Punto 4 mostrando TODOS los productos en 0
--      → algo global vació el stock (revisa cuándo se corrió
--        catalog_normalize.sql y si el seed se ejecutó después).
-- =====================================================

-- =====================================================
-- REPONER (NO SE EJECUTA SOLO: descomenta cuando lo confirmes)
--
-- Solo tiene efecto en variantes vivas que estén en 0, así que es
-- idempotente y no pisa stock real que ya exista.
-- =====================================================
-- UPDATE public.product_variants v
--    SET stock = 50,
--        updated_at = now()
--   FROM public.products p
--  WHERE p.id = v.product_id
--    AND p.tenant_id = '11111111-1111-1111-1111-111111111111'
--    AND p.slug = 'camisa-dsp-v3-violet'
--    AND v.is_deleted = false
--    AND coalesce(v.stock, 0) = 0;
--
-- NOTIFY pgrst, 'reload schema';

-- Si el punto 3 devolvió `variantes = 0`, en vez del UPDATE de arriba hay
-- que crear las tallas que falten (ajusta el stock a lo que vendas):
--
-- INSERT INTO public.product_variants (product_id, name, size, color, price, stock)
-- SELECT p.id, s.size || ' · Negro', s.size, 'Negro', p.base_price, 10
--   FROM public.products p
--   CROSS JOIN (SELECT unnest(ARRAY['S','M','L','XL']) AS size) s
--  WHERE p.tenant_id = '11111111-1111-1111-1111-111111111111'
--    AND p.slug = 'camisa-dsp-v3-violet'
--    AND NOT EXISTS (
--      SELECT 1 FROM public.product_variants v
--       WHERE v.product_id = p.id
--         AND v.size = s.size
--         AND v.is_deleted = false
--    );
--
-- NOTIFY pgrst, 'reload schema';
