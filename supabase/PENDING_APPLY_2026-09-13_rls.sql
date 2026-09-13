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
