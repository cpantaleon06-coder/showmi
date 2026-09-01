-- YA APLICADO contra el proyecto real (2026-09-01, vía Management API con un access
-- token temporal) -- este archivo queda como registro histórico de lo que se corrió,
-- no hace falta volver a pegarlo en el SQL Editor. Si en el futuro se agrega una
-- sección nueva a schema.sql, arma un bundle nuevo en vez de reusar este.
--
-- (Contexto original, ya no aplica: se armó juntando todo lo que un curl empírico
-- contra cada función confirmó que faltaba en el proyecto real a esa fecha.)

-- ---------------------------------------------------------------------------
-- Conjuntos explícitos de Artista_a / Género_g (2026-08-29)
-- ---------------------------------------------------------------------------
-- (alpha, beta) del motor de Thompson Sampling siempre fue el resumen
-- estadístico de un conjunto -- {s en swipes | liked(s) y dim(s) = clave} --
-- comprimido en dos números. El motor no cambia: esto solo expone el
-- conjunto explícito para donde SÍ importa verlo como membresía y no como
-- conteo (chips de "tus géneros/artistas" en Perfil, auditoría del ledger).
create or replace function get_top_sets(p_user_id uuid, p_prefix text, p_limit int default 5)
returns table(dim_key text, liked_count bigint)
language sql stable security definer set search_path = public as $$
  select sd.dim_key, count(*) as liked_count
  from swipes s
  join swipe_dimensions sd on sd.swipe_id = s.id
  where s.user_id = p_user_id and s.liked = true and sd.dim_key like p_prefix || ':%'
  group by sd.dim_key
  order by liked_count desc
  limit p_limit;
$$;

-- ---------------------------------------------------------------------------
-- Vibra: quinta dimensión del taste engine, votada por la comunidad (2026-08-29)
-- ---------------------------------------------------------------------------
-- Reemplaza el diseño anterior (chips de "vibra" del selector de sesión como
-- heurística vía boost de género, ver moods.ts pre-migración): la vibra de
-- una canción es inherentemente subjetiva -- no la asigna una disquera como
-- el género -- así que ni un LLM adivinando desde el título ni un mapeo
-- fijo por género tienen más autoridad real que el voto directo de quienes
-- ya la escucharon. Mismo patrón que el prior colectivo de arriba: agregado
-- por voto mayoritario, no en tiempo real.
--
-- Taxonomía cerrada a propósito (check constraint, no texto libre) para que
-- "fiesta"/"para bailar"/"pa' la peda" no cuenten como tres vibras distintas.
create table track_vibe_votes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  track_id text not null,
  -- Lista de 18 vibras (ampliada 2026-08-31, ver ALTER al final del archivo
  -- para el proyecto ya corriendo -- este CREATE TABLE solo cubre un bootstrap
  -- nuevo desde cero) -- debe calzar exacto con VibeKey en src/lib/vibes.ts.
  vibe text not null check (vibe in
    ('fiesta','romantico','nostalgico','hype','chill','heartbreak','introspectivo','desahogo',
     'motivacional','melancolico','enamorado','sensual','empoderamiento','rabia','alegre',
     'relajacion','viaje','enfoque')),
  created_at timestamptz not null default now(),
  unique (user_id, track_id)
);
create index track_vibe_votes_track_id_idx on track_vibe_votes (track_id);

alter table track_vibe_votes enable row level security;
create policy "propio voto select" on track_vibe_votes for select using (auth.uid() = user_id);
-- Insert/update pasan por register_vibe_vote (security definer) para que el
-- upsert (un usuario puede recalificar la vibra de una canción) sea atómico;
-- no hay policy de insert/update directa aquí a propósito.

