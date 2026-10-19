# 📸 Imágenes de productos

La carpeta replica la estructura del disco original: **una carpeta por prenda**.
Así se ve de inmediato a qué producto pertenece cada archivo.

```
img/
├── camisas/
│   ├── dsp_1.jpg … dsp_7.jpg            ← Camisas V3 (showroom)
└── jeans/
    ├── gris-metalico/
    │   ├── gris-metalico-01-frente.jpg
    │   ├── gris-metalico-02-espalda.jpg
    │   ├── gris-metalico-03-frente-flash.jpg
    │   └── gris-metalico-04-espalda-flash.jpg
    ├── morado-reflectivo/   (mismos 4)
    └── naranja-reflextivo/  (2: frente y frente con flash)
```

## Regla de nombres

```
/img/camisas/dsp_<n>.jpg
/img/jeans/<color>/<color>-<nn>-<vista>.jpg
```

`<nn>` y `<vista>`:

| Orden | Vista | Cuándo |
|---|---|---|
| 01 | `frente` | siempre |
| 02 | `espalda` | si existe `no_flash_back` |
| 03 | `frente-flash` | si existe `flash_front` |
| 04 | `espalda-flash` | si existe `flash_back` |

Traducción desde el nombre original:

| Original | Destino |
|---|---|
| `no_flash_front.jpg` | `…-01-frente.jpg` |
| `no_flash_back.jpg` | `…-02-espalda.jpg` |
| `flash_front.jpg` | `…-03-frente-flash.jpg` |
| `flash_back.jpg` | `…-04-espalda-flash.jpg` |

El orden `01 → 04` es el de la galería: portada, espalda, y luego las mismas
vistas con flash.

## Especificación técnica

| Dato | Valor |
|---|---|
| Formato | JPG (calidad ~90) |
| Tamaño | 1200 × 1200 px (1:1) |
| Fondo | blanco estudio |
| Prenda | centrada, ~38 % del área, margen mínimo 6 % |

## Regenerar desde el disco

```powershell
powershell -File scripts/folders-mirror.ps1     # copia el origen a public/img-src
powershell -File scripts/folders-normalize.ps1  # recorta y exporta a public/img
```

`folders-normalize.ps1` borra todo lo anterior en `img/` (excepto este README)
y vuelve a generar las 17 fotos con la estructura de arriba.
