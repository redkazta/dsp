-- =====================================================
-- Diagnóstico del catálogo
-- Ejecuta en Supabase → SQL Editor y compáralo con la tienda.
-- Si ves nombres "DSP 1…7" o precios 549/1299, el seed viejo sigue activo.
-- =====================================================

-- 1. Productos con su precio y su imagen actual
SELECT
  c.name            AS categoria,
  p.name            AS producto,
  p.slug,
  p.base_price      AS precio_usd,
  p.sku,
  (SELECT count(*) FROM product_images i WHERE i.product_id = p.id) AS imagenes,
  (SELECT min(url) FROM product_images i WHERE i.product_id = p.id) AS portada
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
WHERE p.tenant_id = '11111111-1111-1111-1111-111111111111'
ORDER BY c.name, p.name;

-- 2. Resumen rápido: ¿el catálogo ya es el nuevo?
SELECT
  count(*)                                            AS productos,
  count(*) FILTER (WHERE base_price = 35.00)          AS a_35_usd,
  count(*) FILTER (WHERE slug IS NULL)                AS sin_slug,
  count(*) FILTER (WHERE name ~ '^DSP [0-9]$')        AS nombres_genericos
FROM products
WHERE tenant_id = '11111111-1111-1111-1111-111111111111';

-- 3. Variantes sin stock (se muestran como Agotado)
SELECT p.name, v.name, v.price, v.stock
FROM product_variants v
JOIN products p ON p.id = v.product_id
WHERE p.tenant_id = '11111111-1111-1111-1111-111111111111'
  AND coalesce(v.stock, 0) = 0;

-- 4. ¿Existen las categorías con los IDs que usa la home?
SELECT id, name FROM categories
WHERE id IN (
  'c0000001-0000-4000-8000-000000000001',
  'c0000001-0000-4000-8000-000000000002'
);
