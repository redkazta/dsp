# Precios de prueba a $0.65 USD (hardcodeado)

La tienda sigue operando en **USD**: se muestra y se cobra en dólares. El precio
de demo es el mínimo de Stripe convertido a dólares, con un colchón para el tipo
de cambio. No hay variable de entorno ni interruptor en el panel.

> **El mínimo lo pone la moneda de la cuenta.** Stripe liquida en **MXN** y exige
> 10.00 MXN por cargo, validado con conversión. No se puede cobrar en pesos
> porque la tienda maneja USD, así que el piso se traduce:
>
> ```
> DEMO_PRICE_USD = 10 / tipo_de_cambio + margen
> ```
>
> Hoy (18.58 MXN/USD) el piso exacto es **$0.54**; se usa **$0.65** para que
> aguante hasta 15.4 MXN/USD. Si Stripe responde
> `must convert to at least 1000 centavo`, sube 0.05 aquí y despliega.

## Dónde se cambia

`storefront/src/lib/demo.ts`

```ts
export const DEMO_PRICE = 0.65;  // 10 MXN convertidos a USD
const PRICES_ARE_DEMO = true;    // ← false = precios reales de la base
```

Con `PRICES_ARE_DEMO = false` todo vuelve a los precios de `product_variants`
sin tocar otra línea. Requiere desplegar.

## Qué cambia

| Superficie | Efecto |
|---|---|
| Catálogo, ficha, favoritos, home, buscador | Todo precio > 0 se muestra como `$0.65` |
| Carrito y drawer | `$0.65` por pieza y subtotal recalculado |
| `/api/checkout` → Stripe | Sesión en **USD** por `0.65` por unidad |
| Envío | Gratis, sin barra de "envío gratis desde $150" |
| Cupones | Desactivados (`/api/coupon` responde que no aplican) |
| `/admin` | **Sin cambios**: el panel muestra y edita los precios reales |
| Pedidos ya creados | Sin cambios: muestran lo que realmente se cobró |

## Dónde se aplica

El precio nunca se toma del navegador:

1. `lib/pricing.ts` → `priceItems()` pasa cada precio por `demoPrice()`.
   Es lo que se cobra y lo que se guarda en `orders` / `order_items`.
2. `lib/pricing.ts` → `shippingCostFor()` devuelve `0`.
3. `lib/checkout.ts` → ignora cupones y mantiene `CURRENCY` (USD).

Superficies que solo repiten ese valor:

- Server-rendered: `ProductCard`, `producto/[slug]`, `favoritos`, `home-products`, `BaseLayout` (drawer), `index`.
- APIs: `api/variant`, `api/search`, `api/wishlist`.
- Navegador: `lib/cart.ts` (`refreshCartPrices`).

## Red de seguridad

`lib/stripe.ts` → `assertStripeMinimum(total, currency)` corta antes de llamar
a Stripe si el total no llega al mínimo de esa moneda (USD 0.50, MXN 10.00) y
devuelve un mensaje explícito. El motivo real de un fallo de Stripe se muestra
en la pantalla de checkout mientras el modo demo esté activo.

## Antes de volver a vender

1. Poner `PRICES_ARE_DEMO = false` y desplegar.
2. Revisar que `PUBLIC_STRIPE_ENV=live` y las llaves `_LIVE` estén puestas.
3. Los pedidos de prueba quedan en `orders` con importe de 0.65.

## Cuidado con llaves live

Con llaves de producción cada prueba cobra ~0.65 USD reales más comisión. Para
repetir pruebas sin costo, usa `PUBLIC_STRIPE_ENV=test` y la tarjeta
`4242 4242 4242 4242`: el mínimo se valida igual, pero no se mueve dinero.
