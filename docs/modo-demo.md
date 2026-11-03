# Precios de prueba a $0.65 USD (hardcodeado)

El sitio cobra y muestra **$0.65 USD por pieza**. No hay variable de entorno ni
interruptor en el panel: está fijado en código, a propósito, mientras se prueba
el flujo real de compra.

> **El mínimo lo pone la moneda de la cuenta.** Stripe liquida en **MXN** y
> exige **10 MXN** por cargo, validado con conversión:
>
> ```
> DEMO_PRICE ≥ 10 / tipo_de_cambio + margen
> ```
>
> Con 18.58 MXN/USD el piso ronda **$0.54**. Se usa **$0.65** para aguantar
> hasta 15.4 MXN/USD. Si Stripe responde
> `must convert to at least 1000 centavo`, sube el valor 0.05 y despliega.

## Dónde se cambia

`storefront/src/lib/demo.ts`

```ts
export const DEMO_PRICE = 0.65;   // ≥ 10 MXN convertidos
const PRICES_ARE_DEMO = true;    // ← false = precios reales de la base
```

Con `PRICES_ARE_DEMO = false` todo vuelve a los precios de `product_variants`
sin tocar otra línea. Requiere desplegar.

## Qué cambia

| Superficie | Efecto |
|---|---|
| Catálogo, ficha, favoritos, home, buscador | Todo precio > 0 se muestra como `$0.65` |
| Carrito y drawer | `$0.65` por pieza y subtotal recalculado |
| `/api/checkout` → Stripe | Cobra `0.65` por unidad |
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
3. Los pedidos hechos en pruebas quedan en `orders` con importes de 0.65.

## Cuidado con llaves live

Con llaves de producción cada prueba cobra dinero real y su comisión. Para
repetir pruebas sin costo, usa las llaves de **test** (`PUBLIC_STRIPE_ENV=test`)
— el mínimo de 10 MXN se valida igual, pero la tarjeta `4242 4242 4242 4242`
no mueve dinero.
