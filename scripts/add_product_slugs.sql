-- =====================================================
-- Agregar slug a products
-- Ejecuta en Supabase → SQL Editor
-- =====================================================

-- 1. Columna
ALTER TABLE products ADD COLUMN IF NOT EXISTS slug TEXT;

-- 2. Slugs para los productos existentes (DSP 1-7 → dsp-1 ... dsp-7)
UPDATE products
SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
  AND (slug IS NULL OR slug = '');

-- 3. Quitar guiones sobrantes al inicio/fin
UPDATE products SET slug = trim(BOTH '-' FROM slug) WHERE slug IS NOT NULL;

-- 4. Índice único por tenant
DROP INDEX IF EXISTS idx_products_tenant_slug;
CREATE UNIQUE INDEX idx_products_tenant_slug
  ON products (tenant_id, slug)
  WHERE slug IS NOT NULL;

-- 5. Asegurar default para nuevos productos (trigger)
CREATE OR REPLACE FUNCTION set_product_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'));
    NEW.slug := trim(BOTH '-' FROM NEW.slug);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_product_slug ON products;
CREATE TRIGGER trg_set_product_slug
  BEFORE INSERT OR UPDATE OF name ON products
  FOR EACH ROW EXECUTE FUNCTION set_product_slug();

-- Verificar
SELECT id, name, slug FROM products WHERE tenant_id = '11111111-1111-1111-1111-111111111111' ORDER BY name;
