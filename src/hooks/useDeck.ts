import { useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { findItunesTrack } from '../api/itunes';
import { getSimilarTracks, getTagTopTracks, getTrackTopTags } from '../api/lastfm';
import { normalizeForMatch } from '../api/normalize';
import { curatedAnchorsByGenre, curatedSimilarSeeds } from '../api/curatedSeeds';
import { trackToCandidate } from '../api/tasteAdapter';
import { fetchArtistNeighborsBatch, fetchGlobalStats, fetchTrackCatalog, fetchTrackVibes } from '../api/tasteEngineClient';
import { DeckAnchor, SimilarTrackSeed, Track } from '../api/types';
import { CANONICAL_GENRES, CanonicalGenre } from '../lib/genres';
import { VibeKey } from '../lib/vibes';
import { HardFilterSelection, buildDeck as runDeckPipeline } from '../lib/deckPipeline';
import { sessionTreeToMultipliers } from '../lib/sessionTree';
import {
  BetaParams,
  Candidate,
  computeSeedPrior,
  dimensionKeys,
  pickNeighborStats,
} from '../lib/tasteEngine';
import { useSessionTreeStore } from '../state/sessionTreeStore';
import { useTasteStateStore } from '../state/tasteStateStore';

export type { DeckAnchor } from '../api/types';

/**
 * Boost de sessionMultipliers para la vibra elegida en el selector de sesión. Directo sobre
 * la dimensión real `vibra:x` -- ya no es un proxy vía género (ver vibes.ts / schema.sql,
 * 2026-08-29): la vibra ahora es tan "de primera clase" como género para el motor. Más fuerte
 * que el boost derivado del árbol de sesión (`sessionTreeToMultipliers`, satura en +30%) a
 * propósito: una vibra elegida EXPLÍCITAMENTE esta sesión debe pesar más que una inferencia
 * histórica -- se aplica después y pisa esa clave si ambas la tocan (ver sessionMultipliers
 * más abajo).
 */
const SESSION_VIBE_BOOST = 2;

/**
 * Sin género de sesión: ancla aleatoria entre las 8 semillas curadas (sin
 * sesgo de género, ver curatedSeeds.ts). Con género: ancla determinística a
 * la semilla de ESE género -- es lo que hace que el filtro de género del
 * selector de sesión sea real (restringe de qué se pide similitud a
 * Last.fm), no solo un re-rankeo cosmético de un pool mixto.
 */
export function pickDefaultAnchor(genre?: CanonicalGenre | null): DeckAnchor {
  if (genre) return curatedAnchorsByGenre[genre];
  const keys = Object.keys(curatedSimilarSeeds);
  const key = keys[Math.floor(Math.random() * keys.length)];
  const [artist, title] = key.split('::');
  return { artist, title };
}

/** Tag de Last.fm más representativo de un género canónico -- primer sinónimo de la lista
 *  (ver genres.ts), usado como query directa a tag.getTopTracks. */
function primaryTagFor(genre: CanonicalGenre): string {
  return CANONICAL_GENRES.find((g) => g.key === genre)!.lastfmTagSynonyms[0];
}

function pickRandomGenres(count: number): CanonicalGenre[] {
  const shuffled = [...CANONICAL_GENRES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((g) => g.key);
}

const RAW_POOL_TAG_LIMIT = 70;

/**
 * Pool crudo de sugerencias (artista+título, todavía sin matchear contra iTunes) combinando
 * dos fuentes -- necesario porque encadenar similitud desde UNA sola canción (getSimilarTracks)
 * se topaba muy por debajo del mínimo de 50-85 candidatos que pide una sesión real:
 *  1. getSimilarTracks(anchor): personalizado, hasta 60 sugerencias encadenadas desde el ancla
 *     de esta sesión (limit subido de 20 -- ver lastfm-similar/index.ts).
 *  2. getTagTopTracks: volumen, tracks populares para uno o más tags de género directamente
 *     (hasta RAW_POOL_TAG_LIMIT cada uno). Con género de sesión elegido pega directo a ESE tag;
 *     sin género (deck mixto), samplea 2 géneros al azar en vez de depender solo de la cadena
 *     de similitud del ancla.
 * Deduplicado por artista+título normalizado (no por trackId de iTunes -- eso pasa después, en
 * fetchCandidatePool) para no gastar una búsqueda de iTunes en el mismo track sugerido dos
 * veces por fuentes distintas.
 */
async function fetchRawSuggestions(anchor: DeckAnchor, genre?: CanonicalGenre | null): Promise<SimilarTrackSeed[]> {
  const tagsToQuery = genre ? [genre] : pickRandomGenres(2);

  // allSettled, no all -- ambas funciones ya se tragan sus propios errores de red, pero esto
  // es una segunda red de seguridad: ninguna fuente individual (ej. lastfm-tag-tracks sin
  // desplegar todavía) debe poder tumbar a las demás con solo rechazar su promesa.
  const settled = await Promise.allSettled([
    getSimilarTracks(anchor.artist, anchor.title),
    ...tagsToQuery.map((g) => getTagTopTracks(primaryTagFor(g), RAW_POOL_TAG_LIMIT)),
  ]);
  const batches = settled.map((r) => (r.status === 'fulfilled' ? r.value : []));

  const seen = new Set<string>();
  const deduped: SimilarTrackSeed[] = [];
  for (const s of batches.flat()) {
    if (!s.title) continue; // fallback artist.getsimilar sin título -- nada que buscar en iTunes
    const key = `${normalizeForMatch(s.artist)}::${normalizeForMatch(s.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(s);
  }
  return deduped;
}

async function fetchCandidatePool(anchor: DeckAnchor, genre?: CanonicalGenre | null): Promise<Track[]> {
  const raw = await fetchRawSuggestions(anchor, genre);

  const settled = await Promise.allSettled(raw.map((s) => findItunesTrack(s.artist, s.title)));

  const seen = new Set<string>();
  const deck: Track[] = [];
  for (const result of settled) {
    if (result.status !== 'fulfilled' || !result.value) continue;
    const track = result.value;
    if (seen.has(track.id)) continue;
    seen.add(track.id);
    deck.push(track);
  }
  return deck;
}

/**
 * Tags reales de Last.fm por track (track.getTopTags), en batch best-effort -- alimenta
 * `resolveCanonicalGenre` con más que el único string de género de iTunes (ver tasteAdapter.ts).
 * `getTrackTopTags` ya nunca tira (try/catch interno), así que esto siempre resuelve, en el
 * peor caso con `[]` por track.
 */
async function fetchTopTagsByTrackId(pool: Track[]): Promise<Record<string, string[]>> {
  const settled = await Promise.allSettled(pool.map((track) => getTrackTopTags(track.artist, track.title)));
  const result: Record<string, string[]> = {};
  pool.forEach((track, i) => {
    const r = settled[i];
    result[track.id] = r.status === 'fulfilled' ? r.value : [];
  });
  return result;
}

/**
 * Junta las claves de dimensión sin historial local en todo el pool, trae en batch el prior
 * colectivo (consenso global + vecino por co-ocurrencia para las de artista) y las siembra
 * en el UserState local antes de puntuar. El resto del flujo de scoring sigue síncrono.
 */
async function seedMissingPriors(candidates: Candidate[]): Promise<void> {
  const { state, seedMissingKeys } = useTasteStateStore.getState();

  const missingKeys = new Set<string>();
  for (const candidate of candidates) {
    for (const { key } of dimensionKeys(candidate)) {
      if (!state[key]) missingKeys.add(key);
    }
  }
  if (missingKeys.size === 0) return;

  const missingArtistIds = [...missingKeys]
    .filter((key) => key.startsWith('artista:'))
    .map((key) => key.slice('artista:'.length));

  const [globalStats, co] = await Promise.all([
    fetchGlobalStats([...missingKeys]),
    missingArtistIds.length > 0 ? fetchArtistNeighborsBatch(missingArtistIds) : Promise.resolve({}),
  ]);

  const seeds: Record<string, BetaParams> = {};
  for (const key of missingKeys) {
    const neighborStats = key.startsWith('artista:')
      ? pickNeighborStats(key.slice('artista:'.length), state, co)
      : null;
    seeds[key] = computeSeedPrior(globalStats[key] ?? null, neighborStats);
  }
  seedMissingKeys(seeds);
}

/**
 * Pipeline de dos capas (ver deckPipeline.ts): capa 1 filtra el pool crudo de Last.fm/iTunes
 * por género/vibra de sesión (idioma/época quedan siempre en "todas" -- sin taxonomía ni
 * selector en Showmi todavía, ver tasteAdapter.ts); capa 2 rankea lo que sobrevivió con
 * Thompson Sampling + sessionMultipliers, sin tocar rankCandidatesWithExploration.
 *
 * `sessionMultipliers` mezcla dos fuentes: `sessionTreeToMultipliers` sobre el acumulador de
 * la sesión ACTUAL (sessionTreeStore -- hoy vacío en la práctica, nada lo puebla todavía
 * porque swipeStore.ts/postStore.ts no llaman `recordSwipe`, ver nota en sessionTreeStore.ts)
 * y el boost explícito de la vibra elegida en el selector de sesión, que pisa esa clave si
 * ambas la tocan.
 *
 * Separado de `buildDeck`/`buildMoreTracks` para que las dos compartan exactamente el mismo
 * ranking -- "cargar más" (ver loadMore más abajo) no es un pipeline distinto, es el mismo
 * pipeline corriendo sobre un pool crudo distinto.
 */
async function rankPool(pool: Track[], vibe?: VibeKey | null, genre?: CanonicalGenre | null): Promise<Track[]> {
  if (pool.length === 0) return pool;

  // Vibra canónica por track (voto mayoritario, puede no existir todavía para canciones con
  // pocos votos), tags reales de Last.fm por track (para resolver `genero` con más que el
  // string único de iTunes, ver trackToCandidate) y catálogo idioma/época/género ya resuelto
  // server-side (ver classify-tracks, corre a diario) -- los tres en batch, no uno por track
  // cada uno. Un track ausente del catálogo simplemente todavía no pasó por el job; trackToCandidate
  // cae al heurístico local en ese caso.
  const [vibesByTrackId, tagsByTrackId, catalogByTrackId] = await Promise.all([
    fetchTrackVibes(pool.map((track) => track.id)),
    fetchTopTagsByTrackId(pool),
    fetchTrackCatalog(pool.map((track) => track.id)),
  ]);

  const candidatesByTrackId = new Map(
    pool.map((track) => [
      track.id,
      trackToCandidate(track, vibesByTrackId[track.id], tagsByTrackId[track.id], catalogByTrackId[track.id]),
    ]),
  );
  const candidates = [...candidatesByTrackId.values()];

  await seedMissingPriors(candidates);

  const rankedState = useTasteStateStore.getState().state;
  const sessionAccumulator = useSessionTreeStore.getState().accumulator;
  const sessionMultipliers = {
    ...sessionTreeToMultipliers(sessionAccumulator),
    ...(vibe ? { [`vibra:${vibe}`]: SESSION_VIBE_BOOST } : {}),
  };

  const selection: HardFilterSelection = {
    genero: genre ?? undefined,
    vibras: vibe ? [vibe] : undefined,
  };

  const { deck } = runDeckPipeline(candidates, selection, rankedState, sessionMultipliers);

  const tracksById = new Map(pool.map((track) => [track.id, track]));
  return deck
    .map((candidate) => tracksById.get(candidate.trackId))
    .filter((track): track is Track => track !== undefined);
}

async function buildDeck(anchor: DeckAnchor, vibe?: VibeKey | null, genre?: CanonicalGenre | null): Promise<Track[]> {
  const pool = await fetchCandidatePool(anchor, genre);
  return rankPool(pool, vibe, genre);
}

/**
 * Trae otro pool crudo (misma fuente que buildDeck -- similitud del ancla + tag.getTopTracks)
 * y lo rankea igual, pero excluyendo los tracks que el deck actual ya tiene (`excludeTrackIds`)
 * para no duplicar cartas ya vistas -- ver loadMore en useDeck() más abajo.
 */
async function buildMoreTracks(
  anchor: DeckAnchor,
  vibe: VibeKey | null | undefined,
  genre: CanonicalGenre | null | undefined,
  excludeTrackIds: Set<string>,
): Promise<Track[]> {
  const pool = await fetchCandidatePool(anchor, genre);
  const freshPool = pool.filter((track) => !excludeTrackIds.has(track.id));
  return rankPool(freshPool, vibe, genre);
}

/**
 * Cuántas cartas sin ver deben quedar antes de pedir más en segundo plano -- pedido explícito
 * del usuario: "después de las sesenta canciones se busquen más". Un pool típico (con las
 * edge functions desplegadas) ronda 50-85 tracks, así que un colchón de 20 dispara la primera
 * carga extra justo alrededor de la carta 60, sin ser un índice absoluto (un pool más chico
 * -- ej. un género nicho que no llegó al mínimo -- también pide más antes de vaciarse del
 * todo, en vez de esperar a un número fijo que ese pool nunca alcanzaría).
 */
const LOAD_MORE_WHEN_REMAINING = 20;

export function useDeck(anchor: DeckAnchor | null, vibe?: VibeKey | null, genre?: CanonicalGenre | null, currentIndex = 0) {
  // Picked once per null-anchor mount so the query key stays stable across
  // re-renders instead of re-rolling (and re-fetching) a new anchor every time.
  const fallbackAnchor = useMemo(() => pickDefaultAnchor(), []);
  const resolvedAnchor = anchor ?? fallbackAnchor;
  const queryClient = useQueryClient();

  const queryKey = ['deck', resolvedAnchor.artist, resolvedAnchor.title, vibe ?? null, genre ?? null];

  const query = useQuery({
    queryKey,
    queryFn: () => buildDeck(resolvedAnchor, vibe, genre),
    staleTime: 1000 * 60 * 30,
  });

  const loadMoreMutation = useMutation({
    mutationFn: async () => {
      const current = queryClient.getQueryData<Track[]>(queryKey) ?? [];
      const excludeIds = new Set(current.map((track) => track.id));
      return buildMoreTracks(resolvedAnchor, vibe, genre, excludeIds);
    },
    onSuccess: (more) => {
      if (more.length === 0) return;
      queryClient.setQueryData<Track[]>(queryKey, (old) => [...(old ?? []), ...more]);
    },
  });

  // Dispara loadMore una sola vez por "racha baja" -- sin este ref, el efecto se re-dispararía
  // en cada swipe mientras currentIndex siga dentro del colchón (incluso ya con una carga en
  // camino, o ya habiendo pedido todo lo que la fuente tenía), inundando de mutaciones
  // repetidas. Se resuelve solo apenas vuelve a haber margen (llegó un batch nuevo de verdad).
  const hasRequestedMoreRef = useRef(false);
  useEffect(() => {
    const deck = query.data;
    if (!deck) return;
    const remaining = deck.length - currentIndex;
    if (remaining > LOAD_MORE_WHEN_REMAINING) {
      hasRequestedMoreRef.current = false;
      return;
    }
    if (hasRequestedMoreRef.current || loadMoreMutation.isPending) return;
    hasRequestedMoreRef.current = true;
    loadMoreMutation.mutate();
  }, [currentIndex, query.data, loadMoreMutation]);

  // Expuesto para que quien llama pueda sincronizar el ancla REAL (elegida o resuelta al
  // azar) de vuelta a swipeStore -- sin esto, un swipe en un deck sin género de sesión no
  // tiene forma de saber qué ancla está viendo realmente (ver sessionTreeStore.ts).
  return { ...query, resolvedAnchor };
}
