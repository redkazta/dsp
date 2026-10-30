-- =====================================================
-- Historial de pedidos sin duplicados
--
-- Contexto: el trigger `on_order_status_change` inserta una fila por cada
-- cambio de estado. El panel insertaba otra desde el cliente, así que cada
-- movimiento aparecía dos veces (una con "Cambio de estado" y otra con la
-- nota del panel).
--
-- 1. El panel ya no inserta (se quitó en `lib/admin.ts`).
-- 2. Aquí se limpian los duplicados que quedaron.
--
-- Idempotente: se puede correr varias veces sin efecto extra.
-- =====================================================

-- 1. Borrar el duplicado "pobre": de cada par (mismo pedido, mismo estado,
--    menos de 5 s de diferencia) se conserva la fila con la nota más larga.
DELETE FROM public.order_status_history AS h
USING public.order_status_history AS d
WHERE h.order_id = d.order_id
  AND h.status = d.status
  AND h.id <> d.id
  AND h.created_at >= d.created_at
  AND h.created_at <= d.created_at + interval '5 seconds'
  AND length(coalesce(h.notes, '')) < length(coalesce(d.notes, ''));

-- 2. Por si quedara algún empate exacto (misma nota, mismo segundo).
DELETE FROM public.order_status_history AS h
USING public.order_status_history AS d
WHERE h.order_id = d.order_id
  AND h.status = d.status
  AND h.id > d.id
  AND h.created_at BETWEEN d.created_at AND d.created_at + interval '5 seconds'
  AND coalesce(h.notes, '') = coalesce(d.notes, '');

-- 3. Índice para leer el seguimiento de un pedido en orden.
CREATE INDEX IF NOT EXISTS idx_order_status_history_order
    ON public.order_status_history (order_id, created_at);

NOTIFY pgrst, 'reload schema';