create or replace function register_vibe_vote(p_track_id text, p_vibe text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into track_vibe_votes (user_id, track_id, vibe)
  values (auth.uid(), p_track_id, p_vibe)
  on conflict (user_id, track_id) do update set vibe = excluded.vibe, created_at = now();
end; $$;

-- Voto mayoritario por track, refrescado por hora (mismo ritmo que
-- global_key_stats). Umbral de 3 votos antes de considerar una vibra
-- "canónica" -- una canción recién votada una sola vez simplemente no tiene
-- vibra todavía, igual que un candidato sin género cuando Last.fm no lo trae:
-- dimensionKeys() ya sabe saltarse una dimensión ausente, así que no hace
-- falta lógica nueva del lado del motor para este caso.
create materialized view track_canonical_vibe as
select track_id, vibe, votes, total_votes from (
  select track_id, vibe, count(*) as votes,
    sum(count(*)) over (partition by track_id) as total_votes,
    row_number() over (partition by track_id order by count(*) desc) as rnk
  from track_vibe_votes group by track_id, vibe
) ranked
where rnk = 1 and total_votes >= 3;

create unique index on track_canonical_vibe (track_id);

select cron.schedule('refresh-track-vibes', '0 * * * *',
  $$refresh materialized view concurrently track_canonical_vibe$$);

create or replace function get_track_vibes(p_track_ids text[])
returns table(track_id text, vibe text, votes int, total_votes int)
language sql stable security definer set search_path = public as $$
  select track_id, vibe, votes, total_votes from track_canonical_vibe where track_id = any(p_track_ids);
$$;

-- ---------------------------------------------------------------------------
-- Auth real: anónimo automático + fila en public.users por trigger (2026-08-30)
-- ---------------------------------------------------------------------------
-- Decisión de producto: sign-in anónimo desde que se abre la app la primera
-- vez (Supabase Auth "Anonymous Sign-Ins", hay que habilitarlo a mano en
-- Dashboard -> Authentication -> Providers, esta migración no lo activa).
-- Cada usuario anónimo YA es un auth.uid() real -- swipes/posts/votos
-- funcionan desde el primer swipe, sin pantalla de login. Más adelante puede
-- vincular email/password desde Perfil sin perder su progreso (mismo
-- auth.uid(), Supabase solo agrega la identidad -- no se migran filas).
--
-- Nada en el cliente inserta en public.users todavía -- sin este trigger,
-- cualquier insert en swipes/posts/etc. fallaría por la FK a users(id) que
-- nunca se creó. Patrón estándar de Supabase (trigger en auth.users, no en
-- el cliente) para que exista para CUALQUIER vía de alta (anónima, email,
-- OAuth futuro) sin depender de que el cliente recuerde hacerlo.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id) values (new.id) on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

alter table users enable row level security;
create policy "propio usuario select" on users for select using (auth.uid() = id);
create policy "propio usuario update" on users for update using (auth.uid() = id);
-- Insert solo vía el trigger de arriba (security definer) -- nunca directo
-- desde el cliente, por eso no hay policy de insert aquí.

alter table onboarding_quiz enable row level security;
create policy "propio quiz select" on onboarding_quiz for select using (auth.uid() = user_id);
create policy "propio quiz insert" on onboarding_quiz for insert with check (auth.uid() = user_id);
create policy "propio quiz update" on onboarding_quiz for update using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Feed real: posts públicos, canales de género, Community Picks semanal,
-- cuenta oficial (2026-08-30)
-- ---------------------------------------------------------------------------

alter table posts enable row level security;
create policy "posts insert propio" on posts for insert with check (auth.uid() = user_id);
create policy "posts update propio" on posts for update using (auth.uid() = user_id);
-- Sin policy de select directa a propósito: el Feed es público (se puede leer
-- el post de cualquiera), pero exponer eso vía RLS abierta en `posts`
-- obligaría a abrir también `users` para poder mostrar "es_cuenta_oficial" en
-- el join -- en vez de eso, la lectura pasa por get_feed_posts() de abajo
-- (security definer), que solo expone las columnas seguras que el Feed
-- necesita, nunca la fila completa de `users`.
create or replace function get_feed_posts(p_genre_tags text[] default null, p_limit int default 30)
returns table(
  post_id uuid, user_id uuid, track_id text, post_text text, rating int,
  genre_tag text, created_at timestamptz, is_official boolean
)
language sql stable security definer set search_path = public as $$
  select p.id, p.user_id, p.track_id, p.text, p.rating, p.genre_tag, p.created_at, u.es_cuenta_oficial
  from posts p
  join users u on u.id = p.user_id
  where p_genre_tags is null or p.genre_tag = any(p_genre_tags)
  order by p.created_at desc
  limit p_limit;
