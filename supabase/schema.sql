-- Showmi data model. Not applied to any Supabase project yet --
-- run this against a real project once EXPO_PUBLIC_SUPABASE_URL is set.

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
