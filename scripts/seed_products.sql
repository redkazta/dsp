-- =====================================================
-- Dinero Sobre Problemas - Datos reales de la marca
-- Ejecuta en Supabase SQL Editor
-- =====================================================

-- Tenant
INSERT INTO tenants (id, slug, name, plan)
VALUES ('11111111-1111-1111-1111-111111111111', 'dinerosobreproblemas', 'Dinero Sobre Problemas', 'pro')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;

-- Limpiar datos previos de ejemplo
DELETE FROM product_images WHERE product_id IN (
  SELECT id FROM products WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
);
DELETE FROM product_variants WHERE product_id IN (
  SELECT id FROM products WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
);
DELETE FROM products WHERE tenant_id = '11111111-1111-1111-1111-111111111111';
DELETE FROM categories WHERE tenant_id = '11111111-1111-1111-1111-111111111111';

-- Categorías
INSERT INTO categories (id, tenant_id, name) VALUES
  ('c0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Camisas'),
  ('c0000001-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Hoodies'),
  ('c0000001-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Playeras'),
  ('c0000001-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Accesorios');

-- =====================================================
-- PRODUCTOS
-- =====================================================

-- 1. Camisa ¡D$P! V3 (Reflective)
INSERT INTO products (id, tenant_id, category_id, name, description, base_price, sku, is_active) VALUES
('p0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 'c0000001-0000-0000-0000-000000000001',
 'Camisa ¡D$P! V3',
 E'✨ Reflective Drop ✨\n\nLa camisa ¡D$P! Reflective Aurora & Grey brilla diferente — literalmente.\n\nHecha para los que se mueven en la oscuridad, el diseño refleja la luz con un efecto aurora o gris metálico, dependiendo del modelo.\n\nPerfecta para noches, luces de flash o simplemente destacar sin decir una palabra.\n\n🖤 Material premium\n🌈 Diseño reflectivo aurora o gris\n💀 Estilo callejero con energía de lujo\n\n⚡ Disponible por tiempo limitado.',
 799.00, 'DSP-CAM-V3', true);

INSERT INTO product_variants (product_id, name, size, color, price, stock) VALUES
('p0000001-0000-0000-0000-000000000001', 'S · Aurora', 'S', 'Aurora reflective', 799.00, 8),
('p0000001-0000-0000-0000-000000000001', 'M · Aurora', 'M', 'Aurora reflective', 799.00, 15),
('p0000001-0000-0000-0000-000000000001', 'L · Aurora', 'L', 'Aurora reflective', 799.00, 12),
('p0000001-0000-0000-0000-000000000001', 'XL · Aurora', 'XL', 'Aurora reflective', 799.00, 5),
('p0000001-0000-0000-0000-000000000001', 'M · Silver', 'M', 'Silver reflective', 799.00, 10),
('p0000001-0000-0000-0000-000000000001', 'L · Silver', 'L', 'Silver reflective', 799.00, 7);

-- 2. Hoodie ¡D$P! Nocturno
INSERT INTO products (id, tenant_id, category_id, name, description, base_price, sku, is_active) VALUES
('p0000001-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
 'c0000001-0000-0000-0000-000000000002',
 'Hoodie ¡D$P! Nocturno',
 E'Hoodie oversize de felpa premium con bordado dorado.\n\nInterior afelpado, capucha doble, y el logo ¡D$P! en hilo metálico. La pieza que abriga y define el look completo.\n\n🧵 Felpa 400gsm\n✨ Bordado dorado metálico\n♻️ Algodón orgánico',
 1299.00, 'DSP-HOO-01', true);

INSERT INTO product_variants (product_id, name, size, color, price, stock) VALUES
('p0000001-0000-0000-0000-000000000002', 'S · Negro', 'S', 'Negro', 1299.00, 6),
('p0000001-0000-0000-0000-000000000002', 'M · Negro', 'M', 'Negro', 1299.00, 14),
('p0000001-0000-0000-0000-000000000002', 'L · Negro', 'L', 'Negro', 1299.00, 11),
('p0000001-0000-0000-0000-000000000002', 'XL · Negro', 'XL', 'Negro', 1299.00, 4);

