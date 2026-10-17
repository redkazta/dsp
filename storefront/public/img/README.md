# 📸 Imágenes de productos

**Mete aquí las fotos de tus playeras, hoodies y demás.**

---

## Nombres de archivo

Usa minúsculas y guiones. Ejemplos:

```
camisa-dsp-v3-aurora-01.jpg
camisa-dsp-v3-aurora-02.jpg
camisa-dsp-v3-silver-01.jpg
hoodie-nocturno-01.jpg
playera-oro-01.jpg
beanie-dsp-01.jpg
cargo-utility-01.jpg
```

Máximo 2 dígitos al final para ordenar: `-01`, `-02`, `-03`.

---

## Especificaciones

| Dato | Valor |
|------|-------|
| Formato | JPG o WebP (no PNG, pesa mucho) |
| Tamaño | **1200 × 1500 px** (proporción 4:5) |
| Peso | menos de **300 KB** |
| Fondo | neutro (gris claro u oscuro) |
| Estilo | iluminación dramática, editorial |

> Si tus fotos son más grandes, comprímelas en [squoosh.app](https://squoosh.app) antes de subirlas.

---

## Cómo conectarlas a un producto

### Opción A — Desde el SQL Editor de Supabase (recomendado)

Copia y pega esto, cambiando el `product_id` y el nombre del archivo:

```sql
-- Ejemplo: 2 fotos para la Camisa ¡D$P! V3
INSERT INTO product_images (product_id, url, alt_text, position) VALUES
('p0000001-0000-0000-0000-000000000001', '/img/camisa-dsp-v3-aurora-01.jpg', 'Camisa ¡D$P! V3', 0),
('p0000001-0000-0000-0000-000000000001', '/img/camisa-dsp-v3-aurora-02.jpg', 'Camisa ¡D$P! V3 detalle', 1);
```

La primera imagen (`position = 0`) es la que aparece en el catálogo.
Las demás salen como miniaturas en la página del producto.

### Opción B — Reemplazar una imagen existente

```sql
UPDATE product_images
SET url = '/img/camisa-dsp-v3-aurora-01.jpg'
WHERE product_id = 'p0000001-0000-0000-0000-000000000001'
  AND position = 0;
```

---

## IDs de productos disponibles

| Producto | product_id |
|----------|-----------|
| Camisa ¡D$P! V3 | `p0000001-0000-0000-0000-000000000001` |
| Hoodie ¡D$P! Nocturno | `p0000001-0000-0000-0000-000000000002` |
| Playera Logo Oro | `p0000001-0000-0000-0000-000000000003` |
| Beanie ¡D$P! | `p0000001-0000-0000-0000-000000000004` |
| Pantalón Utility Cargo | `p0000001-0000-0000-0000-000000000005` |

> Estos IDs existen **solo si ya ejecutaste** `scripts/seed_products.sql` en Supabase.

---

## Ver imágenes actuales

```sql
SELECT p.name, i.url, i.position
FROM product_images i
JOIN products p ON p.id = i.product_id
ORDER BY p.name, i.position;
```
