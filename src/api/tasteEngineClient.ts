import { supabase } from '../lib/supabase';
import { CoOccurrence, DimensionWeight, GlobalStats, Neighbor } from '../lib/tasteEngine';

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
 * Trae vecinos para varios artistas en paralelo (get_artist_neighbors solo acepta uno a la
 * vez) y arma el mapa CoOccurrence con la forma que espera `pickNeighborStats`.
 */
export async function fetchArtistNeighborsBatch(artistIds: string[]): Promise<CoOccurrence> {
  const entries = await Promise.all(
    artistIds.map(async (artistId) => [artistId, await fetchArtistNeighbors(`artista:${artistId}`)] as const),
  );
  const co: CoOccurrence = {};
  for (const [artistId, neighbors] of entries) {
    if (neighbors.length > 0) co[artistId] = neighbors;
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
