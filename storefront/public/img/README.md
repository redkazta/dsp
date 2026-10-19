# 📸 Imágenes de productos

Todas las fotos se publican **cuadradas (1:1), con la prenda centrada y el
mismo margen**. El catálogo, la ficha, el carrito y los favoritos muestran ese
cuadrado, así que cualquier foto que respete el estándar queda alineada sola.

> Guía completa y cómo regenerarlas: [`docs/IMAGENES_PRODUCTO.md`](../../../docs/IMAGENES_PRODUCTO.md)

---

## Especificaciones

| Dato | Valor |
|------|-------|
| Formato | JPG (calidad ~90) o WebP |
| Tamaño | **1200 × 1200 px** (1:1) |
| Peso | menos de **150 KB** |
| Fondo | blanco estudio (#FFFFFF) |
| Prenda | centrada, ~33 % del área, margen mínimo del 12 % |

Si una foto llega en 4:5, el marco `.product-frame` la centra igual, pero el
estándar es 1:1.

---

## Nombres

```
DSP_<n>.jpg                         Playeras: DSP_1.jpg … DSP_7.jpg
DSP-JEANS-<color>-<nn>.jpg          Jeans sin flash (frente, espalda)
DSP-JEANS-<color>-<nn>-flash.jpg    Jeans con flash (reflejo)
```

Colores: `gris`, `morado`, `naranja`. Orden: `01` frente, `02` espalda.

---

## Cómo conectarlas a un producto

La primera imagen (`position = 0`) es la portada del catálogo; las demás salen
como miniaturas en la ficha.

```sql
INSERT INTO product_images (product_id, url, alt_text, position) VALUES
('a0000001-0000-4000-8000-000000000001', '/img/DSP_1.jpg', 'Camisa ¡D$P!', 0);
```

---

## IDs de productos disponibles

| Producto | product_id |
|----------|-----------|
| DSP 1 – DSP 7 (playeras) | `a0000001-0000-4000-8000-00000000000{n}` (n = 1…7) |
| Jeans gris metálico | `a0000001-0000-4000-8000-0000000000b1` |
| Jeans morado reflectivo | `a0000001-0000-4000-8000-0000000000b2` |
| Jeans naranja reflextivo | `a0000001-0000-4000-8000-0000000000b3` |

> Los jeans existen **solo si ya ejecutaste** `scripts/seed_jeans_products.sql`.

---

## Ver imágenes actuales

```sql
SELECT p.name, i.url, i.position
FROM product_images i
JOIN products p ON p.id = i.product_id
ORDER BY p.sku, i.position;
```
