# Precios de prueba a $1.00 USD (hardcodeado)

El sitio cobra y muestra **$1.00 USD por pieza**. No hay variable de entorno ni
interruptor en el panel: está fijado en código, a propósito, mientras se prueba
el flujo real de compra.

> **¿Por qué no $0.06 ni $0.50?** La cuenta de Stripe liquida en **MXN** y exige
> un mínimo de **10 MXN** por cargo, validado con conversión:
> $0.50 USD ≈ $9.29 MXN → rechazado. $1.00 USD ≈ $18.58 MXN → pasa con margen.
> El piso real ronda $0.54 USD, pero el tipo de cambio se mueve; $1.00 no
depende del día.

## Dónde se cambia

`storefront/src/lib/demo.ts`

```ts
export const DEMO_PRICE = 1;      // nunca por debajo de ~0.55 con cuenta MXN
const PRICES_ARE_DEMO = true;    // ← false = precios reales de la base
```

Con `PRICES_ARE_DEMO = false` todo vuelve a los precios de `product_variants`
sin tocar otra línea. Requiere desplegar.

## Qué cambia

| Superficie | Efecto |
|---|---|
| Catálogo, ficha, favoritos, home, buscador | Todo precio > 0 se muestra como `$1.00` |
| Carrito y drawer | `$1.00` por pieza y subtotal recalculado |
| `/api/checkout` → Stripe | Cobra `1.00` por unidad |
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
total es menor al mínimo y devuelve un mensaje explícito en el log
(`[checkout] stripe session`). Así un precio de prueba demasiado bajo no vuelve
a fallar con el genérico "No pudimos iniciar el pago".

Ojo: el mínimo depende de la moneda de la **cuenta** de Stripe, no solo de USD.
Con cuenta MXN son 10 MXN por cargo.

## Antes de volver a vender

1. Poner `PRICES_ARE_DEMO = false` y desplegar.
2. Revisar que `PUBLIC_STRIPE_ENV=live` y las llaves `_LIVE` estén puestas.
3. Los pedidos hechos en pruebas quedan en `orders` con importes de 1.00.
