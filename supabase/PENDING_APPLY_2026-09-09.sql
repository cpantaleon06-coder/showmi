-- Bundle listo para pegar en el SQL Editor del proyecto real (wdgjdgsxmwgsqrrngxyp).
-- Corresponde EXACTAMENTE a la sección "Caché compartido de búsquedas de iTunes (2026-09-09)"
-- agregada a schema.sql en esta misma sesión.
--
-- Se arma un bundle nuevo en vez de reusar PENDING_APPLY.sql siguiendo la instrucción que ese
-- mismo archivo dejó escrita ("si en el futuro se agrega una sección nueva a schema.sql, arma
-- un bundle nuevo en vez de reusar este").
--
-- Sin esta tabla, la Edge Function `itunes-search` responde pero sirve TODO como miss: sigue
-- funcionando (nunca falla por falta de caché, a propósito) pero no ahorra ni una petición,
-- que es justo el punto. Aplicar ANTES de dar por buena la medición de hits.

create table if not exists itunes_search_cache (
  query_key text primary key,
  results jsonb not null,
  fetched_at timestamptz not null default now()
);

create index if not exists itunes_search_cache_fetched_at_idx on itunes_search_cache (fetched_at);

alter table itunes_search_cache enable row level security;
-- Sin policies a propósito: solo el service role de la Edge Function entra.
