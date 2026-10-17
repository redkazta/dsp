# Imágenes de productos

Coloca aquí las fotos de tus productos.

## Convención de nombres

Usa nombres en minúsculas, sin espacios, con guiones:

```
dsp-cam-v3-01.jpg
dsp-cam-v3-02.jpg
dsp-hoodie-nocturno-01.jpg
dsp-playera-oro-01.jpg
dsp-beanie-01.jpg
dsp-cargo-01.jpg
```

## Cómo referenciarlas

Desde el storefront se accede con la ruta pública `/productos/<archivo>`:

```
/productos/dsp-cam-v3-01.jpg
```

## Cómo asignarlas a un producto en Supabase

Ejecuta en el SQL Editor, cambiando el `product_id` y el nombre del archivo:

```sql
INSERT INTO product_images (product_id, url, alt_text, position) VALUES
('p0000001-0000-0000-0000-000000000001', '/productos/dsp-cam-v3-01.jpg', 'Camisa ¡D$P! V3', 0),
('p0000001-0000-0000-0000-000000000001', '/productos/dsp-cam-v3-02.jpg', 'Camisa ¡D$P! V3 detalle', 1);
```

## IDs de los productos actuales

| Producto | product_id | categoría |
|----------|-----------|-----------|
| Camisa ¡D$P! V3 | `p0000001-0000-0000-0000-000000000001` | Camisas |
| Hoodie ¡D$P! Nocturno | `p0000001-0000-0000-0000-000000000002` | Hoodies |
| Playera Logo Oro | `p0000001-0000-0000-0000-000000000003` | Playeras |
| Beanie ¡D$P! | `p0000001-0000-0000-0000-000000000004` | Accesorios |
| Pantalón Utility Cargo | `p0000001-0000-0000-0000-000000000005` | Playeras |

## Especificaciones recomendadas

- **Formato:** JPG o WebP
- **Tamaño:** 1200 × 1500 px (proporción 4:5)
- **Peso:** menos de 300 KB por imagen
- **Fondo:** neutro (gris claro u oscuro)
- **Iluminación:** dramática, estilo editorial
