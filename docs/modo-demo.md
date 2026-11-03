# Modo demo (precios a $0.06 USD)

Sirve para probar el flujo completo (carrito → checkout → Stripe → correo →
confirmación) sin pagar precios reales. **No es una funcionalidad de negocio**:
es un interruptor de proyecto.

## Cómo se activa

```
PUBLIC_DEMO_MODE=true
```

- Se lee con `lib/demo.ts` (`isDemoMode()` / `demoPrice()`).
- Es una variable **de build** (`PUBLIC_*`): al cambiarla hay que volver a
  desplegar. En local basta con el `.env`.
- Acepta `true`, `1`, `yes`, `on`. Cualquier otro valor (o ausente) = apagado.

## Qué cambia

| Superficie | Efecto |
|---|---|
| Catálogo, ficha, favoritos, home, buscador | Todo precio > 0 se muestra como `$0.06` |
| Carrito y drawer | Precio y subtotal a `$0.06` por pieza |
| `/api/checkout` → Stripe | Cobra `0.06` por unidad (recalculado en servidor) |
| Envío | Gratis, sin barra de "envío gratis desde $150" |
| Cupones | Desactivados (`/api/coupon` responde que no aplican) |
| SEO | `<meta name="robots" content="noindex, nofollow">` en todas las páginas |
| `/admin` | **Sin cambios**: el panel sigue mostrando precios reales |
| Pedidos ya creados | Sin cambios: muestran lo que realmente se cobró |

El importe total de una compra de prueba es `0.06 × piezas`.

## Dónde se aplica (importante)

El precio nunca se toma del navegador:

1. `lib/pricing.ts` → `priceItems()` pasa cada precio por `demoPrice()`.
   Es lo que se cobra y lo que se guarda en `orders` / `order_items`.
2. `lib/pricing.ts` → `shippingCostFor()` devuelve `0`.
3. `lib/checkout.ts` → ignora cupones.

Las superficies de vitrina solo repiten ese valor:

- Server-rendered: `ProductCard`, `producto/[slug]`, `favoritos`, `home-products`, `BaseLayout` (drawer).
- APIs: `api/variant`, `api/search`, `api/wishlist`.
- Navegador: `lib/cart.ts` (`refreshCartPrices`).

## Cómo se apaga

Borra la variable o ponla en `false` y vuelve a desplegar. Los precios reales
salen de la base de datos: **no se modifica ningún producto ni variante**.

## Riesgos

- Un pedido hecho en demo queda en `orders` con importes de demo. Si se apaga
  el modo con pedidos abiertos, esos pedidos siguen mostrando `$0.06`.
- Stripe cobra de verdad (6 centavos) y devenga la comisión mínima. Si no
  quieres cargos, usa las tarjetas de prueba `4242 4242 4242 4242` en modo
  test (`sk_test_…`).
- No dejar activo en producción más tiempo del necesario: el `noindex` protege
  el SEO, pero los precios de vitrina serían falsos para cualquier visitante.
