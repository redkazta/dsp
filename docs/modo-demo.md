# Modo demo de precios (APAGADO)

Los precios de prueba existen para recorrer el flujo de pago sin editar el
catálogo. **Ahora está apagado**: el sitio muestra y cobra los precios reales de
`product_variants` ($35.00 USD).

## Estado actual

`storefront/src/lib/demo.ts`

```ts
const PRICES_ARE_DEMO = false;  // ← apagado
export const DEMO_PRICE = 0.65; // solo se usa con el interruptor encendido
```

Con el interruptor apagado:
- `demoPrice()` devuelve el precio de la base tal cual.
- El envío vuelve a las reglas de `store_settings` ($15, gratis desde $150).
- Los cupones funcionan otra vez.
- El checkout no expone el detalle de Stripe al cliente.

## Si hay que volver a probar

1. Poner `PRICES_ARE_DEMO = true`.
2. Desplegar.
3. `DEMO_PRICE` debe quedar por encima del mínimo de Stripe convertido:
   la cuenta liquida en **MXN** y exige 10 MXN por cargo. Con 18.58 MXN/USD eso
   son ~$0.54; por eso el valor de trabajo es **0.65**.
4. Al terminar, volver a `false` y desplegar.

En modo demo no se modifica la base: los precios reales siguen intactos.

## Verificar que quedó en 35

`scripts/prices_35.sql` (idempotente) muestra el estado y fuerza `35.00` en
`products.base_price` y `product_variants.price` si algo quedó distinto.

## Historial

| Fecha | Cambio |
|---|---|
| 2026-11 | Demo a $0.06 → rechazado por Stripe (mínimo) |
| 2026-11 | Demo a $0.50 → rechazado (cuenta MXN, mínimo 10 MXN) |
| 2026-11 | Demo a $0.65 y cobro en MXN → probado end-to-end |
| 2026-11 | Demo apagado, precios reales de $35.00 |