$$;

-- Community Picks: se activa solo cuando hay actividad real esa semana (si
-- no, no se genera nada -- el Feed sigue corriendo solo con la cuenta
-- oficial mientras tanto, ver más abajo). Cadencia semanal, no diaria.
-- Score = 50% rating promedio de posts + 50% volumen de swipes-derecha de
-- esa semana, cada uno normalizado 0-1 dentro del propio corte semanal --
-- punto de partida razonable, no medido con datos reales todavía (mismo
-- espíritu que los pesos de dimensionKeys en tasteEngine.ts).
create or replace function refresh_weekly_community_picks()
returns void language plpgsql security definer set search_path = public as $$
declare v_week_start date := date_trunc('week', now())::date;
begin
  if not exists (select 1 from swipes where created_at >= v_week_start) then
    return;
  end if;

  delete from weekly_community_picks where week_start = v_week_start;

  insert into weekly_community_picks (week_start, track_id, position, score)
  select v_week_start, track_id, row_number() over (order by combined_score desc), combined_score
  from (
    select
      track_id,
      coalesce(avg_rating, 0) / 5.0 * 0.5
        + coalesce(like_count, 0)::numeric / greatest(max(like_count) over (), 1) * 0.5 as combined_score
    from (
      select coalesce(ratings.track_id, likes.track_id) as track_id, ratings.avg_rating, likes.like_count
      from (
        select track_id, avg(rating) as avg_rating
        from posts
        where created_at >= v_week_start and track_id is not null and rating is not null
        group by track_id
      ) ratings
      full outer join (
        select track_id, count(*) as like_count
        from swipes
        where created_at >= v_week_start and liked = true
        group by track_id
      ) likes on likes.track_id = ratings.track_id
    ) combined
  ) normalized
  order by combined_score desc
  limit 20;
end; $$;

create extension if not exists pg_net;

select cron.schedule('refresh-weekly-community-picks', '0 6 * * 1', -- lunes 6am
  $$select refresh_weekly_community_picks()$$);

-- Cuenta oficial: sembrada por supabase/functions/seed-official-feed (llama
-- chart.getTopTracks de Last.fm, resuelve cada track vía iTunes, postea como
-- el usuario con es_cuenta_oficial = true). Necesita LASTFM_API_KEY (mismo
-- secret que lastfm-similar, aún sin dar) y que exista un usuario real con
-- es_cuenta_oficial = true -- ver nota de setup manual, esta migración no
-- crea esa cuenta (requeriría el service role key, que esta sesión no tiene).
--
-- El cron de abajo llama la función vía pg_net con la anon key (pública por
-- diseño, no un secreto) -- la función misma usa su SUPABASE_SERVICE_ROLE_KEY
-- (inyectada automáticamente por Supabase en todo Edge Function, no hay que
-- configurarla a mano) para poder insertar como la cuenta oficial saltándose
-- las policies de arriba.
select cron.schedule('seed-official-feed-weekly', '0 5 * * 1', -- lunes 5am, antes de community picks
  $$
  select net.http_post(
    url := 'https://wdgjdgsxmwgsqrrngxyp.supabase.co/functions/v1/seed-official-feed',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkZ2pkZ3N4bXdnc3Fycm5neHlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NTM3ODAsImV4cCI6MjEwMzQyOTc4MH0.813AhFQdd0OncLzz9nEWyO7bdNmeVwbpTmm3d-PaI2k',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Canales del Feed: `genre_tag` es el género crudo de iTunes (primaryGenreName,
-- ej. "Alternative", "Hip-Hop/Rap", "Latino"), NO la taxonomía canónica de 8
-- géneros de src/lib/genres.ts -- esa taxonomía todavía no está conectada a
-- ningún dato real (nace de tags de Last.fm que la app no consulta todavía).
-- Los canales del Feed reflejan lo que de verdad hay en `posts`, no una lista
-- fija que podría no coincidir con ningún dato real.
create or replace function get_active_genre_tags(p_limit int default 12)
returns table(genre_tag text, post_count bigint)
language sql stable security definer set search_path = public as $$
  select genre_tag, count(*) as post_count
  from posts
  where genre_tag is not null
  group by genre_tag
  order by post_count desc
  limit p_limit;
$$;

-- ---------------------------------------------------------------------------
-- Árbol de decisiones por sesión: perfil consolidado por nodo (2026-08-31)
-- ---------------------------------------------------------------------------
-- Ver taste-engine/src/sessionTree.ts (paquete standalone) para la lógica de
-- acumulación/consolidación -- este bloque es solo la persistencia server-side
-- de ese perfil. No aplicado al proyecto real todavía (a diferencia del resto
-- del archivo, ver comentario del encabezado); pendiente de que el hilo de
-- trabajo del selector de sesión/UI conecte el flujo completo antes de
-- correrlo. NO reemplaza ni extiende `taste_profile` (favorite_genres/
-- recurring_artists son snapshots planos, no un árbol jerárquico de nodos
-- con peso) -- tabla nueva a propósito, misma relación uno-a-muchos que
-- swipe_dimensions/dim_key ya usa para el motor principal.
create table session_tree_weights (
  user_id uuid not null references users(id) on delete cascade,
  node_key text not null, -- ej. "idioma:es>epoca:2010s>genero:reggaeton>vibra:fiesta"
  weight real not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, node_key)
);
create index session_tree_weights_user_id_idx on session_tree_weights (user_id);

