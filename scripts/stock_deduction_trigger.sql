-- =====================================================
-- Deducción de stock al vender
-- Ejecuta en Supabase → SQL Editor (idempotente)
-- =====================================================

-- 1. Función que resta stock al insertar order_items
CREATE OR REPLACE FUNCTION public.deduct_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Solo deducir si la variante existe y tiene stock
  UPDATE public.product_variants
  SET stock = GREATEST(0, stock - NEW.quantity)
  WHERE id = NEW.product_variant_id
    AND stock >= NEW.quantity;

  -- Si la variante no existe o no tiene suficiente stock, bloquear la inserción
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock insuficiente o variante no encontrada: %', NEW.product_variant_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Trigger que se ejecuta DESPUÉS de insertar order_items
DROP TRIGGER IF EXISTS on_order_items_insert_deduct_stock ON public.order_items;
CREATE TRIGGER on_order_items_insert_deduct_stock
  AFTER INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.deduct_stock();

-- 3. Función para revertir stock si el pedido se cancela
CREATE OR REPLACE FUNCTION public.refund_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Solo reembolsar si el pedido se cancela o devuelve
  IF NEW.status IN ('cancelled', 'returned') AND OLD.status NOT IN ('cancelled', 'returned') THEN
    UPDATE public.product_variants
    SET stock = stock + OLD.quantity
    WHERE id = OLD.product_variant_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Trigger que se ejecuta DESPUÉS de actualizar el estado del pedido
DROP TRIGGER IF EXISTS on_order_status_update_refund_stock ON public.orders;
CREATE TRIGGER on_order_status_update_refund_stock
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.refund_stock();

-- =====================================================
-- Verificación
-- =====================================================
SELECT 'Stock deduction trigger' AS dato, 'OK' AS estado;