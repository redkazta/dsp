# Envíos: direcciones de EE. UU. y DHL

## Direcciones (sin validación automática)

La captura vive en el checkout y **no llama a ningún servicio externo**:

- `lib/us.ts` es el **catálogo único** de regiones: 50 estados, DC y territorios
  (PR, GU, VI, AS, MP) con `type` y `enabledForShipping`.
- El select del checkout usa `SHIPPING_REGIONS` (solo habilitadas). El panel de
  admin usa `US_REGIONS` completas, para poder corregir pedidos históricos.
- Validación **solo de formato**: región del catálogo, ZIP `^\d{5}(-\d{4})?$`,
  obligatorios no vacíos. La existencia la revisa una persona.
- La dirección se guarda tal cual en `orders` con
  `address_verification_status = 'pending'`.

### Verificación manual

En `/admin/pedidos` → **Editar / verificar dirección**:

| Estado | Significado |
|---|---|
| `pending` | Capturada por el cliente, sin revisar |
| `verified` | El operador la buscó y coincide |
| `corrected` | Se corrigió antes de generar la guía |
| `invalid` | No se puede enviar; bloquea la guía |

Cada campo que cambia dentro de esa edición se guarda en
`order_address_audit` (quién, cuándo, valor anterior y nuevo). Requiere correr
`scripts/address_verification.sql`.

### Reglas

- País fijo `US`.
- El checkout avisa (sin bloquear) sobre PO Box y APO/FPO/DPO.
- `invalid` bloquea la generación de guía (`/api/admin/shipment` responde 409).

## DHL Express — MyDHL API

Solo backend (`lib/dhl.ts`). Sin credenciales, el checkout sigue funcionando
con la tarifa plana de `store_settings` y el botón de guía no aparece.

### Variables de entorno

| Variable | Ejemplo | Nota |
|---|---|---|
| `DHL_API_KEY` | `abc123` | Developer Portal |
| `DHL_API_SECRET` | `xyz789` | Developer Portal |
| `DHL_ACCOUNT_NUMBER` | `123456789` | Contrato DHL Express |
| `DHL_API_BASE_URL` | `https://express.api.dhl.com/mydhlapi/test` | producción sin `/test` |
| `DHL_ORIGIN_ZIP` | `90001` | bodega |
| `DHL_ORIGIN_CITY` | `Los Angeles` | bodega |
| `DHL_ORIGIN_COUNTRY` | `US` | bodega |
| `DHL_ORIGIN_COMPANY` | `Dinero Sobre Problemas` | aparece en la guía |

Sin `DHL_API_KEY`, `DHL_API_SECRET`, `DHL_ACCOUNT_NUMBER` y `DHL_ORIGIN_ZIP`
no se hacen llamadas: `isDhlConfigured()` devuelve `false`.

### Tarifas

`POST /api/shipping/quote` → `{ configured, options[] }`.

- Solo opciones en **USD**; las que DHL devuelva en otra moneda se descartan.
- Caché en memoria de 10 min por origen/destino/peso/medidas.
- Timeout de 2 s; si DHL falla o no hay tarifas, responde `options: []` y el
  checkout usa la tarifa plana. Nunca se rompe la compra.
- Peso por defecto por pieza: 1.2 lb, 12×10×2 in (ajustable en
  `api/shipping/quote.ts`).

### Guías

`POST /api/admin/shipment` → genera el waybill con `ShipmentRequest`.

- Solo staff.
- **Bloqueado** si la dirección está `pending` o `invalid`: primero se verifica
  en el panel. Esto evita reemitir guías con direcciones mal capturadas.
- Guarda `carrier = 'DHL'` y `tracking_number` en el pedido.
- Botón **Generar guía DHL** en `/admin/pedidos` (solo si DHL está configurado).

### Sandbox → producción

1. Credenciales de sandbox en `DHL_API_BASE_URL=https://express.api.dhl.com/mydhlapi/test`.
2. Probar rate y una guía de prueba.
3. Pedir acceso a producción en developer.dhl.com y cambiar la URL y las llaves.
4. No hace falta redeploy para las variables privadas; sí para nada más.

## Pendiente

La selección de tarifa DHL en el checkout (mostrar opciones y sumarlas al
total) queda detrás de `configured: true`. Hoy el endpoint ya responde, pero el
formulario sigue usando la tarifa plana. Se activa cuando existan credenciales
para probarlo de punta a punta.
