-- Showmi data model. Applied to the real Supabase project as of 2026-08-28
-- (taste engine tables/functions) -- this file is the running source of
-- truth, not a draft. New sections added after that point (marked with a
-- date comment) still need to be run against the live project by hand.

create extension if not exists "uuid-ossp";

create table users (
  id uuid primary key default uuid_generate_v4() references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  bio text,
  spotify_user_id text,
  es_cuenta_oficial boolean not null default false,
  created_at timestamptz not null default now()
);

create table onboarding_quiz (
  user_id uuid primary key references users(id) on delete cascade,
  favorite_genres text[] not null default '{}',
  reference_artists text[] not null default '{}',
  preferred_mood text,
  anchor_artist text,
  anchor_title text,
  created_at timestamptz not null default now()
);

-- Ledger crudo de swipes para el taste engine (Thompson Sampling Beta-Bernoulli).
-- Reemplaza el diseño anterior basado en `direction` (left/right/up): nunca se aplicó
-- a un proyecto real, así que no había datos que migrar, y `liked`+`intensity` es lo que
-- consume el motor de scoring directamente sin traducción.
create table swipes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  track_id text not null, -- itunes track id, e.g. "itunes-123456"
  isrc text,
  liked boolean not null,
  intensity real not null default 1 check (intensity between 0.1 and 1),
  created_at timestamptz not null default now()
);
create index swipes_user_id_idx on swipes(user_id);
create index swipes_track_id_idx on swipes(track_id);

-- Cada swipe toca varias claves de dimensión (artista, década, popularidad, género),
-- cada una con el peso que le dio dimensionKeys() en el cliente al momento del swipe.
create table swipe_dimensions (
  swipe_id uuid not null references swipes(id) on delete cascade,
  dim_key text not null,
  weight real not null,
  primary key (swipe_id, dim_key)
);
create index swipe_dimensions_dim_key_idx on swipe_dimensions (dim_key);

alter table swipes enable row level security;
alter table swipe_dimensions enable row level security;
create policy "propios swipes select" on swipes for select using (auth.uid() = user_id);
create policy "propios swipes insert" on swipes for insert with check (auth.uid() = user_id);
-- swipe_dimensions se deja sin políticas propias (RLS habilitado = deny-all para clientes
-- directos): solo se lee/escribe a través de funciones security definer de abajo, nunca
-- directo desde el cliente.

