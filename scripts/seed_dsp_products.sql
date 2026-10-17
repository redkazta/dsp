-- =====================================================
-- DSP 1-7 · Playeras reales de la marca
-- Ejecuta en Supabase → SQL Editor
-- =====================================================

-- Limpiar catálogo anterior (deja el tenant intacto)
DELETE FROM product_images WHERE product_id IN (
  SELECT id FROM products WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
);
DELETE FROM product_variants WHERE product_id IN (
  SELECT id FROM products WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
);
DELETE FROM products WHERE tenant_id = '11111111-1111-1111-1111-111111111111';
DELETE FROM categories WHERE tenant_id = '11111111-1111-1111-1111-111111111111';

-- Categoría única (UUID válido)
INSERT INTO categories (id, tenant_id, name) VALUES
  ('c0000001-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Playeras');

-- =====================================================
-- PRODUCTOS DSP 1 - DSP 7
-- =====================================================
INSERT INTO products (id, tenant_id, category_id, name, description, base_price, sku, is_active) VALUES
('a0000001-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'c0000001-0000-4000-8000-000000000001', 'DSP 1', NULL, 549.00, 'DSP-01', true),
('a0000001-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'c0000001-0000-4000-8000-000000000001', 'DSP 2', NULL, 549.00, 'DSP-02', true),
('a0000001-0000-4000-8000-000000000003', '11111111-1111-1111-1111-111111111111', 'c0000001-0000-4000-8000-000000000001', 'DSP 3', NULL, 549.00, 'DSP-03', true),
('a0000001-0000-4000-8000-000000000004', '11111111-1111-1111-1111-111111111111', 'c0000001-0000-4000-8000-000000000001', 'DSP 4', NULL, 549.00, 'DSP-04', true),
('a0000001-0000-4000-8000-000000000005', '11111111-1111-1111-1111-111111111111', 'c0000001-0000-4000-8000-000000000001', 'DSP 5', NULL, 549.00, 'DSP-05', true),
('a0000001-0000-4000-8000-000000000006', '11111111-1111-1111-1111-111111111111', 'c0000001-0000-4000-8000-000000000001', 'DSP 6', NULL, 549.00, 'DSP-06', true),
('a0000001-0000-4000-8000-000000000007', '11111111-1111-1111-1111-111111111111', 'c0000001-0000-4000-8000-000000000001', 'DSP 7', NULL, 549.00, 'DSP-07', true);

-- =====================================================
-- VARIANTES: S, M, L, XL para cada producto
-- =====================================================
INSERT INTO product_variants (product_id, name, size, color, price, stock)
SELECT
  p.id,
  s.size || ' · Negro',
  s.size,
  'Negro',
  549.00,
  10
FROM products p
CROSS JOIN (SELECT unnest(ARRAY['S','M','L','XL']) AS size) s
WHERE p.tenant_id = '11111111-1111-1111-1111-111111111111';

-- =====================================================
-- IMÁGENES
-- =====================================================
INSERT INTO product_images (product_id, url, alt_text, position)
SELECT id, '/img/' || REPLACE(sku, 'DSP-0', 'DSP_') || '.jpg', name, 0
FROM products
WHERE tenant_id = '11111111-1111-1111-1111-111111111111';
