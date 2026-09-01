import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { findItunesTrack } from '../api/itunes';
import { getSimilarTracks } from '../api/lastfm';
import { curatedAnchorsByGenre, curatedSimilarSeeds } from '../api/curatedSeeds';
import { trackToCandidate } from '../api/tasteAdapter';
import { fetchArtistNeighborsBatch, fetchGlobalStats, fetchTrackVibes } from '../api/tasteEngineClient';
import { DeckAnchor, Track } from '../api/types';
import { CanonicalGenre } from '../lib/genres';
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

async function fetchCandidatePool(anchor: DeckAnchor): Promise<Track[]> {
  const similar = await getSimilarTracks(anchor.artist, anchor.title);

  const settled = await Promise.allSettled(similar.map((s) => findItunesTrack(s.artist, s.title)));

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
 */
async function buildDeck(
  anchor: DeckAnchor,
  vibe?: VibeKey | null,
  genre?: CanonicalGenre | null,
): Promise<Track[]> {
  const pool = await fetchCandidatePool(anchor);
  if (pool.length === 0) return pool;

  // Vibra canónica por track (voto mayoritario, puede no existir todavía para
  // canciones con pocos votos) -- batch en vez de una llamada por track.
  const vibesByTrackId = await fetchTrackVibes(pool.map((track) => track.id));

  const candidatesByTrackId = new Map(
    pool.map((track) => [track.id, trackToCandidate(track, vibesByTrackId[track.id])]),
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

export function useDeck(anchor: DeckAnchor | null, vibe?: VibeKey | null, genre?: CanonicalGenre | null) {
  // Picked once per null-anchor mount so the query key stays stable across
  // re-renders instead of re-rolling (and re-fetching) a new anchor every time.
  const fallbackAnchor = useMemo(() => pickDefaultAnchor(), []);
  const resolvedAnchor = anchor ?? fallbackAnchor;

  const query = useQuery({
    queryKey: ['deck', resolvedAnchor.artist, resolvedAnchor.title, vibe ?? null, genre ?? null],
    queryFn: () => buildDeck(resolvedAnchor, vibe, genre),
    staleTime: 1000 * 60 * 30,
  });

  // Expuesto para que quien llama pueda sincronizar el ancla REAL (elegida o resuelta al
  // azar) de vuelta a swipeStore -- sin esto, un swipe en un deck sin género de sesión no
  // tiene forma de saber qué ancla está viendo realmente (ver sessionTreeStore.ts).
  return { ...query, resolvedAnchor };
}
