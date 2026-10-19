# 📸 Imágenes de productos

La carpeta replica la estructura del disco original: **una carpeta por prenda**.
Así se ve de inmediato a qué producto pertenece cada archivo.

```
img/
├── camisas/
│   ├── camisa-dsp-1-01-frente.jpg
│   ├── camisa-dsp-1-02-frente-flash.jpg
│   ├── camisa-dsp-2-01-frente.jpg
│   ├── camisa-dsp-2-02-frente-flash.jpg
│   ├── camisa-dsp-5-01-frente.jpg
│   ├── camisa-dsp-6-01-frente.jpg
│   └── camisa-dsp-7-01-frente.jpg
└── jeans/
    ├── gris-metalico/  (4: frente, espalda, frente-flash, espalda-flash)
    ├── morado-reflectivo/  (4)
    └── naranja-reflextivo/  (2: frente y frente-flash)
```

## Regla de nombres

```
/img/camisas/camisa-dsp-<n>-<nn>-frente[-flash].jpg
/img/jeans/<color>/<color>-<nn>-<vista>[-flash].jpg
```

| `nn` | Vista |
|---|---|
| 01 | frente |
| 02 | espalda o frente con flash (según el producto) |
| 03 | frente con flash |
| 04 | espalda con flash |

Traducción desde el nombre original:

| Original | Camisas | Jeans |
|---|---|---|
| `DSP_1.jpg` | `camisa-dsp-1-01-frente.jpg` | — |
| `DSP_1_Flash.jpg` | `camisa-dsp-1-02-frente-flash.jpg` | — |
| `no_flash_front.jpg` | — | `…-01-frente.jpg` |
| `no_flash_back.jpg` | — | `…-02-espalda.jpg` |
| `flash_front.jpg` | — | `…-03-frente-flash.jpg` |
| `flash_back.jpg` | — | `…-04-espalda-flash.jpg` |

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

`folders-normalize.ps1` regenera camisas y jeans desde `img-src` y reemplaza
los archivos previos de cada categoría.
