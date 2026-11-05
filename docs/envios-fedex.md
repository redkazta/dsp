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
| `FEDEX_ORIGIN_ZIP` | sí | bodega |
| `FEDEX_ORIGIN_CITY` | no | `Los Angeles` por defecto |
| `FEDEX_ORIGIN_STATE` | no | `CA` por defecto |
| `FEDEX_ORIGIN_COUNTRY` | no | `US` por defecto |
| `FEDEX_ORIGIN_ADDRESS` | no | aparece en la guía |
| `FEDEX_ORIGIN_COMPANY` | no | `Dinero Sobre Problemas` por defecto |
| `FEDEX_ORIGIN_PHONE` | no | recomendado para la guía |

Sin `FEDEX_CLIENT_ID`, `FEDEX_CLIENT_SECRET`, `FEDEX_ACCOUNT_NUMBER` y
`FEDEX_ORIGIN_ZIP` no se llama a FedEx: `isFedexConfigured()` → `false` y el
checkout usa la tarifa plana de `store_settings`.

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

## 3. Pendiente

- Selector de tarifa en el checkout: mostrar `options[]` y sumar la elegida
  al total. El endpoint ya responde; falta la UI y la re-cotización en
  `/api/checkout` para que el navegador no pueda alterar el monto.
- Opcionales no implementados: tracking público (`/track/v1/trackingnumbers`).
