-- ============================================================
-- Realtime de favoritos (wishlist_items)
-- ------------------------------------------------------------
-- Sin esto, Supabase no emite los cambios de la tabla y el
-- navegador nunca recibe el aviso de "otro dispositivo cambió
-- tus favoritos". El cliente ya escucha con:
--
--   supabase.channel('wishlist:<user>')
--     .on('postgres_changes', {
--       event: '*', schema: 'public', table: 'wishlist_items',
--       filter: `user_id=eq.<user>`
--     }, ...)
--
-- La privacidad la sigue dando RLS: solo el dueño recibe sus filas
-- (política `wishlist_select_own`).
--
-- Ejecutar UNA vez. Es idempotente.
-- ============================================================

BEGIN;

-- 1) Añadir la tabla a la publicación de Realtime.
--    `ALTER PUBLICATION ... ADD TABLE` falla si ya está, así que se
--    comprueba antes en pg_publication_tables.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'wishlist_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wishlist_items;
  END IF;
END
$$;

-- 2) REPLICA IDENTITY FULL:
--    por defecto Postgres solo manda la clave primaria en DELETE/UPDATE,
--    y el `filter: user_id=eq.…` no podría aplicarse. Con FULL llega la
--    fila completa y el filtro funciona.
--    (En INSERT no hace falta, pero unifica el comportamiento.)
ALTER TABLE public.wishlist_items REPLICA IDENTITY FULL;

COMMIT;

-- Verificación 1: debe devolver una fila.
SELECT tablename
  FROM pg_publication_tables
 WHERE pubname = 'supabase_realtime'
   AND schemaname = 'public'
   AND tablename = 'wishlist_items';

-- Verificación 2: debe devolver 'f' (full).
SELECT relreplident
  FROM pg_class
 WHERE oid = 'public.wishlist_items'::regclass;