alter table session_tree_weights enable row level security;
create policy "propio arbol select" on session_tree_weights for select using (auth.uid() = user_id);
-- Insert/update pasan por consolidate_session_tree (security definer) para que el
-- decay-then-add sea atómico -- no hay policy de insert/update directa aquí.

-- p_deltas: [{"node_key": "...", "weight": <peso del acumulador de la sesión>}, ...],
-- la salida directa de recordSessionSwipe() en sessionTree.ts, serializada por el
-- cliente al cerrar sesión. Decae CADA nodo existente del usuario por SESSION_DECAY
-- (0.9, ver justificación en sessionTree.ts -- constante propia, no el DECAY del
-- motor principal, granularidades distintas: por sesión vs. por swipe individual)
-- antes de sumar esta sesión encima -- mismo patrón decay-then-add que
-- consolidateSession() del lado TypeScript, para que ambos lados calculen
-- exactamente lo mismo.
create or replace function consolidate_session_tree(p_deltas jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  update session_tree_weights
  set weight = weight * 0.9, updated_at = now()
  where user_id = auth.uid();

  insert into session_tree_weights (user_id, node_key, weight)
  select auth.uid(), d->>'node_key', (d->>'weight')::real
  from jsonb_array_elements(p_deltas) as d
  on conflict (user_id, node_key) do update
    set weight = session_tree_weights.weight + excluded.weight, updated_at = now();
end; $$;

-- Perfil completo del usuario, para el punto de integración (a) de sessionTree.ts
-- (suggestNextSessionSelection) y (b) (sessionTreeToMultipliers) -- ambas funciones
-- reciben el `Record<node_key, weight>` que arma esto en el cliente.
create or replace function get_session_tree_profile()
returns table(node_key text, weight real)
language sql stable security definer set search_path = public as $$
  select node_key, weight from session_tree_weights where user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Ampliación de vibras 8 -> 18 (2026-08-31)
-- ---------------------------------------------------------------------------
-- track_vibe_votes ya existe en el proyecto real (se aplicó como parte del
-- bloque base, antes del corte del 2026-08-28 documentado en el encabezado de
-- este archivo) -- por eso esto es un ALTER, no se puede editar in-place el
-- CREATE TABLE de arriba y esperar que el constraint ya corriendo cambie
-- solo. Postgres no deja modificar un CHECK existente: hay que borrarlo y
-- crear uno nuevo. Pendiente de correr a mano contra el proyecto real, igual
-- que el resto de los bloques fechados de esta sección.
alter table track_vibe_votes drop constraint track_vibe_votes_vibe_check;
alter table track_vibe_votes add constraint track_vibe_votes_vibe_check check (vibe in
  ('fiesta','romantico','nostalgico','hype','chill','heartbreak','introspectivo','desahogo',
   'motivacional','melancolico','enamorado','sensual','empoderamiento','rabia','alegre',
   'relajacion','viaje','enfoque'));

-- ---------------------------------------------------------------------------
-- Catálogo de clasificación por lote: idioma/época/género (2026-09-01)
-- ---------------------------------------------------------------------------
-- "Workflow con Deno" pedido explícitamente -- ver supabase/functions/classify-tracks.
-- Hasta ahora idioma/época/género se resolvían en el CLIENTE, en cada armado de deck,
-- para cada candidato (ver src/api/tasteAdapter.ts) -- funciona, pero recalcula lo mismo
-- una y otra vez para el mismo track_id entre sesiones/usuarios distintos. Esta tabla es
-- el resultado cacheado de resolverlo UNA vez por track, vía un cron diario que llama la
-- función de Deno. El cliente (fetchTrackCatalog en tasteEngineClient.ts) prefiere este
-- valor cuando existe y cae al heurístico local si el track todavía no pasó por acá --
-- nunca bloquea, es una mejora de PRECISIÓN/EFICIENCIA, no una dependencia dura nueva.
create table track_catalog (
  track_id text primary key,
  title text not null,
  artist text not null,
  release_date text,
  idioma text,
  epoca text,
  genero text,
  classified_at timestamptz not null default now()
);
create index track_catalog_genero_idx on track_catalog (genero);

-- Catálogo público de solo lectura (no hay dato de usuario acá) -- insert/update solo vía
-- el service role que usa la función de Deno, nunca desde el cliente ni con una policy de
-- insert/update propia.
alter table track_catalog enable row level security;
create policy "catalogo publico select" on track_catalog for select using (true);

-- Candidatos a clasificar: cualquier track_id que ya aparece en swipes/votos/posts (o sea,
-- alguien ya lo vio de verdad) pero todavía no tiene fila en track_catalog. security definer
-- porque swipes/track_vibe_votes tienen RLS "auth.uid() = user_id" -- sin esto, el join
-- quedaría filtrado solo a los track_ids de quien llama, no a los de toda la comunidad.
create or replace function get_unclassified_track_ids(p_limit int default 50)
returns table(track_id text)
language sql stable security definer set search_path = public as $$
  select distinct t.track_id from (
    select track_id from swipes
    union
    select track_id from track_vibe_votes
    union
    select track_id from posts where track_id is not null
  ) t
  left join track_catalog c on c.track_id = t.track_id
  where c.track_id is null
  limit p_limit;
$$;

-- Lectura en batch para el cliente (mismo patrón que get_track_vibes).
create or replace function get_track_catalog(p_track_ids text[])
returns table(track_id text, idioma text, epoca text, genero text)
language sql stable security definer set search_path = public as $$
  select track_id, idioma, epoca, genero from track_catalog where track_id = any(p_track_ids);
$$;

-- Diario (no cada hora -- el heurístico de idioma/género no cambia de un día para otro, y
-- LASTFM_API_KEY tiene rate limit; cadencia confirmada con el usuario: "batch periódico,
-- como los otros dos jobs"). El cron llama la función vía pg_net con la anon key (pública
-- por diseño), la función misma usa su SUPABASE_SERVICE_ROLE_KEY (inyectada automáticamente
-- por Supabase, no hay que configurarla a mano) para poder escribir en track_catalog.
select cron.schedule('classify-tracks-daily', '0 4 * * *', -- 4am, antes de seed-official-feed/community-picks del lunes
  $$
  select net.http_post(
    url := 'https://wdgjdgsxmwgsqrrngxyp.supabase.co/functions/v1/classify-tracks',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkZ2pkZ3N4bXdnc3Fycm5neHlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NTM3ODAsImV4cCI6MjEwMzQyOTc4MH0.813AhFQdd0OncLzz9nEWyO7bdNmeVwbpTmm3d-PaI2k',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
