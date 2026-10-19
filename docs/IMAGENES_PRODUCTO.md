# Estándar de imágenes de producto

## Regla de oro

**Todas las fotos se publican cuadradas (1:1), con la prenda centrada y el
mismo margen.** El catálogo, la ficha, el carrito y los favoritos muestran ese
cuadrado, así que cualquier foto que respete el estándar queda alineada sola.

## Especificación

| Campo | Valor |
|---|---|
| Formato | JPG (calidad ~90) o WebP |
| Tamaño | 1200 × 1200 px |
| Fondo | Blanco estudio (#FFFFFF a pantalla completa) |
| Prenda | Centrada, ocupa ~33 % del área (~57 % del lado) |
| Margen | 12 % mínimo en cada borde (la prenda nunca toca el marco) |
| Ubicación | `storefront/public/img/` |
| Servicio en URL | `/img/<archivo>.jpg` |

## Nombres

```
/img/DSP_<n>.jpg                     Playeras: DSP_1.jpg … DSP_7.jpg
/img/DSP-JEANS-<color>-<nn>.jpg      Jeans sin flash (frente, espalda)
/img/DSP-JEANS-<color>-<nn>-flash.jpg Jeans con flash (reflejo)
```

Colores de jeans: `gris`, `morado`, `naranja`.
Orden: `01` = frente, `02` = espalda, `03`/`04` = mismas vistas con flash.

Ejemplo:

```
DSP_1.jpg
DSP_2.jpg
...
DSP_7.jpg
DSP-JEANS-gris-01.jpg
DSP-JEANS-gris-02.jpg
DSP-JEANS-gris-03-flash.jpg
DSP-JEANS-gris-04-flash.jpg
DSP-JEANS-morado-01.jpg
...
```

En la base (`product_images.url`) se guarda la ruta completa, por ejemplo
`/img/DSP_4.jpg`. `position` define el orden de la galería (0 es la portada).

## Cómo se generó la colección actual

La carpeta original traía fotos 4:5 (1512 × 2016) con la prenda descentrada y
con distinto tamaño según el color. Para publicarlas se usó
`scripts/image-normalize.ps1`, que:

1. Detecta el bounding box de la prenda (todo lo que no sea blanco puro).
2. Calcula un marco cuadrado centrado en ella.
3. Escala para que **cada prenda ocupe la misma área** (33 % del encuadre).
4. Exporta a 1200 × 1200 con fondo blanco y margen uniforme.

`scripts/images-finalize.ps1` renombró los resultados al estándar y eliminó las
imágenes sueltas anteriores en `/img`.

## Para fotos nuevas (proveedor, diseñador, teléfono)

- Pedir o recortar a 1:1 en 1200 px con fondo blanco.
- Si llega 4:5, no importa: `.product-frame` en `global.css` la centra y respeta
  el margen, pero el estándar sigue siendo el de esta guía.
- Revisar con el script: `powershell -File scripts/image-normalize.ps1`.
