-- ===========================================================================
-- Alertas de Supabase (advisors) — YA APLICADO el 2026-09-16
-- ===========================================================================
-- Este archivo documenta lo que se corrió contra el proyecto real, para que el
-- repo refleje la base. No hace falta volver a ejecutarlo (todo es idempotente
-- de todos modos).
--
-- Punto de partida: 52 alertas de seguridad (2 ERROR) y 23 WARN de rendimiento.
-- Resultado: 47 de seguridad (0 ERROR) y 0 WARN de rendimiento.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. ERROR — dos tablas de respaldo quedaron expuestas
-- ---------------------------------------------------------------------------
-- `swipe_dimensions_backup_2026_09_14` y `track_catalog_backup_20260916` las creó
-- Claude como red de seguridad antes de dos operaciones masivas, y se quedaron en
-- `public` SIN RLS. Comprobado antes de cerrarlas: con la anon key se leían enteras
-- desde PostgREST -- o sea, las dimensiones de swipe de TODOS los usuarios.
--
-- Se cierran en vez de borrarse: las dos operaciones que respaldan ya están
-- verificadas y además son reproducibles (el backfill de artistas es idempotente y
-- classify-tracks reconstruye el catálogo), así que el respaldo vale poco -- pero
-- cerrarlo cuesta menos que arrepentirse. Se pueden borrar cuando se quiera:
--   drop table public.swipe_dimensions_backup_2026_09_14;
--   drop table public.track_catalog_backup_20260916;
alter table public.swipe_dimensions_backup_2026_09_14 enable row level security;
alter table public.track_catalog_backup_20260916 enable row level security;
revoke all on public.swipe_dimensions_backup_2026_09_14 from anon, authenticated;
revoke all on public.track_catalog_backup_20260916 from anon, authenticated;


-- ---------------------------------------------------------------------------
-- 2. RENDIMIENTO — auth.uid() se evaluaba UNA VEZ POR FILA en 23 policies
-- ---------------------------------------------------------------------------
-- El lint `auth_rls_initplan`. Envuelto como `(select auth.uid())`, Postgres lo
-- trata como subconsulta escalar y lo evalúa una sola vez por consulta en vez de
-- por cada fila evaluada. La semántica es idéntica; lo que cambia es el plan.
--
-- Se reescribieron las 23 generando el SQL desde `pg_policies` en vez de a mano:
-- copiar 23 expresiones a mano es justo donde se cuela un `using` mal transcrito
-- que abre una tabla. Todo fue en UNA transacción, así que o entraban las 23 o
-- ninguna -- y si una hubiera fallado, la tabla se quedaba con RLS y sin policy,
-- que falla CERRADO.
--
-- Verificado después con un usuario anónimo real: ve solo su propia fila de
-- `users`, puede escribir su display_name (204), y sigue recibiendo 403 al intentar
-- es_cuenta_oficial. RLS intacta.
--
-- (Las 23 sentencias no se reproducen acá: son la salida de pg_policies con
-- `auth.uid()` -> `(select auth.uid())`. Para regenerarlas, ver el mismo criterio.)


-- ---------------------------------------------------------------------------
-- 3. RENDIMIENTO — 8 claves foráneas sin índice
-- ---------------------------------------------------------------------------
-- Sin índice en la columna que referencia, cada join y cada DELETE en cascada del
-- padre obliga a un scan secuencial del hijo.
create index if not exists collections_user_id_idx        on public.collections (user_id);
create index if not exists mascots_user_id_idx            on public.mascots (user_id);
create index if not exists mood_prompts_user_id_idx       on public.mood_prompts (user_id);
create index if not exists post_comments_user_id_idx      on public.post_comments (user_id);
create index if not exists post_comments_post_id_idx      on public.post_comments (post_id);
create index if not exists post_likes_user_id_idx         on public.post_likes (user_id);
create index if not exists posts_user_id_idx              on public.posts (user_id);
create index if not exists user_cosmetics_cosmetic_id_idx on public.user_cosmetics (cosmetic_id);


-- ---------------------------------------------------------------------------
-- 4. SEGURIDAD — quitarle a `anon` las funciones que no le sirven
-- ---------------------------------------------------------------------------
-- De las 16 funciones SECURITY DEFINER, cinco filtran por `auth.uid()`: llamadas
-- sin sesión no leen ni escriben nada. Quitarle el permiso a `anon` no cuesta
-- funcionalidad y reduce la superficie.
--
-- OJO, la trampa (ya documentada el 2026-09-13 y vuelta a pisar hoy): revocar solo
-- de `anon` NO hace nada, porque Postgres otorga EXECUTE a PUBLIC por defecto y
-- `anon` hereda de ahí. Se comprobó con has_function_privilege: seguía en `true`
-- después del primer revoke. Hay que revocar de PUBLIC y RE-OTORGAR explícitamente
-- a `authenticated`, que hasta ese momento también dependía de PUBLIC.
do $do$
declare f record;
begin
  for f in
    select p.oid::regprocedure::text as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('consolidate_session_tree','get_session_tree_profile',
                        'get_top_sets','register_swipe','register_vibe_vote')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;
end $do$;

-- Las que SÍ siguen abiertas a `anon`, a propósito: get_feed_posts, get_global_stats,
-- get_track_catalog, get_track_vibes, get_artist_neighbors(_batch) y
-- get_active_genre_tags. No dependen de `auth.uid()` y sostienen el camino degradado
-- de app/(tabs)/index.tsx cuando el sign-in anónimo falla (sin red): ahí la app sigue
-- armando deck en vez de quedarse en blanco. Revocarlas rompería ese respaldo.


-- ===========================================================================
-- Lo que QUEDA en el panel y por qué NO se toca
-- ===========================================================================
-- 21  auth_allow_anonymous_sign_ins
--     Avisa que las policies admiten usuarios anónimos. Eso ES el producto: Showmi
--     entra sin registro y convierte la cuenta después (ver app/auth.tsx). "Arreglarlo"
--     sería quitar la forma en que entra todo el mundo.
--
-- 12  authenticated_security_definer_function_executable
--  7  anon_security_definer_function_executable
--     Son las RPC que la app necesita llamar. SECURITY DEFINER es justamente el punto:
--     saltarse RLS de forma controlada para hacer algo que el cliente no puede hacer
--     directo. Cada una filtra por auth.uid() o es una lectura pública.
--
--  5  rls_enabled_no_policy
--     RLS activa y sin policy = nadie entra por PostgREST. Es DELIBERADO en las cinco:
--     itunes_search_cache, swipe_dimensions y view_refresh_log solo se tocan desde
--     funciones/Edge Functions, y las dos tablas de respaldo del bloque 1 quedaron así
--     a propósito.
--
--  1  extension_in_public (pg_net)
--     Decisión ya documentada en su propio commit: moverla rompe pg_cron -> Edge
--     Functions, que es de lo que dependen los jobs.
--
--  1  auth_leaked_password_protection
--     Comprobar contraseñas contra HaveIBeenPwned exige plan Pro. La API responde
--     literalmente "available on Pro Plans and up". No se puede desde el Free.
--
-- Y en rendimiento quedan 8 INFO: 6 `unused_index` (varios son los que se acaban de
-- crear -- todavía no hay tráfico que los use) y 2 `no_primary_key`, que son las
-- tablas de respaldo. Ninguno es accionable hoy.