create or replace function register_swipe(
  p_track_id text, p_liked boolean, p_intensity real, p_dimensions jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_swipe_id uuid;
begin
  insert into swipes (user_id, track_id, liked, intensity)
  values (auth.uid(), p_track_id, p_liked, p_intensity)
  returning id into v_swipe_id;
  insert into swipe_dimensions (swipe_id, dim_key, weight)
  select v_swipe_id, d->>'key', (d->>'weight')::real from jsonb_array_elements(p_dimensions) as d;
  return v_swipe_id;
end; $$;

-- Prior colectivo: agregado global por clave de dimensión, refrescado por hora vía
-- pg_cron (no en tiempo real, sería carísimo). get_global_stats reconcilia leyendo
-- el refresco de la hora más el delta desde entonces, para que un demo en vivo no se
-- sienta desfasado hasta 59 minutos.
create extension if not exists pg_cron;

create table view_refresh_log (
  view_name text primary key,
  refreshed_at timestamptz not null default now()
);

create materialized view global_key_stats as
select dim_key,
  sum(weight * intensity) filter (where liked) as weighted_likes,
  sum(weight * intensity) as weighted_total
from swipe_dimensions sd join swipes s on s.id = sd.swipe_id
group by dim_key;
create unique index on global_key_stats (dim_key);

-- security definer: el CTE `delta` lee swipes/swipe_dimensions directo (no la vista
-- materializada), y esas tablas tienen RLS con "auth.uid() = user_id" -- sin
-- security definer, el delta quedaría filtrado solo a los swipes de quien llama,
-- no a los de toda la comunidad, y el "global" dejaría de serlo.
create or replace function get_global_stats(p_keys text[])
returns table(dim_key text, weighted_likes real, weighted_total real)
language sql stable security definer set search_path = public as $$
  with base as (
    select dim_key, weighted_likes, weighted_total
    from global_key_stats where dim_key = any(p_keys)
  ),
  delta as (
    select sd.dim_key,
      sum(sd.weight * s.intensity) filter (where s.liked) as d_likes,
      sum(sd.weight * s.intensity) as d_total
    from swipes s
    join swipe_dimensions sd on sd.swipe_id = s.id
    where sd.dim_key = any(p_keys)
      -- coalesce a -infinity: antes del primer tick del cron, view_refresh_log está
      -- vacía y refreshed_at es NULL -- sin esto, "created_at > NULL" es UNKNOWN y el
      -- delta completo desaparece hasta la próxima hora en punto en vez de contar todo
      -- desde el arranque.
      and s.created_at > coalesce(
        (select refreshed_at from view_refresh_log where view_name = 'global_key_stats'),
        '-infinity'::timestamptz
      )
    group by sd.dim_key
  )
  select coalesce(b.dim_key, d.dim_key),
         coalesce(b.weighted_likes,0) + coalesce(d.d_likes,0),
         coalesce(b.weighted_total,0) + coalesce(d.d_total,0)
  from base b full outer join delta d using (dim_key);
$$;

select cron.schedule('refresh-global-key-stats', '0 * * * *', $$
  refresh materialized view concurrently global_key_stats;
  insert into view_refresh_log (view_name, refreshed_at) values ('global_key_stats', now())
  on conflict (view_name) do update set refreshed_at = excluded.refreshed_at;
$$);

-- Similaridad por co-ocurrencia: "a quien le gusta A también le gusta B", Jaccard sobre
-- usuarios que dieron like a cada artista. A diferencia del prior global, esta relación
-- no cambia de un día para otro, así que el refresco es diario (no horario) y sin
-- reconciliación en tiempo real -- forzarla a estar al segundo sería complejidad sin
-- beneficio real, dado que el self-join que la genera ya es caro de por sí.
create materialized view liked_artists as
select distinct s.user_id, sd.dim_key as artist_key
from swipes s join swipe_dimensions sd on sd.swipe_id = s.id
where s.liked = true and sd.dim_key like 'artista:%';

create materialized view artist_user_counts as
select artist_key, count(distinct user_id) as user_count
from liked_artists group by artist_key having count(distinct user_id) >= 5;
create unique index on artist_user_counts (artist_key);

create materialized view artist_pair_cooccurrence as
select a.artist_key as artist_a, b.artist_key as artist_b, count(*) as co_users
from liked_artists a join liked_artists b on a.user_id = b.user_id and a.artist_key < b.artist_key
where a.artist_key in (select artist_key from artist_user_counts)
  and b.artist_key in (select artist_key from artist_user_counts)
group by a.artist_key, b.artist_key having count(*) >= 3;

create materialized view artist_top_neighbors as
with mirrored as (
  select artist_a as artist_id, artist_b as neighbor_id, co_users from artist_pair_cooccurrence
  union all
  select artist_b as artist_id, artist_a as neighbor_id, co_users from artist_pair_cooccurrence
), scored as (
  select s.artist_id, s.neighbor_id,
    s.co_users::float / nullif(ua.user_count + ub.user_count - s.co_users, 0) as similarity
  from mirrored s
  join artist_user_counts ua on ua.artist_key = s.artist_id
  join artist_user_counts ub on ub.artist_key = s.neighbor_id
)
select artist_id, neighbor_id, similarity,
  row_number() over (partition by artist_id order by similarity desc) as rank
from scored;
create index on artist_top_neighbors (artist_id, rank);

select cron.schedule('refresh-cooccurrence', '0 3 * * *', $$
  refresh materialized view liked_artists;
  refresh materialized view artist_user_counts;
  refresh materialized view artist_pair_cooccurrence;
  refresh materialized view artist_top_neighbors;
$$);

-- liked_artists/artist_user_counts/artist_pair_cooccurrence son intermedias del cálculo
-- diario; no tienen RLS porque no se exponen directo al cliente, solo vía esta función.
create or replace function get_artist_neighbors(p_artist_key text, p_limit int default 5)
returns table(neighbor_id text, similarity real)
language sql stable as $$
  select neighbor_id, similarity from artist_top_neighbors
  where artist_id = p_artist_key order by rank limit p_limit;
$$;

create table collections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('para_escuchar', 'escuchadas', 'personalizada')),
  created_at timestamptz not null default now()
);

