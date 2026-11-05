# Envíos: direcciones de EE. UU. y DHL Express (MVP)

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

## 2. DHL Express — MyDHL API v3.4.1

Todo en backend (`lib/dhl.ts`). Credenciales solo por entorno.

### Variables

| Variable | Ejemplo | Nota |
|---|---|---|
| `DHL_API_KEY` | `abc123` | Developer Portal |
| `DHL_API_SECRET` | `xyz789` | Developer Portal |
| `DHL_ACCOUNT_NUMBER` | `123456789` | contrato DHL Express |
| `DHL_API_BASE_URL` | ver tabla de entornos | test por defecto |
| `DHL_ORIGIN_ZIP` | `90001` | bodega |
| `DHL_ORIGIN_CITY` | `Los Angeles` | bodega |
| `DHL_ORIGIN_COUNTRY` | `US` | bodega |
| `DHL_ORIGIN_ADDRESS` | `123 Main St` | aparece en la guía |
| `DHL_ORIGIN_COMPANY` | `Dinero Sobre Problemas` | guía |
| `DHL_ORIGIN_PHONE` | `+1...` | obligatorio para DHL |

Sin `DHL_API_KEY`, `DHL_API_SECRET`, `DHL_ACCOUNT_NUMBER` y `DHL_ORIGIN_ZIP`
no se llama a DHL: `isDhlConfigured()` → `false` y el checkout usa la tarifa
plana de `store_settings`.

### Entornos

| Entorno | `DHL_API_BASE_URL` |
|---|---|
| Test (500 invocaciones/día) | `https://express.api.dhl.com/mydhlapi/test` |
| Producción | `https://express.api.dhl.com/mydhlapi` |
| Mock (UI y automatizadas) | `https://api-mock.dhl.com/mydhlapi` |

Usa el **mock** para pruebas de UI y las automatizadas; reserva el cupo real de
test para integraciones puntuales.

### Tarifas

- **Una pieza → `GET /rates`** con query params (`currencyCode=USD`,
  `isCustomsDeclarable=false`, `unitOfMeasurement=imperial`).
- **Varias piezas → `POST /rates`** con `packages[]`.
- Se usa `totalPrice[].currencyType = BILLC` (tarifa negociada); si no viene, la
  primera en USD. Las opciones en otra moneda se descartan.
- Caché en memoria 10 min por origen/destino/peso/medidas. **Nunca en BD**
  (restricción legal de Rating Data).
- Timeout 2 s. Si falla, `ok: false` y la compra sigue con tarifa plana.
- Nunca se devuelve ni se loguea el Rating Data crudo; los logs no incluyen ZIP
  ni ciudad.

`POST /api/shipping/quote` → `{ configured, options[] }`.

### Guías

`POST /api/admin/shipment` (`{ orderId, productCode? }`):

- Solo staff y solo si la dirección está `verified` o `corrected`; si está
  `pending` o `invalid` responde 409.
- Envía `outputImageProperties` con **label** y **waybillDoc** en PDF.
- Shipper `typeCode: business`, receiver `residential` (o `business`).
- Sin `exportDeclaration` (doméstico no declarable).
- Decodifica base64 → sube el PDF al bucket **`shipping-labels`** → guarda
  `shipping_label_url` y `tracking_number` en el pedido.
- Envía la guía al cliente por correo con el PDF adjunto (Resend).
- Si DHL rechaza la dirección, el pedido pasa a `invalid` y se avisa al operador.

Crear el bucket antes de usar guías: Supabase → Storage → **New bucket** →
`shipping-labels` (public, o privado si prefieres URLs firmadas).

### Errores

MyDHL puede responder 200 con `warnings[]` o con un `result.message`. Ambos se
parsean y se loguean; un `status >= 400` se convierte en `ok: false` con motivo
(`upstream_error`, `address_rejected`, `no_rates`, `invalid_zip`).

## 3. Pendiente

- Selector de tarifa DHL en el checkout: mostrar `options[]` y sumar la elegida
  al total. El endpoint ya responde; falta la UI y la re-cotización en
  `/api/checkout` para que el navegador no pueda alterar el monto. Se activa en
  cuanto haya credenciales de sandbox para probarlo de punta a punta.
- Opcionales no implementados: `/address-validate`, tracking público,
  `get-image`, `/reference-data`.
