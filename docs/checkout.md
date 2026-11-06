# Checkout

Flujo de compra de la tienda (`storefront/`). Usuarios registrados en
`/checkout` y `/confirmacion`; invitados en `/invitado/checkout` y
`/invitado/confirmacion`. Los precios, el stock y el envío se recalculan en
`/api/checkout`.

## 1. Dirección de envío: ZIP primero

El formulario de `components/checkout/CheckoutPage.astro` captura la dirección
en este orden:

| # | Campo | Regla |
|---|---|---|
| 1 | ZIP (`postalCode`) | Obligatorio. Formato `^\d{5}(-\d{4})?$` al enviar. Dispara el autocompletado. |
| 2 | Ciudad (`city`) | Autocompletada desde el ZIP; editable. Obligatoria. |
| 3 | Estado (`state`) | `select` con `SHIPPING_REGIONS` (solo `enabledForShipping`). Preseleccionado por el ZIP; editable. |
| 4 | `address_line1` (`street`) | Obligatorio. |
| 5 | `address_line2` (`colonia`) | Opcional. |
| 6 | Teléfono (`phone`) | Recomendado y hoy obligatorio en `/api/checkout` (FedEx lo pide para la guía). |
| 7 | `references` / `notes` | Obligatorios: el taller los necesita. |

El teléfono vive en la sección de dirección, después de `address_line2`,
porque el flujo lo pide ahí y `/api/checkout` lo exige junto con la dirección.

### Comportamiento del ZIP

- Al escribir cinco dígitos, o al perder el foco con `12345`/`12345-6789`, se
  llama a `GET /api/zipcode-lookup?zip=XXXXX`.
- Mientras se espera se muestra un bloque `.shimmer` (regla del proyecto: toda
  espera visible usa shimmer) junto al campo.
- Si el ZIP existe, se rellenan ciudad y estado y se avisa con un texto no
  bloqueante.
- Si el ZIP no existe o la llamada falla, no se bloquea nada: se **limpian
  solo los valores que había puesto el autocompletado** (marcados internamente
  con un flag) y el cliente escribe ciudad y estado a mano. Lo que el cliente
  escribió a mano **no se borra**. Así nunca se cotiza con el destino de un ZIP
  anterior.
- El estado solo se preselecciona si existe en el `select`. Si el ZIP apunta a
  una región apagada (`enabled_for_shipping = false`) o fuera de `us_regions`,
  se muestra una advertencia no bloqueante y el cliente elige manualmente.
- Cambiar el ZIP vuelve a consultar y actualiza ciudad/estado. El cliente puede
  editar ambos campos después del autocompletado; al hacerlo, esos campos dejan
  de considerarse “del ZIP” y no se limpiarán en la próxima consulta.
- El checkout **no muestra** el aviso de “no pudimos cotizar” cuando el destino
  está incompleto: solo cuando hubo una cotización real y FedEx no devolvió
  tarifas.

La lógica vive en `src/lib/zip-autocomplete.ts` y se prueba en
`tests/zip-autocomplete.test.ts`.

> La verificación real de la dirección sigue siendo manual en el panel
> (`/admin/pedidos`). Este autocompletado **no** valida que la dirección exista.

## 2. Catálogo local de ZIP codes

- Fuente: dataset público de Vega
  (`vega-datasets/data/zipcodes.csv`, ~42 049 filas).
- Archivo versionado: `data/us_zipcodes.json`, un arreglo de
  `{ zip, city, state }`.
- `src/lib/zipcodes.ts` lo importa una sola vez y construye
  `Map<string, { city, state }>` al arrancar el backend. El lookup es O(1) y no
  toca ninguna API externa.

### Endpoint

```
GET /api/zipcode-lookup?zip=76104
```

| Caso | Respuesta |
|---|---|
| ZIP válido y conocido | `200 { "city": "Fort Worth", "state": "TX" }` |
| ZIP con formato válido pero desconocido | `200 { "city": null, "state": null }` |
| Formato distinto de 5 dígitos | `400 { "error": "invalid_zip" }` |

