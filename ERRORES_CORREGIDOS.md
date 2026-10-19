# Errores corregidos en el proyecto DSP

Regla general: antes de subir, `cd storefront && npm run build`. Los errores de
esta lista llegaron a producción por no correr el build local.

## 2026-10 — Revisión de seguridad y checkout

### 1. Scripts duplicados y `<style>` fuera de lugar en `BaseLayout`
- Síntoma: dos `<script>` idénticos y un `<style>` entre `</html>` y un bloque `---`.
- Solución: layout consolidado: una sola página de script y estilos en el `<head>`-adyacente.
- Archivo: `storefront/src/layouts/BaseLayout.astro`

### 2. Interpolación de `${…}` en el HTML del template
- Síntoma: `${FREE_SHIPPING_THRESHOLD…}` y `${p.price…}` se imprimían literales.
- Solución: usar `{ … }` de Astro o resolverlo en el frontmatter.
- Archivos: `pages/carrito.astro`

### 3. Precio del pedido confiado al navegador
- Síntoma: el checkout insertaba en `orders`/`order_items` con precios de
  `localStorage`, así que se podía comprar a cualquier precio.
- Solución: `/api/orders` recalcula desde `product_variants`, decide el comprador
  por sesión y valida la tarjeta en servidor. El navegador solo manda
  `{ variantId, qty }` + datos de contacto.
- Archivos: `pages/api/orders.ts`, `lib/pricing.ts`, `lib/card.ts`, `pages/checkout.astro`

### 4. Cualquier usuario con `role='admin'` en su perfil entraba al panel
- Solución: `is_admin()` exige además estar en `staff_allowlist` (por correo);
  el middleware oculta `/admin` (404) a quien no califica.
- Archivos: `scripts/security_checkout_fixes.sql`, `src/middleware.ts`

### 5. El botón "Finalizar compra" tenía `href` relativo y se rompía en `/producto/...`
- Solución: ruta absoluta `/checkout`.
- Archivo: `components/store/StoreDrawer.astro`

### 6. En móvil no había acceso al carrito ni a favoritos (solo hover)
- Solución: los botones flotantes se ocultan en <1024px y el menú lateral
  muestra Favoritos / Carrito / Buscar con contadores.
- Archivo: `layouts/BaseLayout.astro`

### 7. Órdenes "Aún no tienes pedidos" aunque existieran
- Causa: `/confirmacion` y `/cuenta` cargaban client-side y el folio
  (`DSP-001042`) no es UUID, así que la consulta por `id` nunca coincidía.
- Solución: lectura SSR por `order_number` o UUID en `lib/customer-orders.ts`.
- Archivos: `pages/cuenta.astro`, `pages/confirmacion.astro`

### 8. `payments.provider` no aceptaba 'simulated'
- Síntoma: el insert del pago fallaba silenciosamente (check constraint).
- Solución: restricción ampliada en SQL. El código ya no depende de ella para
  cerrar la venta (el pago es best-effort).
- Archivo: `scripts/security_checkout_fixes.sql`

### 9. Wishlist: el precio mostrado en el drawer venía de `localStorage` sin verificar
- Solución: `initWishlistView()` toma la lista SSR y solo fusiona lo local.
  `toggleWishlist()` manda únicamente `productId`; el servidor lee nombre/precio.
- Archivos: `lib/wishlist.ts`, `lib/wishlist-local.ts`, `pages/api/wishlist.ts`

### 10. HTML inyectado sin escapar en drawer, carrito, cuenta, favoritos y admin
- Solución: `lib/html.ts` (`escapeHtml`, `safeUrl`) aplicado a todo dato de Supabase
  o del usuario que se interpola en `innerHTML`.
- Archivos: `lib/html.ts` y los componentes que pintan listas.

### 11. `data-autosubmit` en `<select>` sin listener
- Síntoma: cambiar el orden en `/tienda` no hacía nada.
- Solución: listener en `tienda.astro` y filtro de precio por URL compartible.

### 12. Accesos inexistentes en `BaseLayout` (`#header-wishlist`, `#header-cart`)
- Solución: eliminados; los contadores reales viven en `StoreDrawer` y el menú móvil.

### 13. Fotos de producto desalineadas en el grid
- Síntoma: cada tarjeta mostraba la prenda en un tamaño y encuadre distinto.
- Solución: colección normalizada a cuadrados 1200×1200 (prenda centrada, 33 %
  del área, margen 12 %) y marco `.product-frame` (1:1 + `object-contain`) que
  mantiene alineado cualquier archivo nuevo.
- Archivos: `public/img/*`, `docs/IMAGENES_PRODUCTO.md`, `src/styles/global.css`.

---

## Historial anterior

### 1. Build error: "Cannot use \"||\" with \"??\" without parentheses" (commit `9d2d54b`)
- `middleware.ts`: usar paréntesis al mezclar `||` y `??`.

### 2. Build error: "Could not resolve \"../lib/auth\""
- `components/auth/AuthForm.astro`: import correcto `../../lib/auth`.

### 3. Build error: "Expected \"(\" but found \"type\"" (commit `001e8a8`)
- `pages/api/orders.ts`: tipar `request` y `cookies` explícitamente.

### 4. Parámetros `any` implícitos (commit `001e8a8`)
- `lib/supabase-server.ts`, `lib/admin.ts`: tipos explícitos en callbacks.

### 5. "Could not resolve \"../../lib/supabase\"" (commit `e2a120d`)
- `layouts/BaseLayout.astro`: ruta a `../lib/supabase`.

## Regla para evitar repetir errores
- `??` para valores por defecto; nunca mezclarlo con `||` sin paréntesis.
- Tipos explícitos en callbacks de `.filter()` / `.map()` / `.reduce()`.
- Verificar rutas: `../` sube un nivel, `../../` sube dos.
- En `.astro`: el HTML usa `{expr}`; las plantillas de JS usan `${expr}`.
- Correr `npm run build` antes de cada deploy.
