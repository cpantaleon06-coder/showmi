import { supabase } from '../lib/supabase';
import { CoOccurrence, DimensionWeight, GlobalStats, Neighbor } from '../lib/tasteEngine';
import { SessionTreeWeights } from '../lib/sessionTree';

/**
 * Persiste un swipe real en el ledger remoto (`swipes` + `swipe_dimensions` vía el RPC
 * `register_swipe`). Nunca debe bloquear la UI: quien llama la dispara sin `await` y esta
 * función se traga sus propios errores (solo los loggea) para no convertir un fallo de red
 * en una excepción no manejada en medio de un swipe.
 */
export async function registerSwipeRemote(
  trackId: string,
  liked: boolean,
  intensity: number,
  dimensions: DimensionWeight[],
): Promise<void> {
  const { error } = await supabase.rpc('register_swipe', {
    p_track_id: trackId,
    p_liked: liked,
    p_intensity: intensity,
    p_dimensions: dimensions,
  });
  if (error) {
    console.warn('[tasteEngineClient] registerSwipeRemote falló (no bloqueante):', error.message);
  }
}

/** Trae el prior colectivo (consenso global reconciliado en tiempo real) para un batch de claves */
export async function fetchGlobalStats(keys: string[]): Promise<GlobalStats> {
  if (keys.length === 0) return {};
  const { data, error } = await supabase.rpc('get_global_stats', { p_keys: keys });
  if (error) {
    console.warn('[tasteEngineClient] fetchGlobalStats falló:', error.message);
    return {};
  }
  const stats: GlobalStats = {};
  for (const row of data ?? []) {
    stats[row.dim_key] = { likes: row.weighted_likes, total: row.weighted_total };
  }
  return stats;
}

/** Trae los vecinos por co-ocurrencia de un artista (ya rankeados por similarity desc) */
export async function fetchArtistNeighbors(artistKey: string): Promise<Neighbor[]> {
  const { data, error } = await supabase.rpc('get_artist_neighbors', { p_artist_key: artistKey });
  if (error) {
    console.warn('[tasteEngineClient] fetchArtistNeighbors falló:', error.message);
    return [];
  }
  return (data ?? []).map((row: { neighbor_id: string; similarity: number }) => ({
    artistId: row.neighbor_id,
    similarity: row.similarity,
  }));
}

/**
 * Vecinos de VARIOS artistas en una sola consulta, con la forma que espera `pickNeighborStats`.
 *
 * 2026-09-13: esta función prometía batch en el nombre desde siempre, pero por dentro hacía
 * `artistIds.map(await fetchArtistNeighbors(...))` -- una petición por artista. Medido contra
 * el backend real: armar UN deck disparaba 41 llamadas a `get_artist_neighbors`, y como
 * `artist_top_neighbors` todavía está vacía (la co-ocurrencia necesita usuarios con gustos
 * solapados y su cron diario), eran 41 viajes de red para cero datos.
 *
 * Ahora es un batch de verdad contra `get_artist_neighbors_batch` (ver el bundle SQL del
 * 2026-09-13). El singular `fetchArtistNeighbors` se conserva para resolver un artista suelto.
 */
export async function fetchArtistNeighborsBatch(artistIds: string[]): Promise<CoOccurrence> {
  if (artistIds.length === 0) return {};

  const { data, error } = await supabase.rpc('get_artist_neighbors_batch', {
    p_artist_keys: artistIds.map((artistId) => `artista:${artistId}`),
  });
  if (error) {
    console.warn('[tasteEngineClient] fetchArtistNeighborsBatch falló:', error.message);
    return {};
  }

  // El RPC devuelve filas planas (artist_id, neighbor_id, similarity) ya ordenadas por rank;
  // acá se agrupan por artista conservando ese orden. Se quita el prefijo `artista:` porque
  // CoOccurrence se indexa por el id pelado (ver pickNeighborStats en tasteEngine.ts).
  const co: CoOccurrence = {};
  for (const row of (data ?? []) as { artist_id: string; neighbor_id: string; similarity: number }[]) {
    const artistId = row.artist_id.startsWith('artista:') ? row.artist_id.slice('artista:'.length) : row.artist_id;
    (co[artistId] ??= []).push({ artistId: row.neighbor_id, similarity: row.similarity });
  }
  return co;
}

/**
 * Trae la vibra canónica (voto mayoritario, >= 3 votos) para un batch de tracks. Un track
 * ausente del resultado simplemente no tiene vibra todavía -- dimensionKeys() ya sabe
 * saltarse la dimensión cuando Candidate.vibe es undefined.
 */