Público, sin auth, solo lectura. Devuelve únicamente el resultado de la consulta:
el catálogo completo nunca sale del servidor.

### Actualizar el catálogo

```bash
# Descarga la fuente de Vega y regenera data/us_zipcodes.json
node scripts/build-us-zipcodes.mjs

# O desde un CSV local con columnas zip_code, city, state
node scripts/build-us-zipcodes.mjs ruta/al/zipcodes.csv
```

Después del cambio: commit del JSON, build y redeploy. No hay migración de base
de datos ni variable de entorno nueva.

## 3. Checkout por pasos

El formulario deja de ser una página larga: arriba se muestra el indicador de
pasos y solo se ve un contenedor a la vez.

| Paso | Contenido | Botones |
|---|---|---|
| 1 | Contacto (`firstName`, `lastName`, `email`) | Continuar |
| 2 | Dirección (ZIP, ciudad, estado, calle, `colonia`, teléfono, referencias, notas) y selector de tarifas FedEx | Volver · Continuar |
| 3 | Pago embebido (Stripe Payment Element) | Volver · Pagar |

- Los pasos se navegan con los botones o con las pestañas superiores. Hacia
  adelante se valida el paso actual con `validateFields(sección)`; hacia atrás
  no se valida nada.
- Los contenedores ocultos **no se desmontan**: conservan sus valores para que
  volver atrás no pierda datos.
- El paso 2 no permite continuar mientras hay una cotización en vuelo.
- El indicador usa `aria-current="step"` y anuncia el paso actual con
  `aria-live`. Toda espera usa `.shimmer` (incluido el esqueleto del pago).

## 4. Pago in-page (Stripe Payment Element)

- Al entrar al paso 3, el navegador llama a `POST /api/checkout`, que valida el
  carrito, re-cotiza el envío, crea el pedido `pending` y abre un
  **PaymentIntent**. La respuesta incluye `clientSecret`, `orderNumber` y
  `returnPath` (nunca una URL de redirección).
- El checkout carga `https://js.stripe.com/v3/` y monta el **Payment Element**
  dentro de `#payment-element` con la apariencia de la marca. La tarjeta se
  captura en el iframe de Stripe: el PAN nunca pasa por nuestro servidor.
- `confirmPayment` usa `redirect: 'if_required'` (3DS se resuelve en Stripe).
  Al terminar, el cliente vuelve a `/confirmacion` o `/invitado/confirmacion`
  con `?order=…&payment_intent=pi_…`.
- El monto se fija en servidor: el `amount` del PaymentIntent sale del total
  recalculado (`priceItems` + envío re-cotizado), no del navegador. Si el envío
  cambió, `/api/checkout` responde `409 SHIPPING_CHANGED` y el cliente confirma
  el nuevo precio antes de crear el pago.
- Si el carrito cambia en otra pestaña, el Payment Element se desmonta y, si el
  cliente sigue en el paso 3, se pide un PaymentIntent nuevo.
- Al volver, `confirmPaymentIntentOnReturn` consulta el PaymentIntent con la
  llave secreta y aplica el pago si `status = succeeded`; el webhook
  `payment_intent.succeeded` hace lo mismo por si el cliente no vuelve.

## 5. Envío y pago (reglas)

- Con FedEx configurado, el checkout cotiza en `/api/shipping/quote` y
  `/api/checkout` re-cotiza en servidor. Detalle en
  [`docs/envios-fedex.md`](envios-fedex.md).
- El selector muestra el tiempo estimado de cada servicio. Si FedEx no devuelve
  compromiso (sandbox), se usan días de respaldo y la opción se marca
  “estimado”.
- Sin FedEx, se aplica la tarifa plana de `store_settings`.
- El pago se captura in-page con Stripe; el pedido se crea antes de confirmar
  el pago y solo se marca pagado con el evento o la consulta server-side.