-- 3. Playera Logo Oro
INSERT INTO products (id, tenant_id, category_id, name, description, base_price, sku, is_active) VALUES
('p0000001-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
 'c0000001-0000-0000-0000-000000000003',
 'Playera Logo Oro',
 E'La esencial. Playera de algodón peinado 100% con el logo ¡D$P! estampado en dorado.\n\nCorte straight, cuello reforzado, y un estampado que no se agrieta ni se decolora.\n\n👕 Algodón peinado 220gsm\n✨ Estampado dorado\n🇲🇽 Confeccionada en México',
 549.00, 'DSP-PLY-01', true);

INSERT INTO product_variants (product_id, name, size, color, price, stock) VALUES
('p0000001-0000-0000-0000-000000000003', 'S · Negro', 'S', 'Negro', 549.00, 20),
('p0000001-0000-0000-0000-000000000003', 'M · Negro', 'M', 'Negro', 549.00, 25),
('p0000001-0000-0000-0000-000000000003', 'L · Negro', 'L', 'Negro', 549.00, 18),
('p0000001-0000-0000-0000-000000000003', 'XL · Negro', 'XL', 'Negro', 549.00, 9),
('p0000001-0000-0000-0000-000000000003', 'M · Blanco', 'M', 'Blanco', 549.00, 12),
('p0000001-0000-0000-0000-000000000003', 'L · Blanco', 'L', 'Blanco', 549.00, 8);

-- 4. Beanie DSP
INSERT INTO products (id, tenant_id, category_id, name, description, base_price, sku, is_active) VALUES
('p0000001-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
 'c0000001-0000-0000-0000-000000000004',
 'Beanie ¡D$P!',
 E'Gorro de punto grueso con etiqueta dorada tejida.\n\nEl detalle que cierra el outfit en temporada de frío.\n\n🧶 Tejido grueso premium\n✨ Etiqueta metálica dorada\nOne size',
 349.00, 'DSP-ACC-01', true);

INSERT INTO product_variants (product_id, name, size, color, price, stock) VALUES
('p0000001-0000-0000-0000-000000000004', 'One Size · Negro', 'One Size', 'Negro', 349.00, 30),
('p0000001-0000-0000-0000-000000000004', 'One Size · Gris', 'One Size', 'Gris', 349.00, 22);

-- 5. Cargó Pantalón Utility
INSERT INTO products (id, tenant_id, category_id, name, description, base_price, sku, is_active) VALUES
('p0000001-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111',
 'c0000001-0000-0000-0000-000000000003',
 'Pantalón Utility Cargo',
 E'Pantalón cargo de corte relajado con bolsillos utilitarios.\n\nTela resistente con caída perfecta. Para el día a día con actitud.\n\n👖 Tela ripstop\n🎒 6 bolsillos funcionales\n🧵 Cordón ajustable',
 1099.00, 'DSP-PAN-01', true);

INSERT INTO product_variants (product_id, name, size, color, price, stock) VALUES
('p0000001-0000-0000-0000-000000000005', '28 · Negro', '28', 'Negro', 1099.00, 5),
('p0000001-0000-0000-0000-000000000005', '30 · Negro', '30', 'Negro', 1099.00, 9),
('p0000001-0000-0000-0000-000000000005', '32 · Negro', '32', 'Negro', 1099.00, 12),
('p0000001-0000-0000-0000-000000000005', '34 · Negro', '34', 'Negro', 1099.00, 7);

-- =====================================================
-- IMÁGENES (placeholders de Unsplash, reemplazar con fotos reales)
-- =====================================================
INSERT INTO product_images (product_id, url, alt_text, position) VALUES
('p0000001-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?q=80&w=1200&auto=format&fit=crop', 'Camisa ¡D$P! V3', 0),
('p0000001-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=1200&auto=format&fit=crop', 'Camisa ¡D$P! V3 detalle', 1),
('p0000001-0000-0000-0000-000000000002', 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=1200&auto=format&fit=crop', 'Hoodie ¡D$P! Nocturno', 0),
('p0000001-0000-0000-0000-000000000003', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=1200&auto=format&fit=crop', 'Playera Logo Oro', 0),
('p0000001-0000-0000-0000-000000000004', 'https://images.unsplash.com/photo-1576871337622-98d48d1cf531?q=80&w=1200&auto=format&fit=crop', 'Beanie ¡D$P!', 0),
('p0000001-0000-0000-0000-000000000005', 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?q=80&w=1200&auto=format&fit=crop', 'Pantalón Utility Cargo', 0);
