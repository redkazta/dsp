# Estado del proyecto — pausas y pendientes

## Bloqueado (requiere acción externa)

**Login con Google** — pendiente de propagación en Google Cloud (tarda de 5 min a varias horas).
Verificar: Supabase → Authentication → Providers → Google tiene el toggle **Enable** activo y las keys guardadas.

---

## Pendientes elegidos por el usuario

### 1. Checkout con Stripe real — ✅ implementado (pendiente configurar)
- Hecho: pedido `pending` → Stripe Checkout alojado → webhook firmado → `confirmed`.
- Ver `docs/stripe.md`. Falta: aplicar `scripts/stripe_checkout.sql`, poner
  `STRIPE_SECRET_KEY`, `PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
  y `SUPABASE_SERVICE_ROLE_KEY` en Vercel, y crear el webhook en Stripe.
- Rollover: rotar la `sk_test_` que se compartió por chat.

### 3. Página de producto pulida (conversión)
- Zoom de imagen al hover
- Guía de tallas en modal
- "Últimas N piezas" cuando stock es bajo
- Barra de envío gratis progresiva (ya existe en el carrito flotante)
- Recomendados por categoría (ya existe el código base)

---

## Completado

- **Pedidos de punta a punta** (`scripts/orders_wishlist_payments.sql`):
  - Checkout con datos de contacto/envío, notas y **pago real con Stripe Checkout** (`lib/checkout.ts`, `pages/api/checkout.ts`, `pages/api/webhooks/stripe.ts`); la tarjeta se captura en Stripe.
  - Folio `DSP-000123`, historial automático por trigger y fotografía de cada pieza (nombre, talla, color, imagen) al momento de comprar.
  - Flujo sin stock: `pending → confirmed → design → preparing → ready → shipped → delivered`.
  - `/confirmacion` con línea de tiempo del pedido y `/cuenta` con seguimiento.
- **Panel admin de pedidos**: resumen por estatus, filtros, búsqueda, tarjetas expandidas con piezas, dirección, historial, guía de paquetería y notas internas; botones para mover el estado.
- **Carrito flotante y favoritos** (`components/store/StoreDrawer.astro`): panel lateral con pestañas, se abre desde el header y al agregar al producto. La wishlist se guarda por usuario en `wishlist_items` (localStorage sin sesión, se fusiona al entrar).
- **Registro homologado**: un solo formulario (`components/auth/AuthForm.astro`) para login y registro con nombre, apellidos, email, teléfono, fecha de nacimiento, contraseña + confirmación, marketing y términos.
  - Google y email crean el **mismo perfil** (`customer_profiles`) con campos idénticos y rol `customer`.
  - `ensureProfile()` en `lib/auth.ts` repara perfiles incompletos de Google (lee `given_name`/`family_name`).
  - Migración SQL: `scripts/profiles_homologate.sql`.
- **Botón de Google propio** (sin iframe): centrado, mismo estilo que el resto y sin íconos que se desordenan.
- **Diseño**: sin grises (`plata-*` hereda el color del texto), oro `#F2C94C`, bordes de 2px, tipografía más grande; `input-dark` y botones con `min-h-[52px]`/`56px` (evita zoom en iOS).
- **Responsividad**: header de 16/20, menú móvil accesible con targets de 52px, grids 2→3→4, carrito y checkout apilados, hero y secciones con paddings móviles.
- **SSR total** (`output: 'server'`): el middleware expone la sesión al header ("Mi cuenta" → `/cuenta` o `/entrar`), redirige `/entrar` y `/registro` a `/cuenta` si ya hay sesión.
- Slugs de producto + canonical + relacionados
- Auth de clientes (email/password + OAuth Google, este último bloqueado)
- Panel admin: dashboard, CRUD de productos, gestión de pedidos
- Datos reales de la marca (contenido Shopify)
- API .NET desplegada en Render (`dsp-gl11.onrender.com`)
