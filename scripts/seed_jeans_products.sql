-- =====================================================
-- Jeep! Jeans reflextivos · catálogo
-- Ejecuta en Supabase → SQL Editor (después de seed_dsp_products.sql)
--
-- Archivos en /public/img:
--   DSP-JEANS-{color}-01.jpg        frente, sin flash
--   DSP-JEANS-{color}-02.jpg        espalda, sin flash
--   DSP-JEANS-{color}-03-flash.jpg  frente, con flash (reflejo)
--   DSP-JEANS-{color}-04-flash.jpg  espalda, con flash (reflejo)
-- =====================================================

-- Categoría "Jeans"
INSERT INTO categories (id, tenant_id, name) VALUES
  ('c0000001-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'Jeans')
ON CONFLICT (id) DO NOTHING;

-- Nunca se elige talla: el producto se produce bajo pedido
INSERT INTO products (id, tenant_id, category_id, name, description, base_price, sku, slug, is_active)
VALUES
(
  'a0000001-0000-4000-8000-0000000000b1',
  '11111111-1111-1111-1111-111111111111',
  'c0000001-0000-4000-8000-000000000002',
  'Jeep! Jeans gris metálico',
  'Jeans de denim negro con grabado reflextivo gris metálico. El logo ¡D$P! y la estrella se encienden con el flash.',
  1299.00,
  'DSP-JEANS-GRIS',
  'jeans-gris-metalico',
  true
),
(
  'a0000001-0000-4000-8000-0000000000b2',
  '11111111-1111-1111-1111-111111111111',
  'c0000001-0000-4000-8000-000000000002',
  'Jeep! Jeans morado reflectivo',
  'Jeans de denim negro con grabado reflextivo morado. El logo ¡D$P! y la estrella se encienden con el flash.',
  1299.00,
  'DSP-JEANS-MORADO',
  'jeans-morado-reflectivo',
  true
),
(
  'a0000001-0000-4000-8000-0000000000b3',
  '11111111-1111-1111-1111-111111111111',
  'c0000001-0000-4000-8000-000000000002',
  'Jeep! Jeans naranja reflextivo',
  'Jeans de denim negro con grabado reflextivo naranja. El logo ¡D$P! y la estrella se encienden con el flash.',
  1299.00,
  'DSP-JEANS-NARANJA',
  'jeans-naranja-reflextivo',
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  base_price = EXCLUDED.base_price,
  category_id = EXCLUDED.category_id,
  slug = EXCLUDED.slug,
  is_active = EXCLUDED.is_active,
  is_deleted = false;

-- Una sola variante "Unitalla" para cada jean
DELETE FROM product_variants WHERE product_id IN (
  'a0000001-0000-4000-8000-0000000000b1',
  'a0000001-0000-4000-8000-0000000000b2',
  'a0000001-0000-4000-8000-0000000000b3'
);

INSERT INTO product_variants (product_id, name, size, color, price, stock)
VALUES
  ('a0000001-0000-4000-8000-0000000000b1', 'Unitalla · Gris metálico', NULL, 'Gris metálico', 1299.00, 0),
  ('a0000001-0000-4000-8000-0000000000b2', 'Unitalla · Morado',        NULL, 'Morado',        1299.00, 0),
  ('a0000001-0000-4000-8000-0000000000b3', 'Unitalla · Naranja',       NULL, 'Naranja',       1299.00, 0);

-- Imágenes: orden = 01 frente, 02 espalda, 03 flash frente, 04 flash espalda
DELETE FROM product_images WHERE product_id IN (
  'a0000001-0000-4000-8000-0000000000b1',
  'a0000001-0000-4000-8000-0000000000b2',
  'a0000001-0000-4000-8000-0000000000b3'
);

INSERT INTO product_images (product_id, url, alt_text, position) VALUES
  ('a0000001-0000-4000-8000-0000000000b1', '/img/DSP-JEANS-gris-01.jpg',       'Jeans gris metálico, frente',          0),
  ('a0000001-0000-4000-8000-0000000000b1', '/img/DSP-JEANS-gris-02.jpg',       'Jeans gris metálico, espalda',         1),
  ('a0000001-0000-4000-8000-0000000000b1', '/img/DSP-JEANS-gris-03-flash.jpg', 'Jeans gris metálico, frente con flash', 2),
  ('a0000001-0000-4000-8000-0000000000b1', '/img/DSP-JEANS-gris-04-flash.jpg', 'Jeans gris metálico, espalda con flash', 3),

  ('a0000001-0000-4000-8000-0000000000b2', '/img/DSP-JEANS-morado-01.jpg',       'Jeans morado, frente',          0),
  ('a0000001-0000-4000-8000-0000000000b2', '/img/DSP-JEANS-morado-02.jpg',       'Jeans morado, espalda',         1),
  ('a0000001-0000-4000-8000-0000000000b2', '/img/DSP-JEANS-morado-03-flash.jpg', 'Jeans morado, frente con flash', 2),
  ('a0000001-0000-4000-8000-0000000000b2', '/img/DSP-JEANS-morado-04-flash.jpg', 'Jeans morado, espalda con flash', 3),

  ('a0000001-0000-4000-8000-0000000000b3', '/img/DSP-JEANS-naranja-01.jpg',       'Jeans naranja, frente',           0),
  ('a0000001-0000-4000-8000-0000000000b3', '/img/DSP-JEANS-naranja-02-flash.jpg', 'Jeans naranja, frente con flash', 1);

-- Verificación
SELECT p.name, i.position, i.url
FROM products p
JOIN product_images i ON i.product_id = p.id
WHERE p.sku LIKE 'DSP-JEANS-%'
ORDER BY p.sku, i.position;
