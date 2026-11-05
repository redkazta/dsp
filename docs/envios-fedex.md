# Envíos: direcciones de EE. UU. y FedEx (MVP)

Alcance: **solo EE. UU.**, montos en **USD**. No hay envíos internacionales ni
otras monedas.

## 1. Direcciones (sin validación automática)

- `lib/us.ts` es el **catálogo único**: 50 estados + DC + territorios (PR, GU,
  VI, AS, MP) con `type` y `enabledForShipping`.
  Se eligió **JSON versionado** (opción permitida por el requerimiento) en vez de
  una tabla: cambia poco, no necesita CRUD y es imposible que checkout y admin
  se desincronicen.
- Checkout: select con `SHIPPING_REGIONS` (solo habilitadas). Admin: `US_REGIONS`
  completas para corregir pedidos históricos.
- Validación **solo de formato**: región del catálogo, ZIP `^\d{5}(-\d{4})?$`,
  obligatorios y longitudes máximas. Cero llamadas a Google/SmartyStreets/USPS.
- El checkout pide **primero el ZIP** y autocompleta ciudad/estado desde el
  catálogo local de ZIP codes (`/api/zipcode-lookup`). El cliente puede
  corregirlos. Detalle en [`docs/checkout.md`](checkout.md).
- El formulario usa `autocomplete` HTML solo para el autofill del navegador.
- Aviso no bloqueante de PO Box / APO-FPO-DPO.
- La dirección se guarda tal cual con `address_verification_status = 'pending'`.

### Verificación manual

`/admin/pedidos` → **Editar / verificar dirección**:

| Estado | Significado |
|---|---|
| `pending` | Capturada, sin revisar |
| `verified` | Revisada y coincide |
| `corrected` | Se corrigió |
| `invalid` | No se puede enviar; bloquea la guía |

Cada campo modificado se registra en `order_address_audit` (quién, cuándo,
valor anterior y nuevo). SQL: `scripts/address_verification.sql`.

## 2. FedEx — Rates + Ship (MVP)

Todo en backend (`lib/fedex.ts`). Credenciales solo por entorno.

### Variables

| Variable | Obligatoria | Nota |
|---|---|---|
| `FEDEX_CLIENT_ID` | sí | FedEx Developer Portal |
| `FEDEX_CLIENT_SECRET` | sí | FedEx Developer Portal |
| `FEDEX_ACCOUNT_NUMBER` | sí | contrato FedEx |
| `FEDEX_BASE_URL` | no | sandbox por defecto |
| `FEDEX_ORIGIN_ZIP` | sí | bodega: `76104` |
| `FEDEX_ORIGIN_CITY` | sí | bodega: `Fort Worth` |
| `FEDEX_ORIGIN_STATE` | sí | bodega: `TX` |
| `FEDEX_ORIGIN_COUNTRY` | no | `US` por defecto; otro valor desactiva FedEx |
| `FEDEX_ORIGIN_ADDRESS` | no | aparece en la guía |
| `FEDEX_ORIGIN_COMPANY` | no | `Dinero Sobre Problemas` por defecto |
| `FEDEX_ORIGIN_PHONE` | no | recomendado para la guía |

Sin `FEDEX_CLIENT_ID`, `FEDEX_CLIENT_SECRET`, `FEDEX_ACCOUNT_NUMBER` y
`FEDEX_ORIGIN_ZIP` no se llama a FedEx: `isFedexConfigured()` → `false` y el
checkout usa la tarifa plana de `store_settings`.

**Coherencia del origen:** `FEDEX_ORIGIN_CITY` y `FEDEX_ORIGIN_STATE` son
obligatorias en cuanto existe `FEDEX_ORIGIN_ZIP`. Si faltan, si el ZIP no tiene
formato de EE. UU. o si el país no es `US`, `fedexConfig()` devuelve `null`,
se registra un warning (`[fedex] … No se cotiza con FedEx.`) y el checkout cae a
la tarifa plana. **Nunca se envía un shipper con el ZIP de una ciudad y el
nombre de otra.**

Origen real de la tienda (Fort Worth, TX):

```
FEDEX_ORIGIN_ZIP=76104
FEDEX_ORIGIN_CITY=Fort Worth
FEDEX_ORIGIN_STATE=TX
FEDEX_ORIGIN_COUNTRY=US
```

### Entornos

| Entorno | `FEDEX_BASE_URL` |
|---|---|
| Sandbox | `https://apis-sandbox.fedex.com` |
| Producción | `https://apis.fedex.com` |

### OAuth 2.0

`POST {baseUrl}/oauth/token` con `grant_type=client_credentials`,
`client_id` y `client_secret` en `application/x-www-form-urlencoded`. El token
dura 60 min; se cachea en memoria **55 min** y se renueva antes de expirar
(`accessToken()`). Cada llamada lleva `Authorization: Bearer <token>`.

### Tarifas

- `POST /rate/v1/rates/quotes` con `rateRequestType: ["ACCOUNT","LIST"]`,
  `preferredCurrency: "USD"`, `packageCount` y `requestedPackageLineItems[]`.
- Se usa la tarifa `rateType = ACCOUNT` (negociada) en USD; si no viene, la
  primera en USD. Se descartan monedas distintas de USD y los servicios
  internacionales / de carga.
