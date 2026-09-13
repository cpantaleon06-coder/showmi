-- Bundle listo para pegar en el SQL Editor del proyecto real (wdgjdgsxmwgsqrrngxyp).
-- Corresponde a la sección "Vibra: arranque heurístico + umbral más bajo (2026-09-12)" de
-- schema.sql.
--
-- Contexto: la simulación de tráfico del 2026-09-12 midió que la dimensión de vibra estaba
-- muerta -- `vibra:fiesta` en el perfil local seguía EXACTO en el valor sembrado por el
-- onboarding tras ~50 swipes. Causa: 3 votos por canción era inalcanzable y solo se podía
-- votar desde el Feed. Esto pone un piso heurístico y baja el umbral; el voto desde el deck
-- va del lado del cliente (StarRatingPicker).
--
-- Orden importa: la columna antes que el RPC que la devuelve.

alter table track_catalog add column if not exists vibra text;

-- Se agrega aparte del ALTER para que re-correr el bundle no falle si la columna ya existía
-- sin constraint. Postgres no tiene "add constraint if not exists", de ahí el DO.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'track_catalog_vibra_check') then
    alter table track_catalog add constraint track_catalog_vibra_check check (vibra is null or vibra in
      ('fiesta','romantico','nostalgico','hype','chill','heartbreak','introspectivo','desahogo',
       'motivacional','melancolico','enamorado','sensual','empoderamiento','rabia','alegre',
       'relajacion','viaje','enfoque'));
  end if;
end $$;

-- Cambia el shape de retorno -> hay que dropear primero.
drop function if exists get_track_catalog(text[]);

create or replace function get_track_catalog(p_track_ids text[])
returns table(track_id text, idioma text, epoca text, genero text, vibra text)
language sql stable security definer set search_path = public as $$
  select track_id, idioma, epoca, genero, vibra from track_catalog where track_id = any(p_track_ids);
$$;

-- Umbral 3 -> 2. Una vista materializada no admite CREATE OR REPLACE con definición nueva.
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

-- El cron 'refresh-track-vibes' sigue apuntando a la vista por nombre, así que no hay que
-- volver a programarlo. Sí conviene un refresh manual para que la vista nueva no quede vacía
-- hasta la hora en punto. (Sin CONCURRENTLY: una matview recién creada nunca fue poblada, y
-- CONCURRENTLY falla en ese caso.)
refresh materialized view track_canonical_vibe;
