# Descripciones y nombres en dos idiomas

Los productos guardan el **español** en las columnas canónicas y el **inglés**
en columnas `*_en`. La tienda elige según el idioma activo y, si falta la
traducción, muestra el español (nunca un hueco).

## 1. Migración

```sql
-- Nombres y descripciones en inglés.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS description_en text;

COMMENT ON COLUMN public.products.name_en IS
  'Nombre en inglés. Si está vacío, la tienda muestra `name` (español).';
COMMENT ON COLUMN public.products.description_en IS
  'Descripción en inglés. Si está vacía, la tienda muestra `description`.';
```

Son columnas públicas igual que `name` y `description`: la lectura con `anon`
ya funciona y no hace falta tocar RLS.

## 2. Rellenar las traducciones actuales

```sql
UPDATE public.products SET
  name_en = 'D$P! V3 Violet Shirt',
  description_en = 'Black shirt with a violet reflective logo. The most electric tone of the drop.'
WHERE slug = 'camisa-dsp-v3-violet';

UPDATE public.products SET
  name_en = 'D$P! V3 Jade Shirt',
  description_en = 'Black shirt with a jade green reflective logo.'
WHERE slug = 'camisa-dsp-v3-jade';

UPDATE public.products SET
  name_en = 'D$P! V3 Steel Blue Shirt',
  description_en = 'Black shirt with a steel blue reflective logo.'
WHERE slug = 'camisa-dsp-v3-azul-acero';

UPDATE public.products SET
  name_en = 'D$P! V3 Aurora Shirt',
  description_en = 'Black shirt with an aurora reflective logo.'
WHERE slug = 'camisa-dsp-v3-aurora';

UPDATE public.products SET
  name_en = 'Jeep! Metallic Grey Jeans',
  description_en = 'Black jeans with metallic grey reflective lettering on both legs.'
WHERE slug = 'jeans-gris-metalico';

UPDATE public.products SET
  name_en = 'Jeep! Reflective Purple Jeans',
  description_en = 'Black jeans with purple reflective lettering on both legs.'
WHERE slug = 'jeans-morado-reflectivo';

UPDATE public.products SET
  name_en = 'Jeep! Reflective Orange Jeans',
  description_en = 'Black jeans with orange reflective lettering on both legs.'
WHERE slug = 'jeans-naranja-reflextivo';
```

Ajusta los textos a tu copy real: aquí van como punto de partida.

## 3. Comprobar qué falta

```sql
SELECT slug, name, name_en, description_en
FROM public.products
WHERE name_en IS NULL OR description_en IS NULL OR description_en = ''
ORDER BY slug;
```

## 4. Cómo queda en la tienda

| Idioma | Qué muestra |
|---|---|
| Español | `name` y `description` |
| English | `name_en` y `description_en` |
| English, sin traducción | cae al español |

El ERP (`/admin/productos`) tiene ahora un campo de inglés por cada texto y
marca en ámbar los que faltan.
