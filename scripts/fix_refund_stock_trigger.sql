-- =====================================================
-- Arreglo: devolver stock al cancelar o devolver un pedido
--
-- El trigger anterior estaba colgado de `orders` pero leía
-- `OLD.product_variant_id` y `OLD.quantity`, que viven en `order_items`:
-- cualquier intento de mover un pedido a "Cancelado" o "Devuelto" fallaba
-- con: record "old" has no field "product_variant_id".
--
-- Aquí la función recorre las piezas del pedido y devuelve cada variante.
-- Idempotente: se puede correr varias veces.
-- =====================================================

CREATE OR REPLACE FUNCTION public.refund_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('cancelled', 'returned')
     AND OLD.status NOT IN ('cancelled', 'returned') THEN

    UPDATE public.product_variants AS v
       SET stock = v.stock + oi.quantity
      FROM public.order_items AS oi
     WHERE oi.order_id = NEW.id
       AND oi.product_variant_id IS NOT NULL
       AND oi.product_variant_id = v.id;
  END IF;

  RETURN NEW;
END;
$$;

-- El trigger ya existía; se recrea por si quedó a medias.
DROP TRIGGER IF EXISTS on_order_status_update_refund_stock ON public.orders;
CREATE TRIGGER on_order_status_update_refund_stock
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.refund_stock();

NOTIFY pgrst, 'reload schema';
