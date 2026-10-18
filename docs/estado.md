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

- Slugs de producto + canonical + relacionados
- Auth de clientes (email/password + OAuth Google, este último bloqueado)
- Panel admin: dashboard, CRUD de productos, gestión de pedidos
- Datos reales de la marca (contenido Shopify)
- API .NET desplegada en Render (`dsp-gl11.onrender.com`)
