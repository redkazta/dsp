# Precios de prueba a $0.06 USD (hardcodeado)

El sitio cobra y muestra **0.06 USD por pieza**. No hay variable de entorno ni
interruptor en el panel: está fijado en código, a propósito, mientras se prueba
el flujo real de compra.

## Dónde se cambia

`storefront/src/lib/demo.ts`

```ts
export const DEMO_PRICE = 0.06;
const PRICES_ARE_DEMO = true;   // ← false = precios reales de la base
```

Con `PRICES_ARE_DEMO = false` todo vuelve a los precios de `product_variants`
sin tocar otra línea. Requiere desplegar.

## Qué cambia

| Superficie | Efecto |
|---|---|
| Catálogo, ficha, favoritos, home, buscador | Todo precio > 0 se muestra como `$0.06` |
| Carrito y drawer | `$0.06` por pieza y subtotal recalculado |
| `/api/checkout` → Stripe | Cobra `0.06` por unidad |
| Envío | Gratis, sin barra de "envío gratis desde $150" |
| Cupones | Desactivados (`/api/coupon` responde que no aplican) |
| `/admin` | **Sin cambios**: el panel muestra y edita los precios reales |
| Pedidos ya creados | Sin cambios: muestran lo que realmente se cobró |

Una compra de prueba cuesta `0.06 × piezas`.

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

## Antes de volver a vender

1. Poner `PRICES_ARE_DEMO = false` y desplegar.
2. Revisar que Stripe no esté en modo test.
3. Los pedidos hechos en pruebas quedan en `orders` con importes de 0.06.
