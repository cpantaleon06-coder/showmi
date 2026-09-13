-- ---------------------------------------------------------------------------
-- Endurecimiento tras el linter de seguridad de Supabase (2026-09-13)
-- ---------------------------------------------------------------------------
-- Segunda tanda, después de cerrar RLS en las 12 tablas abiertas. Estos hallazgos salieron del
-- advisor oficial (`/advisors/security`) y se verificaron uno por uno contra la base real.

-- ---------- 1. Fuga de datos por usuario en una vista materializada ----------
-- `liked_artists` expone (user_id, artist_key) y era SELECTable por `anon`. Comprobado con la
-- anon key pública que va en el bundle: devolvía filas reales de usuarios reales, o sea que
-- cualquiera podía volcar qué artistas le gustan a cada persona.
--
-- Las vistas materializadas NO admiten RLS, así que la única defensa es quitarles el permiso
-- de lectura directa. El cliente no las pierde: las consume a través de funciones
-- SECURITY DEFINER (get_global_stats, get_artist_neighbors, get_track_vibes), que corren como
-- el dueño y por lo tanto siguen viéndolas.
--
-- Se revocan las seis, no solo la que filtra: ninguna está pensada para consumo directo desde
-- el cliente, y dejar abiertas las otras cinco solo deja superficie sin motivo.
revoke select on
  liked_artists,
  artist_user_counts,
  artist_pair_cooccurrence,
  artist_top_neighbors,
  global_key_stats,
  track_canonical_vibe
from anon, authenticated;

-- ---------- 2. get_artist_neighbors: search_path mutable ----------
-- Era `language sql stable` a secas: sin SECURITY DEFINER y sin search_path fijo. Dos
-- problemas en uno. El search_path mutable es lo que marcó el linter (un search_path
-- manipulado puede redirigir a qué tabla resuelve el nombre). Y al correr como INVOCADOR,
-- dejaría de funcionar en cuanto se revoque `artist_top_neighbors` arriba.
--
-- Pasa a SECURITY DEFINER con search_path fijo, igual que el resto de los getters del motor
-- (get_global_stats, get_track_vibes). No expone nada nuevo: devuelve vecindad entre artistas,
-- que no es dato de ningún usuario.
create or replace function get_artist_neighbors(p_artist_key text, p_limit int default 5)
returns table(neighbor_id text, similarity real)
language sql stable security definer set search_path = public as $$
  select neighbor_id, similarity from artist_top_neighbors
  where artist_id = p_artist_key order by rank limit p_limit;
$$;

-- ---------- 3. get_top_sets: leer los gustos de CUALQUIER usuario ----------
-- La función recibía `p_user_id` y filtraba por él sin comprobar nada, siendo SECURITY DEFINER
-- y ejecutable por `anon`. O sea: pasando otro uuid se leían los géneros y artistas favoritos
-- de esa persona. El cliente siempre mandaba el suyo (tasteEngineClient.ts:171), pero eso es
-- una convención del cliente, no una defensa -- el endpoint REST está abierto a cualquiera.
--
-- Ahora filtra por `auth.uid()` y el parámetro queda IGNORADO. Se conserva en la firma a
-- propósito: cambiarla rompería la llamada del cliente ya desplegado, y un parámetro que se
-- ignora es más seguro que uno que se obedece. Cuando se pueda tocar el cliente, quitarlo.
create or replace function get_top_sets(p_user_id uuid, p_prefix text, p_limit int default 5)
returns table(dim_key text, liked_count bigint)
language sql stable security definer set search_path = public as $$
  select sd.dim_key, count(*) as liked_count
  from swipes s
  join swipe_dimensions sd on sd.swipe_id = s.id
  where s.user_id = auth.uid() and s.liked = true and sd.dim_key like p_prefix || ':%'
  group by sd.dim_key
  order by liked_count desc
  limit p_limit;
$$;

-- ---------- 4. Funciones internas expuestas como endpoints REST ----------
-- PostgREST publica TODA función de `public` como /rest/v1/rpc/<nombre>. Estas tres no son
-- para el cliente y no tienen por qué ser invocables por él:
--   - handle_new_auth_user: función de TRIGGER. Los triggers corren por cuenta de la tabla,
--     así que revocar el EXECUTE directo no los afecta.
--   - refresh_weekly_community_picks: la dispara pg_cron (como postgres). Abierta, cualquiera
--     podía forzar el recálculo del feed curado cuando quisiera.
--   - get_unclassified_track_ids: la llama classify-tracks con el service_role, que ignora
--     estos grants.
-- De PUBLIC, no de anon/authenticated: Postgres le da EXECUTE a PUBLIC por defecto al crear
-- una función, y anon/authenticated lo HEREDAN. Revocar solo de ellos no hace nada -- se probó
-- primero así y las funciones seguían respondiendo 200 por el REST. `service_role` conserva su
-- grant explícito (`service_role=X/postgres`), así que classify-tracks sigue pudiendo llamar a
-- get_unclassified_track_ids.
revoke execute on function handle_new_auth_user() from public;
revoke execute on function refresh_weekly_community_picks() from public;
revoke execute on function get_unclassified_track_ids(int) from public;