export async function fetchTrackVibes(trackIds: string[]): Promise<Record<string, string>> {
  if (trackIds.length === 0) return {};
  const { data, error } = await supabase.rpc('get_track_vibes', { p_track_ids: trackIds });
  if (error) {
    console.warn('[tasteEngineClient] fetchTrackVibes falló:', error.message);
    return {};
  }
  const vibes: Record<string, string> = {};
  for (const row of data ?? []) {
    vibes[row.track_id] = row.vibe;
  }
  return vibes;
}

export interface CatalogEntry {
  idioma: string | null;
  epoca: string | null;
  genero: string | null;
  /**
   * Vibra PROVISIONAL resuelta por heurístico server-side (ver classify-tracks). Es un piso,
   * no la verdad: `fetchTrackVibes` (voto de la comunidad) la pisa cuando existe -- ver el
   * orden de precedencia en trackToCandidate.
   */
  vibra: string | null;
}

/**
 * Idioma/época/género ya clasificados server-side (ver supabase/functions/classify-tracks,
 * corre a diario vía pg_cron) para un batch de tracks. Un track ausente del resultado
 * simplemente todavía no pasó por el job -- quien llama (tasteAdapter.ts) cae al
 * heurístico local en ese caso, nunca bloquea ni trata esto como error.
 */
export async function fetchTrackCatalog(trackIds: string[]): Promise<Record<string, CatalogEntry>> {
  if (trackIds.length === 0) return {};
  const { data, error } = await supabase.rpc('get_track_catalog', { p_track_ids: trackIds });
  if (error) {
    console.warn('[tasteEngineClient] fetchTrackCatalog falló:', error.message);
    return {};
  }
  const catalog: Record<string, CatalogEntry> = {};
  for (const row of (data ?? []) as {
    track_id: string; idioma: string | null; epoca: string | null; genero: string | null; vibra: string | null;
  }[]) {
    catalog[row.track_id] = { idioma: row.idioma, epoca: row.epoca, genero: row.genero, vibra: row.vibra ?? null };
  }
  return catalog;
}

/**
 * Registra (o actualiza) el voto de vibra del usuario para un track. Mismo patrón que
 * registerSwipeRemote: no bloquea la UI, se traga sus propios errores.
 */
export async function registerVibeVoteRemote(trackId: string, vibe: string): Promise<void> {
  const { error } = await supabase.rpc('register_vibe_vote', { p_track_id: trackId, p_vibe: vibe });
  if (error) {
    console.warn('[tasteEngineClient] registerVibeVoteRemote falló (no bloqueante):', error.message);
  }
}

/**
 * Consolida el acumulador de la sesión de Swipe que se acaba de cerrar en el perfil de largo
 * plazo (`session_tree_weights`, decay=0.9 + suma, ver consolidate_session_tree en
 * schema.sql). No bloquea la UI -- se dispara al salir de la pestaña Swipe o tras
 * backgrounding prolongado, nunca debe demorar esa transición. Un acumulador vacío no
 * llama al RPC (nada que consolidar, evita una escritura sin sentido).
 */
export async function consolidateSessionTree(accumulator: SessionTreeWeights): Promise<void> {
  const deltas = Object.entries(accumulator).map(([node_key, weight]) => ({ node_key, weight }));
  if (deltas.length === 0) return;
  const { error } = await supabase.rpc('consolidate_session_tree', { p_deltas: deltas });
  if (error) {
    console.warn('[tasteEngineClient] consolidateSessionTree falló (no bloqueante):', error.message);
  }
}

/** Perfil consolidado del árbol de decisiones, para suggestNextSessionSelection (sessionTree.ts). */
export async function fetchSessionTreeProfile(): Promise<SessionTreeWeights> {
  const { data, error } = await supabase.rpc('get_session_tree_profile');
  if (error) {
    console.warn('[tasteEngineClient] fetchSessionTreeProfile falló:', error.message);
    return {};
  }
  const profile: SessionTreeWeights = {};
  for (const row of (data ?? []) as { node_key: string; weight: number }[]) {
    profile[row.node_key] = row.weight;
  }
  return profile;
}

/** Conjunto explícito {artist_id -> conteo de likes} o {genre -> conteo}, para chips de Perfil. */
export async function fetchTopSets(prefix: 'artista' | 'genero' | 'vibra', limit = 5): Promise<{ dimKey: string; likedCount: number }[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase.rpc('get_top_sets', { p_user_id: user.id, p_prefix: prefix, p_limit: limit });
  if (error) {
    console.warn('[tasteEngineClient] fetchTopSets falló:', error.message);
    return [];
  }
  return (data ?? []).map((row: { dim_key: string; liked_count: number }) => ({
    dimKey: row.dim_key,
    likedCount: row.liked_count,
  }));
}
