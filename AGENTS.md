# Convenciones del proyecto

Reglas que aplican a todo cambio en el storefront (`storefront/`).

## Carga y esperas
- **Toda espera visible usa shimmer.** Clase global `.shimmer` (en
  `src/styles/global.css`): bloque con barrido animado y `prefers-reduced-motion`
  respetado. No inventar spinners sueltos ni textos de "cargando" sin forma.
- **El esqueleto copia la forma final**: mismos contenedores, mismos paddings y
  las mismas alturas (thumbnail, líneas de texto, botones). Sirve para que el
  espacio quede reservado y la página no salte.
- **Nada de doble render**: pintar una vez con los datos listos (ver
  `carrito.astro`: `paint()` único + fallback de 1.5 s).
- Cambios de filtros/orden en `/tienda` se hacen **sin recargar**: fetch de la
  misma URL + swap de `#shop-live` (`tienda.astro`).

## Color y contraste
- **Sin grises** para bordes ni texto: blanco con opacidad (`text-white/80`,
  `border-white/40`) o los colores de marca (oro `#FFE28A`, negro).
- Botón dorado → letra negra. Botón outline → letra y borde blancos.

## Rutas e idioma
- Nunca escribir una ruta interna a mano: `localize(lang, key)` en servidor y
  `route(key)` en scripts de navegador (`src/lib/routes.ts`).
- Productos siempre por **slug** y con la ruta del idioma activo:
  `/producto/<slug>` ↔ `/product/<slug>`.
- Los slugs/ids que llegan por URL se resuelven en servidor; no confiar en el
  navegador para precios ni stock.

## Checkout
- Usuarios registrados: `/checkout` y `/confirmacion` (privadas).
- Invitados: `/invitado/checkout` y `/invitado/confirmacion` (públicas,
  autorizadas por el `session_id` de Stripe).
- Los precios y el stock se recalculan en `/api/checkout`.

## Env
- Secretos del servidor con `serverEnv()` (`src/lib/env.ts`), nunca
  `import.meta.env` directo: se graba en build y queda `undefined` en runtime.
- `PUBLIC_*` sí son de build: cambiarlas exige redeploy.

## Base de datos
- Los scripts SQL nuevos van en `scripts/` y deben ser **idempotentes**.
- Tras un DDL: `NOTIFY pgrst, 'reload schema';`.