create table collection_items (
  id uuid primary key default uuid_generate_v4(),
  collection_id uuid not null references collections(id) on delete cascade,
  track_id text not null,
  position integer not null default 0,
  added_at timestamptz not null default now()
);
create index collection_items_collection_id_idx on collection_items(collection_id);

create table posts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  track_id text,
  text text,
  rating integer check (rating between 1 and 5),
  genre_tag text,
  created_at timestamptz not null default now()
);
create index posts_genre_tag_idx on posts(genre_tag);

create table post_likes (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table post_comments (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create table taste_profile (
  user_id uuid primary key references users(id) on delete cascade,
  favorite_genres text[] not null default '{}',
  recurring_artists text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table mood_prompts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  chip text,
  free_text text,
  created_at timestamptz not null default now()
);

create table mascots (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null default 'Showmi',
  level integer not null default 1,
  created_at timestamptz not null default now()
);

create table cosmetics (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null,
  genre_tag text,
  level integer check (level between 1 and 3),
  acquisition_method text not null check (acquisition_method in ('earned', 'purchased')),
  earn_requirement text -- e.g. 'reggaeton_level_2', 'review_count_10', 'genre_diversity_5', 'streak_7'
);

create table genre_progress (
  user_id uuid not null references users(id) on delete cascade,
  genre_tag text not null,
  review_count integer not null default 0,
  current_level integer not null default 0,
  primary key (user_id, genre_tag)
);

create table user_cosmetics (
  user_id uuid not null references users(id) on delete cascade,
  cosmetic_id uuid not null references cosmetics(id) on delete cascade,
  acquired_at timestamptz not null default now(),
  source text not null check (source in ('review', 'streak', 'purchase', 'milestone')),
  primary key (user_id, cosmetic_id)
);

create table weekly_community_picks (
  week_start date not null,
  track_id text not null,
  position integer not null,
  score numeric not null,
  primary key (week_start, track_id)
);

-- Row Level Security: every user-owned table should only be readable/writable
-- by its owner. `swipes`/`swipe_dimensions` already have this (see above, next to
-- their table definitions) since the taste engine needed it end to end. Everything
-- else below is still a TODO for when a real Supabase project exists -- policies
-- depend on how auth.uid() maps to users.id in the final auth flow.

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

-- ---------------------------------------------------------------------------
-- Showmi More (tier de pago): RevenueCat + insignia visible (2026-09-01)
-- ---------------------------------------------------------------------------
-- `es_premium` es la copia server-side del entitlement de RevenueCat (fuente real de verdad:
-- el SDK del cliente, ver src/lib/revenuecat.ts) -- existe SOLO para que el Feed pueda mostrar
-- la insignia de otros usuarios (get_feed_posts no puede ver el CustomerInfo de nadie más).
-- El cliente la escribe él mismo (set_premium_status) cada vez que cambia su CustomerInfo, ver
-- useRevenueCatSync.ts -- no es un webhook de RevenueCat, ver nota de robustez consciente en
-- src/api/subscriptionClient.ts (suficiente para el v1 del Shipaton, endurecerlo es trabajo
-- futuro).
alter table users add column es_premium boolean not null default false;

create or replace function set_premium_status(p_is_premium boolean)
returns void language sql security definer set search_path = public as $$
  update users set es_premium = p_is_premium where id = auth.uid();
$$;

-- get_feed_posts cambia de columnas de salida -- Postgres no permite CREATE OR REPLACE
-- cuando cambia el shape de retorno de una función que regresa tabla, hay que dropearla.
drop function if exists get_feed_posts(text[], int);

create or replace function get_feed_posts(p_genre_tags text[] default null, p_limit int default 30)
returns table(
  post_id uuid, user_id uuid, track_id text, post_text text, rating int,
  genre_tag text, created_at timestamptz, is_official boolean, is_premium boolean
)
language sql stable security definer set search_path = public as $$
  select p.id, p.user_id, p.track_id, p.text, p.rating, p.genre_tag, p.created_at, u.es_cuenta_oficial, u.es_premium
  from posts p
  join users u on u.id = p.user_id
  where p_genre_tags is null or p.genre_tag = any(p_genre_tags)
  order by p.created_at desc
  limit p_limit;
$$;

-- ---------------------------------------------------------------------------
-- Caché compartido de búsquedas de iTunes (2026-09-09)
-- ---------------------------------------------------------------------------
-- Arregla de raíz los 403 que el commit del 2026-09-08 diagnosticó pero no pudo
-- resolver desde el cliente. El problema nunca fue de concurrencia ni de reintentos:
-- la Search API de iTunes limita a ~20 req/min por IP, y armar un deck disparaba ~40
-- búsquedas DESDE CADA CLIENTE, sin compartir nada. Cada usuario -- y cada "cargar
-- más" del mismo usuario -- volvía a pagar la misma cuota por las mismas canciones,
-- porque los pools crudos salen de los mismos tags de Last.fm y se solapan muchísimo.
--
-- Esta tabla es la memoria que faltaba. La escribe SOLO la Edge Function
-- `itunes-search` con el service role; el cliente nunca la toca directo (no hay policy
-- de select para anon a propósito -- la única puerta es la función, que es la que
-- sabe pedir lo que falta sin reventar la cuota).
--
-- `results` es un ARRAY de tracks ya normalizados al shape que consume el cliente, y
-- un array VACÍO es un resultado legítimo y cacheable: "esta búsqueda no tiene match
-- con clip de 30s". Repetir una búsqueda que ya se sabe vacía gasta exactamente la
-- misma cuota que una que sí sirve, así que el caché negativo vale tanto como el
-- positivo. Lo que NO se cachea nunca es un 403: eso no es un resultado, es la
-- ausencia de uno.
create table itunes_search_cache (
  -- normalizeForMatch(artista)::normalizeForMatch(título)::limit -- misma normalización
  -- que src/api/normalize.ts (acentos, feat., puntuación) para que "Bad Bunny" y
  -- "bad bunny" no ocupen dos filas ni gasten dos búsquedas.
  query_key text primary key,
  results jsonb not null,
  fetched_at timestamptz not null default now()
);

-- Para el barrido por antigüedad (ver TTL en la Edge Function): las URLs de artwork y de
-- preview de iTunes sí caducan, así que una fila vieja se re-resuelve en vez de servir un
-- clip muerto.
create index itunes_search_cache_fetched_at_idx on itunes_search_cache (fetched_at);

alter table itunes_search_cache enable row level security;
-- Sin policies a propósito: el service role las salta, y no hay nadie más que deba entrar.

-- ---------------------------------------------------------------------------
-- Vibra: arranque heurístico + umbral más bajo (2026-09-12)
-- ---------------------------------------------------------------------------
-- Por qué: la simulación de tráfico del 2026-09-12 demostró que la dimensión de vibra estaba
-- MUERTA en la práctica, no por un bug sino por un huevo-y-gallina de diseño. `track_canonical_vibe`
-- exigía 3 votos por canción, votar solo se podía desde el Feed (sobre canciones ya posteadas),
-- y el resultado medido fue: `vibra:fiesta` en el perfil local quedó EXACTAMENTE en el valor
-- sembrado por el onboarding (alpha 2.25 / beta 0.75) después de ~50 swipes -- ni un solo swipe
-- la tocó. En cadena: el filtro duro por vibra no matcheaba nada y se relajaba siempre (la app
-- mostraba "había pocas canciones de esa vibra" en la PRIMERA pantalla de cada sesión), el
-- SESSION_VIBE_BOOST multiplicaba una clave sin evidencia, y el halo por vibra nunca se activaba.
--
-- Se ataca por los dos lados: un piso heurístico para que ninguna canción se quede sin vibra, y
-- un umbral alcanzable para que la comunidad pueda corregir ese piso de verdad.

-- Piso provisional escrito por classify-tracks (ver esa función). NO reemplaza a
-- track_canonical_vibe: el voto de la comunidad la sigue pisando cuando existe, porque la vibra
-- es subjetiva y un heurístico sobre tags de Last.fm no tiene más autoridad que la gente que ya
-- escuchó la canción. Es un piso, no una verdad.
alter table track_catalog add column vibra text check (vibra is null or vibra in
  ('fiesta','romantico','nostalgico','hype','chill','heartbreak','introspectivo','desahogo',
   'motivacional','melancolico','enamorado','sensual','empoderamiento','rabia','alegre',
   'relajacion','viaje','enfoque'));

-- Cambia el shape de retorno, así que hay que dropear (Postgres no permite CREATE OR REPLACE
-- sobre una función que devuelve tabla si cambian las columnas) -- mismo caso que get_feed_posts.
drop function if exists get_track_catalog(text[]);

create or replace function get_track_catalog(p_track_ids text[])
returns table(track_id text, idioma text, epoca text, genero text, vibra text)
language sql stable security definer set search_path = public as $$
  select track_id, idioma, epoca, genero, vibra from track_catalog where track_id = any(p_track_ids);
$$;

-- Umbral 3 -> 2. Con 12-20 testers, 3 votos sobre la MISMA canción no ocurre nunca; con el piso
-- heurístico encima, el umbral ya no decide "hay vibra o no" sino "cuándo la comunidad pisa al
-- heurístico", que es una pregunta distinta y admite un número más bajo.
--
-- No baja a 1 a propósito: con 1, el primer voto de cualquiera se vuelve canon para todos los
-- demás. 2 es el mínimo que puede llamarse consenso. Queda el caso de 2 votos empatados 1-1,
-- donde `rnk = 1` desempata de forma arbitraria -- aceptado a sabiendas: el heurístico que
-- reemplaza tampoco era mejor que una opinión suelta.
--
-- Una vista materializada no admite CREATE OR REPLACE cuando cambia su definición: hay que
-- dropear y recrear, con su índice único (el `refresh concurrently` del cron lo exige).
drop materialized view if exists track_canonical_vibe;

create materialized view track_canonical_vibe as
select track_id, vibe, votes, total_votes from (
  select track_id, vibe, count(*) as votes,
    sum(count(*)) over (partition by track_id) as total_votes,
    row_number() over (partition by track_id order by count(*) desc) as rnk
  from track_vibe_votes group by track_id, vibe
) ranked
where rnk = 1 and total_votes >= 2;

create unique index on track_canonical_vibe (track_id);

-- ---------------------------------------------------------------------------
-- Cierre de RLS en las 12 tablas que quedaron abiertas (2026-09-13)
-- ---------------------------------------------------------------------------
-- HALLAZGO: una auditoría de la base real encontró 12 tablas del esquema `public` sin RLS.
-- En Supabase eso NO es "sin configurar": es acceso total de lectura y escritura para
-- cualquiera que tenga la anon key -- y la anon key es pública por diseño, va dentro del
-- bundle de la app (EXPO_PUBLIC_SUPABASE_ANON_KEY). Es exactamente lo que el propio linter de
-- Supabase marca como `rls_disabled_in_public`.
--
-- Hoy el daño es limitado porque casi todas están vacías (el cliente todavía usa stores
-- locales de zustand y nunca las escribe), con una excepción real: `weekly_community_picks`
-- tiene 10 filas y cualquiera podía reescribir el feed curado. Pero el agujero importa sobre
-- todo hacia adelante: `taste_profile` y `collections` están documentadas como el destino de
-- sincronización del perfil y la biblioteca, así que el día que el cliente empiece a escribir
-- ahí, el perfil de gustos y la biblioteca de CADA usuario nacerían world-readable y
-- world-writable.
--
-- Criterio de cada política, según lo que el cliente realmente hace (verificado con grep):
--   - `weekly_community_picks` es la ÚNICA que el cliente lee directo (postsClient.ts:116),
--     así que conserva SELECT público. Escribirla sigue siendo cosa del cron/service role.
--   - Las de datos por usuario se cierran a su dueño vía auth.uid().
--   - Las sociales (likes/comentarios) llevan SELECT público -- si no, no se pueden mostrar
--     los conteos ni los comentarios de nadie más -- y escritura solo propia.
--   - `view_refresh_log` es bitácora interna: RLS sin ninguna política, o sea solo el service
--     role. Mismo patrón que `itunes_search_cache`.

-- ---------- Datos por usuario: solo su dueño ----------

alter table taste_profile enable row level security;
create policy "propio perfil de gustos" on taste_profile for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table collections enable row level security;
create policy "propias colecciones" on collections for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- collection_items no tiene user_id: la pertenencia se resuelve por su colección.
alter table collection_items enable row level security;
create policy "items de mis colecciones" on collection_items for all
  using (exists (select 1 from collections c where c.id = collection_items.collection_id and c.user_id = auth.uid()))
  with check (exists (select 1 from collections c where c.id = collection_items.collection_id and c.user_id = auth.uid()));

alter table genre_progress enable row level security;
create policy "propio progreso por genero" on genre_progress for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table user_cosmetics enable row level security;
create policy "propios cosmeticos" on user_cosmetics for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table mascots enable row level security;
create policy "propia mascota" on mascots for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table mood_prompts enable row level security;
create policy "propios prompts de animo" on mood_prompts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Social: se leen públicas, se escriben solo propias ----------

alter table post_likes enable row level security;
create policy "likes visibles" on post_likes for select using (true);
create policy "dar propio like" on post_likes for insert with check (auth.uid() = user_id);
create policy "quitar propio like" on post_likes for delete using (auth.uid() = user_id);

alter table post_comments enable row level security;
create policy "comentarios visibles" on post_comments for select using (true);
create policy "escribir propio comentario" on post_comments for insert with check (auth.uid() = user_id);
create policy "editar propio comentario" on post_comments for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "borrar propio comentario" on post_comments for delete using (auth.uid() = user_id);

-- ---------- Catálogos públicos de solo lectura ----------
-- SELECT para todos, ninguna política de escritura: las llena el service role.

alter table cosmetics enable row level security;
create policy "catalogo de cosmeticos visible" on cosmetics for select using (true);

alter table weekly_community_picks enable row level security;
create policy "picks de la semana visibles" on weekly_community_picks for select using (true);

-- ---------- Interno: nadie del lado cliente ----------

alter table view_refresh_log enable row level security;

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

-- ---------------------------------------------------------------------------
-- pg_net se queda en `public`, y es a proposito (2026-09-13)
-- ---------------------------------------------------------------------------
-- El advisor de seguridad de Supabase marca `extension_in_public` para pg_net y la
-- recomendacion generica es moverla. NO SE PUEDE, y ademas no hace falta. Comprobado contra
-- el proyecto real, en este orden:
--
--   1. `alter extension pg_net set schema extensions` ->
--      ERROR 0A000: extension "pg_net" does not support SET SCHEMA
--      La extension declara `extrelocatable = false` (verificado en pg_extension), asi que
--      Postgres se niega. No es una cuestion de permisos ni de orden.
--
--   2. Cero objetos de pg_net viven en `public`: los 15 reales (tablas de cola, secuencias y
--      las funciones http_*) estan en su propio esquema `net`. El lint marca el NAMESPACE DE
--      REGISTRO de la extension, no una superficie expuesta.
--
--   3. PostgREST publica solo `public,graphql_public`. `net` no esta, y /rest/v1/rpc/http_post
--      responde 404 con la anon key. No hay forma de invocarla desde fuera.
--
-- La unica via para "moverla" seria DROP + CREATE en otro esquema, que se llevaria el esquema
-- `net` con sus colas y rompería los dos cron jobs que usan net.http_post
-- (classify-tracks-daily y seed-official-feed-weekly). Cambio con riesgo real a cambio de
-- cero ganancia de seguridad: no se hace.