- Caché en memoria 10 min por origen/destino/peso/medidas. **Nunca en BD**.
- Timeout 4 s. Si falla, `ok: false` y la compra sigue con tarifa plana.
- Los logs no incluyen direcciones ni tarifas (solo `errors[]`/`warnings[]`).

`POST /api/shipping/quote` (`{ zip, city, state?, items }`) →
`{ configured, options[] }`.

### Selector de tarifas en el checkout

1. El cliente captura ZIP + estado (y ciudad). El navegador espera 500 ms tras
   el último cambio y llama a `/api/shipping/quote`; mientras espera pinta
   skeletons `.shimmer` con la misma forma que las tarjetas finales.
2. Se listan los servicios con **nombre, precio USD y tiempo estimado**
   (marcado como "estimado"). La opción más barata queda seleccionada.
3. Si no hay destino válido, envío gratis o FedEx no está configurado, se
   aplica la tarifa plana de `store_settings` y no se muestra el selector.
4. Si la cotización falla, se muestra el aviso de tarifa estándar; el checkout
   nunca se bloquea.

Al pagar, el navegador manda `shipping: { productCode, amount }`.
`/api/checkout` **re-cotiza siempre en el servidor** con el destino capturado y
la cantidad de piezas (un paquete por pieza, `lib/shipping.ts`).

- El monto que se cobra es el de la cotización del servidor, nunca el del
  navegador.
- Si el importe cotizado difiere del que vio el cliente, la API responde `409
  SHIPPING_CHANGED` con el nuevo importe; el checkout lo muestra en un diálogo
  y, si el cliente acepta, reintenta con `acceptShippingChange: true`.
- Si FedEx falla en la re-cotización, se cobra la tarifa plana.

Se guarda en el pedido: `shipping_method` = `productCode` del servicio,
`shipping_cost` = importe cotizado en USD, `carrier` = `FedEx` y la dirección /
ZIP capturados (`shipping_street`, `shipping_city`, `shipping_state`,
`shipping_postal_code`).

### ZIPs de prueba (sandbox, origen 76104)

| Destino | ZIP |
|---|---|
| New York, NY | `10001` |
| Los Angeles, CA | `90001` |
| Chicago, IL | `60601` |
| Miami, FL | `33101` |
| Seattle, WA | `98101` |

### Verificación en sandbox

El flujo se probó en sandbox desde Fort Worth, TX (`76104`) hacia los cinco
ZIPs de prueba: OAuth, tarifas y las seis opciones domésticas respondieron en
USD. Ya **no existe ningún endpoint temporal**: el checkout usa
`/api/shipping/quote` y `/api/checkout`, y las guías `/api/admin/shipment`.

### Guías

`POST /api/admin/shipment` (`{ orderId, productCode? }`):

- Solo staff y solo si la dirección está `verified` o `corrected`; si está
  `pending` o `invalid` responde 409.
- `POST /ship/v1/shipments` con `labelResponseOptions: "LABEL"`,
  `labelSpecification` (`COMMON2D`, `PDF`, `PAPER_85X11`) y
  `shippingChargesPayment` del sender.
- Shipper de la bodega; recipient residencial con la dirección capturada.
- Lee `output.transactionShipments[].masterTrackingNumber` y los
  `pieceResponses[].packageDocuments[]` (base64) → sube el PDF al bucket
  **`shipping-labels`** → guarda `shipping_label_url` y `tracking_number`.
- Envía la guía al cliente por correo con el PDF adjunto (Resend).
- Si FedEx rechaza la dirección, el pedido pasa a `invalid` y se avisa al
  operador.

Crear el bucket antes de usar guías: Supabase → Storage → **New bucket** →
`shipping-labels` (public, o privado si prefieres URLs firmadas).

### Errores

FedEx responde `errors[]` y `warnings[]` incluso en respuestas 2xx. Ambos se
parsean y se loguean; un `status >= 400` se convierte en `ok: false` con motivo
(`upstream_error`, `address_rejected`, `no_rates`, `invalid_zip`).

La respuesta cruda de FedEx no se expone al navegador ni se loguea: solo se
traduce a opciones (`productCode`, nombre, importe USD y tiempo estimado).

### Paso a producción (no ejecutar sin confirmación)

Cuando el usuario lo autorice:

1. En el **FedEx Developer Portal**, proyecto de producción, copiar el
   **Production Key** y **Production Secret**. Las credenciales de sandbox no
   funcionan en producción (ni al revés).
2. En Vercel → Settings → Environment Variables, con scope **Production**:

   ```
   FEDEX_BASE_URL=https://apis.fedex.com
   FEDEX_CLIENT_ID=<production key>
   FEDEX_CLIENT_SECRET=<production secret>
   FEDEX_ACCOUNT_NUMBER=<cuenta real>
   ```

   `FEDEX_ORIGIN_*` se mantienen: `76104` / `Fort Worth` / `TX` / `US`.
3. **Redeploy.** Las variables no llegan a un deployment ya creado; el token en
   caché (55 min) también se reinicia con la instancia nueva.
4. Probar una cotización real desde el checkout y generar una guía de prueba.

## 3. Pendiente

- Tracking público desde la tienda (`/track/v1/trackingnumbers`).
- Cambio a `FEDEX_BASE_URL=https://apis.fedex.com` con credenciales de
  producción, cuando el usuario lo confirme.
