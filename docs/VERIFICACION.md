# Verificación antes de subir

El deploy de Vercel compila en otra máquina y con otro Node. Que `npm run build`
pase en local **no** garantiza que el deploy pase: por eso existe un chequeo
automático antes de cada `git push`.

## Activarlo (una vez por clon)

```sh
sh scripts/setup-hooks.sh
```

Eso apunta `core.hooksPath` a `.githooks/`. A partir de ahí cada `git push`:

1. compila con **Node 22** (el mismo que usa Vercel, si está descargado)
2. corre los tests
3. cancela el push si algo falla

```
▶ Pre-push: comprobando el build…
  node v22.12.0
  ✓ build
  ✓ tests

✓ Todo en orden, subiendo.
```

Si falla, imprime el error y **no sube nada**:

```
✗ BUILD FALLÓ — push cancelado.

[ERROR] [vite] ✗ Build failed
Unterminated string literal
  Location: src/pages/checkout.astro:64:2
```

## Comprobarlo a mano

```sh
cd storefront
npm run verify                 # build + tests
node check-scripts.cjs         # sintaxis de todos los <script> de las páginas
```

`check-scripts.cjs` es útil porque el error clásico de un `.astro`
(`Unterminated string literal`) solo aparece al compilar el bundle del
navegador, no en el frontmatter.

## Saltarlo

```sh
git push --no-verify
```

Úsalo solo si el fallo es ajeno al cambio (por ejemplo, un problema de red al
instalar). El deploy de Vercel volverá a compilar de todas formas.

## Nota sobre versiones de Node

Vercel usa **Node 22** (el `engines` de `package.json` pide `>=20`). El hook
prefiere esa versión si existe en la máquina; compilar con Node 24 y desplegar
con 22 es una fuente de diferencias difícil de diagnosticar.
