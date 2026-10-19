-- =====================================================
-- Catálogo completo ¡D$P! (idempotente)
-- Ejecuta en Supabase → SQL Editor
--
-- Estructura de carpetas original → productos:
--   Camisas V3 (showroom)/DSP_1..DSP_7   → 7 camisas, una por color
--   ¡D$P! _ JEANS/<Color>/               → 3 jeans, uno por color
--
-- Precio único de tienda: $35 USD
-- Imágenes: /public/img/DSP_*.jpg (1200x1200, prenda centrada)
-- =====================================================

-- Limpiar catálogo anterior (deja el tenant intacto)
-- `slug` la crea add_product_slugs.sql, pero se asegura aquí para que este
-- archivo funcione solo (p. ej. en un proyecto nuevo).
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS slug TEXT;

DELETE FROM product_images WHERE product_id IN (
  SELECT id FROM products WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
);
DELETE FROM product_variants WHERE product_id IN (
  SELECT id FROM products WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
);
DELETE FROM products WHERE tenant_id = '11111111-1111-1111-1111-111111111111';
DELETE FROM categories WHERE tenant_id = '11111111-1111-1111-1111-111111111111';

-- =====================================================
-- CATEGORÍAS
-- =====================================================
INSERT INTO categories (id, tenant_id, name, slug) VALUES
  ('c0000001-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Camisas', 'camisas'),
  ('c0000001-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'Jeans', 'jeans');

-- =====================================================
-- CAMISAS (DSP_1 … DSP_7)
-- El nombre viene del color/estampado de cada foto.
-- =====================================================
INSERT INTO products (id, tenant_id, category_id, name, description, base_price, sku, slug, is_active) VALUES
('a0000001-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'c0000001-0000-4000-8000-000000000001',
 'Camisa ¡D$P! V3 Azul acero',
 'Camisa negra con el logo ¡D$P! en gris azulado apagado. Tono frío y discreto; el estampado se enciende con el flash.',
 35.00, 'DSP-01', 'camisa-dsp-v3-azul-acero', true),

('a0000001-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'c0000001-0000-4000-8000-000000000001',
 'Camisa ¡D$P! V3 Aurora',
 'Camisa negra con logo reflextivo multicolor tipo aurora (azul, rosa, amarillo y verde).',
 35.00, 'DSP-02', 'camisa-dsp-v3-aurora', true),

('a0000001-0000-4000-8000-000000000003', '11111111-1111-1111-1111-111111111111', 'c0000001-0000-4000-8000-000000000001',
 'Camisa ¡D$P! V3 Silver',
 'Camisa negra con logo reflextivo plateado. El reflejo más limpio de la colección.',
 35.00, 'DSP-03', 'camisa-dsp-v3-silver', true),

('a0000001-0000-4000-8000-000000000004', '11111111-1111-1111-1111-111111111111', 'c0000001-0000-4000-8000-000000000001',
 'Camisa ¡D$P! V3 Glow',
 'Camisa negra con logo reflextivo blanco de alto brillo. Se enciende con el flash.',
 35.00, 'DSP-04', 'camisa-dsp-v3-glow', true),

('a0000001-0000-4000-8000-000000000005', '11111111-1111-1111-1111-111111111111', 'c0000001-0000-4000-8000-000000000001',
 'Camisa ¡D$P! V3 Violet',
 'Camisa negra con logo reflextivo violeta. El tono más eléctrico del drop.',
 35.00, 'DSP-05', 'camisa-dsp-v3-violet', true),

('a0000001-0000-4000-8000-000000000006', '11111111-1111-1111-1111-111111111111', 'c0000001-0000-4000-8000-000000000001',
 'Camisa ¡D$P! V3 Crimson',
 'Camisa negra con logo reflextivo rojo carmesí.',
 35.00, 'DSP-06', 'camisa-dsp-v3-crimson', true),

('a0000001-0000-4000-8000-000000000007', '11111111-1111-1111-1111-111111111111', 'c0000001-0000-4000-8000-000000000001',
 'Camisa ¡D$P! V3 Jade',
 'Camisa negra con logo reflextivo verde jade.',
 35.00, 'DSP-07', 'camisa-dsp-v3-jade', true);

-- Tallas S, M, L, XL para cada camisa
INSERT INTO product_variants (product_id, name, size, color, price, stock)
SELECT
  p.id,
  s.size || ' · Negro',
  s.size,
  'Negro',
  35.00,
  10
FROM products p
CROSS JOIN (SELECT unnest(ARRAY['S','M','L','XL']) AS size) s
WHERE p.tenant_id = '11111111-1111-1111-1111-111111111111'
  AND p.sku LIKE 'DSP-0_';

-- =====================================================
-- JEANS (una carpeta por color)
-- =====================================================
INSERT INTO products (id, tenant_id, category_id, name, description, base_price, sku, slug, is_active) VALUES
('a0000001-0000-4000-8000-0000000000b1', '11111111-1111-1111-1111-111111111111', 'c0000001-0000-4000-8000-000000000002',
 'Jeep! Jeans gris metálico',
 'Jeans de denim negro con grabado reflextivo gris metálico en ambas piernas. El logo ¡D$P! y la estrella se encienden con el flash.',
 35.00, 'DSP-JEANS-GRIS', 'jeans-gris-metalico', true),

('a0000001-0000-4000-8000-0000000000b2', '11111111-1111-1111-1111-111111111111', 'c0000001-0000-4000-8000-000000000002',
 'Jeep! Jeans morado reflectivo',
 'Jeans de denim negro con grabado reflextivo morado en ambas piernas.',
 35.00, 'DSP-JEANS-MORADO', 'jeans-morado-reflectivo', true),

('a0000001-0000-4000-8000-0000000000b3', '11111111-1111-1111-1111-111111111111', 'c0000001-0000-4000-8000-000000000002',
 'Jeep! Jeans naranja reflextivo',
 'Jeans de denim negro con grabado reflextivo naranja en ambas piernas.',
 35.00, 'DSP-JEANS-NARANJA', 'jeans-naranja-reflextivo', true);

-- Una sola variante "Unitalla" por jean (producción bajo pedido: stock alto
-- para que la ficha no los marque como agotados; no se descuenta inventario)
INSERT INTO product_variants (product_id, name, size, color, price, stock) VALUES
  ('a0000001-0000-4000-8000-0000000000b1', 'Unitalla · Gris metálico', NULL, 'Gris metálico', 35.00, 999),
  ('a0000001-0000-4000-8000-0000000000b2', 'Unitalla · Morado',        NULL, 'Morado',        35.00, 999),
  ('a0000001-0000-4000-8000-0000000000b3', 'Unitalla · Naranja',       NULL, 'Naranja',       35.00, 999);

-- =====================================================
-- IMÁGENES (una por producto)
-- =====================================================
INSERT INTO product_images (product_id, url, alt_text, position) VALUES
  ('a0000001-0000-4000-8000-000000000001', '/img/DSP_1.jpg', 'Camisa ¡D$P! V3 Azul acero', 0),
  ('a0000001-0000-4000-8000-000000000002', '/img/DSP_2.jpg', 'Camisa ¡D$P! V3 Aurora',     0),
  ('a0000001-0000-4000-8000-000000000003', '/img/DSP_3.jpg', 'Camisa ¡D$P! V3 Silver',     0),
  ('a0000001-0000-4000-8000-000000000004', '/img/DSP_4.jpg', 'Camisa ¡D$P! V3 Glow',       0),
  ('a0000001-0000-4000-8000-000000000005', '/img/DSP_5.jpg', 'Camisa ¡D$P! V3 Violet',     0),
  ('a0000001-0000-4000-8000-000000000006', '/img/DSP_6.jpg', 'Camisa ¡D$P! V3 Crimson',    0),
  ('a0000001-0000-4000-8000-000000000007', '/img/DSP_7.jpg', 'Camisa ¡D$P! V3 Jade',       0),

  ('a0000001-0000-4000-8000-0000000000b1', '/img/DSP-JEANS-gris-01.jpg',       'Jeans gris metálico, frente',            0),
  ('a0000001-0000-4000-8000-0000000000b1', '/img/DSP-JEANS-gris-02.jpg',       'Jeans gris metálico, espalda',           1),
  ('a0000001-0000-4000-8000-0000000000b1', '/img/DSP-JEANS-gris-03-flash.jpg', 'Jeans gris metálico, frente con flash',  2),
  ('a0000001-0000-4000-8000-0000000000b1', '/img/DSP-JEANS-gris-04-flash.jpg', 'Jeans gris metálico, espalda con flash', 3),

  ('a0000001-0000-4000-8000-0000000000b2', '/img/DSP-JEANS-morado-01.jpg',       'Jeans morado, frente',            0),
  ('a0000001-0000-4000-8000-0000000000b2', '/img/DSP-JEANS-morado-02.jpg',       'Jeans morado, espalda',           1),
  ('a0000001-0000-4000-8000-0000000000b2', '/img/DSP-JEANS-morado-03-flash.jpg', 'Jeans morado, frente con flash',  2),
  ('a0000001-0000-4000-8000-0000000000b2', '/img/DSP-JEANS-morado-04-flash.jpg', 'Jeans morado, espalda con flash', 3),

  ('a0000001-0000-4000-8000-0000000000b3', '/img/DSP-JEANS-naranja-01.jpg',       'Jeans naranja, frente',           0),
  ('a0000001-0000-4000-8000-0000000000b3', '/img/DSP-JEANS-naranja-02-flash.jpg', 'Jeans naranja, frente con flash', 1);

-- Verificación
SELECT c.name AS categoria, p.name, p.base_price, p.slug, count(i.id) AS imagenes
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN product_images i ON i.product_id = p.id
WHERE p.tenant_id = '11111111-1111-1111-1111-111111111111'
GROUP BY c.name, p.name, p.base_price, p.slug
ORDER BY c.name, p.name;
