-- Опционально: ограничить операции для заблокированных пользователей (profiles.is_blocked = true).
-- Выполняйте в SQL Editor Supabase только если у вас уже настроен RLS и вы можете слить политики с существующими.
-- Функция безопасно читает флаг блокировки текущего пользователя.

CREATE OR REPLACE FUNCTION public.auth_is_blocked()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_blocked FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.auth_is_blocked() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_is_blocked() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_is_blocked() TO anon;

-- Примеры (раскомментируйте и адаптируйте под свои имена политик):
-- CREATE POLICY "no_rw_when_blocked_orders"
--   ON public.orders
--   FOR ALL
--   TO authenticated
--   USING (NOT public.auth_is_blocked())
--   WITH CHECK (NOT public.auth_is_blocked());
--
-- Аналогично для order_items, products (INSERT/UPDATE/DELETE), корзины и т.д.
-- SELECT каталога для анонимов обычно оставляют без блокировки по профилю.
