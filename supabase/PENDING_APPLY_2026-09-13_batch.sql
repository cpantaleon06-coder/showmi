-- ---------------------------------------------------------------------------
-- get_artist_neighbors_batch: mata un N+1 medido en producción (2026-09-13)
-- ---------------------------------------------------------------------------
-- HALLAZGO: la primera simulación de tráfico contra el backend real (ya con itunes-search
-- desplegada) midió 103 peticiones de red para armar UN deck, con 66 s de latencia sumada.
-- Desglose: 55 a lastfm-track-tags, 41 a get_artist_neighbors, y 7 al resto. O sea que dos
-- patrones N+1 se comían 96 de las 103.
--
-- El de acá es el más vergonzoso de los dos porque la función del cliente YA se llamaba
-- `fetchArtistNeighborsBatch`: prometía batch en el nombre y por dentro hacía
-- `artistIds.map(await fetchArtistNeighbors(...))`, una llamada por artista. Con un pool
-- típico de ~55 tracks eso son ~41 artistas distintos, ~41 round trips.
--
-- Esta función hace en UNA consulta lo que antes eran 41: mismo dato, mismo orden, mismo
-- criterio de corte por `rank`. `get_artist_neighbors` (singular) se conserva -- sigue
-- teniendo sentido para resolver un artista suelto, y quitarla rompería a cualquiera que la
-- llame.
--
-- SECURITY DEFINER con search_path fijo, igual que su hermana: `artist_top_neighbors` ya no es
-- legible por anon desde el endurecimiento de hoy, así que la función tiene que verla por su
-- dueño. No expone nada de nadie -- es vecindad entre artistas, no dato de usuario.
create or replace function get_artist_neighbors_batch(p_artist_keys text[], p_limit int default 5)
returns table(artist_id text, neighbor_id text, similarity real)
language sql stable security definer set search_path = public as $$
  select n.artist_id, n.neighbor_id, n.similarity
  from artist_top_neighbors n
  where n.artist_id = any(p_artist_keys) and n.rank <= p_limit
  order by n.artist_id, n.rank;
$$;
