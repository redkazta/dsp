# Estado del proyecto — pausas y pendientes

## Bloqueado (requiere acción externa)

**Login con Google** — pendiente de propagación en Google Cloud (tarda de 5 min a varias horas).
Verificar: Supabase → Authentication → Providers → Google tiene el toggle **Enable** activo y las keys guardadas.

---

## Pendientes elegidos por el usuario

### 1. Checkout completo con Stripe
- Crear `order` + `order_items` desde el checkout
- Descontar stock al confirmar pago
- Webhook `checkout.session.completed` que marca el pedido pagado
- `/confirmacion` leyendo el `session_id`
- Conectar `/checkout` → API Render → Stripe

### 3. Página de producto pulida (conversión)
- Zoom de imagen al hover
- Guía de tallas en modal
- "Últimas N piezas" cuando stock es bajo
- Barra de envío gratis progresiva ("te faltan $X")
- Recomendados por categoría (ya existe el código base)

---

## Completado

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
