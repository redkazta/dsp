-- =====================================================
-- Slug en categorías
-- Ejecuta en Supabase → SQL Editor (idempotente)
--
-- Por qué: los enlaces usan UUIDs largos (/tienda?category=c0000001-…-0001).
-- Con slug quedan legibles y estables: /tienda?category=camisas
-- =====================================================

ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS slug TEXT;

-- Rellena las existentes a partir del nombre (sin acentos ni símbolos)
UPDATE public.categories
SET slug = trim(BOTH '-' FROM lower(
  translate(
    regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'),
    'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
    'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
  )
))
WHERE slug IS NULL OR slug = '';

-- Único por tenant (dos tiendas pueden tener "camisas")
DROP INDEX IF EXISTS public.idx_categories_tenant_slug;
CREATE UNIQUE INDEX idx_categories_tenant_slug
  ON public.categories (tenant_id, slug)
  WHERE slug IS NOT NULL;

-- Genera el slug al crear una categoría nueva
CREATE OR REPLACE FUNCTION public.set_category_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := trim(BOTH '-' FROM lower(
      translate(
        regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'),
        'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
        'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
      )
    ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_category_slug ON public.categories;
CREATE TRIGGER trg_set_category_slug
  BEFORE INSERT OR UPDATE OF name ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_category_slug();

-- Verificación
SELECT id, name, slug FROM public.categories
WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
ORDER BY name;
