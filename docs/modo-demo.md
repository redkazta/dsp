# Precios de prueba a $0.50 USD (hardcodeado)

El sitio cobra y muestra **$0.50 USD por pieza**. No hay variable de entorno ni
interruptor en el panel: está fijado en código, a propósito, mientras se prueba
el flujo real de compra.

> **¿Por qué no $0.06?** Stripe rechaza cualquier cargo menor a **$0.50 USD**
> (mínimo por pago, aplica también en modo test). Con 6 centavos el checkout
> responde *"No pudimos iniciar el pago"*. No hay forma de cobrar menos.

## Dónde se cambia

`storefront/src/lib/demo.ts`

```ts
export const DEMO_PRICE = 0.5;   // nunca por debajo de 0.50
const PRICES_ARE_DEMO = true;    // ← false = precios reales de la base
```

Con `PRICES_ARE_DEMO = false` todo vuelve a los precios de `product_variants`
sin tocar otra línea. Requiere desplegar.

## Qué cambia

| Superficie | Efecto |
|---|---|
| Catálogo, ficha, favoritos, home, buscador | Todo precio > 0 se muestra como `$0.50` |
| Carrito y drawer | `$0.50` por pieza y subtotal recalculado |
| `/api/checkout` → Stripe | Cobra `0.50` por unidad |
| Envío | Gratis, sin barra de "envío gratis desde $150" |
| Cupones | Desactivados (`/api/coupon` responde que no aplican) |
| `/admin` | **Sin cambios**: el panel muestra y edita los precios reales |
| Pedidos ya creados | Sin cambios: muestran lo que realmente se cobró |

## Dónde se aplica

El precio nunca se toma del navegador:

1. `lib/pricing.ts` → `priceItems()` pasa cada precio por `demoPrice()`.
   Es lo que se cobra y lo que se guarda en `orders` / `order_items`.
2. `lib/pricing.ts` → `shippingCostFor()` devuelve `0`.
3. `lib/checkout.ts` → ignora cupones.

Las superficies de vitrina solo repiten ese valor:

- Server-rendered: `ProductCard`, `producto/[slug]`, `favoritos`, `home-products`, `BaseLayout` (drawer).
- APIs: `api/variant`, `api/search`, `api/wishlist`.
- Navegador: `lib/cart.ts` (`refreshCartPrices`).

## Red de seguridad

`lib/stripe.ts` → `assertStripeMinimum()` corta antes de llamar a Stripe si el
total es menor a $0.50 y devuelve un mensaje explícito en el log
(`[checkout] stripe session`). Así un precio de prueba demasiado bajo no vuelve
a fallar con el genérico "No pudimos iniciar el pago".

## Antes de volver a vender

1. Poner `PRICES_ARE_DEMO = false` y desplegar.
2. Revisar que `PUBLIC_STRIPE_ENV=live` y las llaves `_LIVE` estén puestas.
3. Los pedidos hechos en pruebas quedan en `orders` con importes de 0.50.
