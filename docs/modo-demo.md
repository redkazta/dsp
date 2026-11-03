# Precios de prueba a 10 MXN (hardcodeado)

Cada artículo cuesta **exactamente 10.00 MXN**, que es el mínimo que Stripe
acepta por cargo en una cuenta que liquida en pesos. No hay variable de entorno
ni interruptor en el panel.

> **Por qué se cobra en MXN y no en USD.** Stripe valida el mínimo convertido a
> la moneda de la cuenta. En USD habría que acertar el tipo de cambio (10 MXN ≈
> $0.54 con 18.58 MXN/USD) y cualquier movimiento del peso rompería el checkout.
> Cobrando en MXN el importe es exacto: 1000 centavos = 10.00 MXN.

## Dónde se cambia

`storefront/src/lib/demo.ts`

```ts
export const DEMO_PRICE = 10;       // MXN
export const DEMO_CURRENCY = 'MXN'; // moneda de la sesión de pago
const PRICES_ARE_DEMO = true;       // ← false = precios reales de la base
```

Con `PRICES_ARE_DEMO = false` todo vuelve a los precios de `product_variants`
en USD, sin tocar otra línea. Requiere desplegar.

## Qué cambia

| Superficie | Efecto |
|---|---|
| Catálogo, ficha, favoritos, home, buscador | Todo precio > 0 se muestra como `$10.00` |
| Carrito y drawer | `$10.00` por pieza y subtotal recalculado |
| `/api/checkout` → Stripe | Sesión en **MXN** por `10.00` por unidad |
| Envío | Gratis, sin barra de "envío gratis desde $150" |
| Cupones | Desactivados (`/api/coupon` responde que no aplican) |
| `/admin` | **Sin cambios**: el panel muestra y edita los precios reales en USD |
| Pedidos ya creados | Sin cambios: muestran lo que realmente se cobró |

En México `$10.00` se lee como pesos, así que la vitrina no se ve extraña.

## Dónde se aplica

El precio nunca se toma del navegador:

1. `lib/pricing.ts` → `priceItems()` pasa cada precio por `demoPrice()`.
   Es lo que se cobra y lo que se guarda en `orders` / `order_items`.
2. `lib/pricing.ts` → `shippingCostFor()` devuelve `0`.
3. `lib/checkout.ts` → moneda de la sesión `MXN` y cupones ignorados.

Superficies que solo repiten ese valor:

- Server-rendered: `ProductCard`, `producto/[slug]`, `favoritos`, `home-products`, `BaseLayout` (drawer), `index`.
- APIs: `api/variant`, `api/search`, `api/wishlist`.
- Navegador: `lib/cart.ts` (`refreshCartPrices`).

## Red de seguridad

`lib/stripe.ts` → `assertStripeMinimum(total, currency)` corta antes de llamar
a Stripe si el total no llega al mínimo de esa moneda (USD 0.50, MXN 10.00) y
devuelve un mensaje explícito. El detalle de un fallo de Stripe se muestra en
la pantalla de checkout mientras el modo demo esté activo.

## Antes de volver a vender

1. Poner `PRICES_ARE_DEMO = false` y desplegar.
2. Revisar que `PUBLIC_STRIPE_ENV=live` y las llaves `_LIVE` estén puestas.
3. Los pedidos de prueba quedan en `orders` con importe de 10.

## Cuidado con llaves live

Con llaves de producción cada prueba cobra 10 MXN reales más comisión. Para
repetir pruebas sin costo, usa `PUBLIC_STRIPE_ENV=test` y la tarjeta
`4242 4242 4242 4242`: el mínimo se valida igual, pero no se mueve dinero.
