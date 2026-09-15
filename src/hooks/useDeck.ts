import { useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { findItunesCandidatesBatch } from '../api/itunes';
import { getSimilarTracks, getTagTopTracks, getTrackTopTagsBatch } from '../api/lastfm';
import { normalizeForMatch } from '../api/normalize';
import { curatedAnchorsByGenre, curatedSimilarSeeds } from '../api/curatedSeeds';
import { trackToCandidate } from '../api/tasteAdapter';
import { fetchArtistNeighborsBatch, fetchGlobalStats, fetchTrackCatalog, fetchTrackVibes } from '../api/tasteEngineClient';
import { DeckAnchor, SimilarTrackSeed, Track } from '../api/types';
import { CANONICAL_GENRES, CanonicalGenre } from '../lib/genres';
import { VibeKey } from '../lib/vibes';
import {
  FilterLevel,
  FilterableCandidate,
  HardFilterSelection,
  buildDeck as runDeckPipeline,
} from '../lib/deckPipeline';
import { sessionTreeToMultipliers } from '../lib/sessionTree';
import {
  BetaParams,
  Candidate,
  computeSeedPrior,
  dimensionKeys,
  pickNeighborStats,
  rankCandidatesWithExploration,
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

/**
 * Cuántas sugerencias crudas se mandan a resolver, y cuántos tracks se cosechan de cada una.
 *
 * El pool crudo puede traer ~200 sugerencias (hasta 60 similares + 70 por tag). El corte se
 * queda con las PRIMERAS porque el orden ya trae las similares al ancla adelante (lo
 * personalizado) y las de tag atrás (relleno de volumen), así que si algo se sacrifica río
 * abajo, se sacrifica el relleno.
 *
 * 40 x 3 da hasta 120 candidatos crudos -- medido, el pool real ronda 85-90 tras deduplicar,
 * holgado sobre MIN_POOL_SIZE (25 desde 2026-09-12, ver deckPipeline.ts).
 * Con el caché compartido (ver abajo) el techo ya no lo pone la cuota de iTunes. Este
 * comentario decía hasta 2026-09-15 que tampoco se podía subir porque rankPool pedía los tags
 * de Last.fm "con una llamada por track": eso YA NO ES CIERTO -- fetchTopTagsByTrackId usa
 * getTrackTopTagsBatch, que es UNA sola petición a lastfm-track-tags para todo el pool. Un
 * comentario viejo que prohíbe algo que ya se puede hacer cuesta más que no tener comentario.
 *
 * El límite real que queda es el tope de 120 queries por lote de lastfm-track-tags: pasado
 * eso, los tracks sobrantes se quedan sin tags (no revientan -- las dos puntas normalizan el
 * largo -- pero se rankean peor). Con el pool real en 85-90 tras deduplicar hay margen, y
 * subir de 40 acá exigiría subir también ese tope.
 */
const RAW_POOL_SEARCH_LIMIT = 40;
const CANDIDATES_PER_SEARCH = 3;

async function fetchCandidatePool(anchor: DeckAnchor, genre?: CanonicalGenre | null): Promise<Track[]> {
  const rawAll = await fetchRawSuggestions(anchor, genre);
  const raw = rawAll.slice(0, RAW_POOL_SEARCH_LIMIT);

  // Una sola petición para las 40 búsquedas, contra un caché compartido en Postgres (ver
  // itunes-search/index.ts). Antes eran 40 peticiones directas a iTunes DESDE CADA CLIENTE
  // contra un límite de ~20 req/min por IP -- el 2026-09-08 quedó medido que ninguna variante
  // de cliente (menos peticiones, menos ráfaga, reintentos) cierra esa brecha, porque el
  // problema no era el ritmo sino que nadie compartía nada con nadie.
  const { byQuery, stats } = await findItunesCandidatesBatch(
    raw.map((s) => ({ artist: s.artist, title: s.title })),
    CANDIDATES_PER_SEARCH,
  );

  const seen = new Set<string>();
  const deck: Track[] = [];
  let unresolved = 0;
  for (const tracks of byQuery) {
    // `undefined` (no se pudo preguntar) y `[]` (se preguntó y no hay clip) son cosas
    // distintas y acá siguen siéndolo -- es justo la distinción que faltaba cuando el pool
    // vacío se presentaba como "se acabaron las tarjetas".
    if (tracks === undefined) {
      unresolved++;
      continue;
    }
    for (const track of tracks) {
      if (seen.has(track.id)) continue;
      seen.add(track.id);
      deck.push(track);
    }
  }

  // Distinguir "no hubo resultados" de "la API nos rechazó". Sin esto, un rate limit de iTunes
  // devolvía un pool vacío que la UI presentaba como "Se acabaron las tarjetas" -- un mensaje
  // FALSO: no se acabaron, no se pudieron pedir. Se comprobó en vivo agotando la cuota: el deck
  // quedaba en 0 tracks y la app invitaba a "Buscar más", que volvía a fallar igual.
  // Lanzando acá, useQuery entra en isError y SwipeDeck muestra el estado de error real, con su
  // botón de reintentar, que es lo honesto y lo accionable.
  if (deck.length === 0 && unresolved > 0) {
    throw new Error(
      `No se pudo resolver ningún candidato: ${unresolved}/${raw.length} búsquedas quedaron sin respuesta` +
        (stats.throttled > 0 ? ` (${stats.throttled} rechazadas por cuota de iTunes)` : ''),
    );
  }

  return deck;
}

/**
 * Tags reales de Last.fm por track (track.getTopTags) -- alimenta `resolveCanonicalGenre` con
 * más que el único string de género de iTunes (ver tasteAdapter.ts), y es la fuente primaria
 * del heurístico de vibra.
 *
 * 2026-09-13: pasa a UNA sola petición en batch. Antes hacía `Promise.allSettled` sobre una
 * llamada POR TRACK, y medido contra el backend real eso eran 55 peticiones por deck -- el
 * mayor consumidor de red de la app, con la latencia degradándose de 475 ms a 1019 ms según se
 * encolaban. Las peticiones a Last.fm siguen siendo una por track, pero ahora salen del
 * datacenter de la Edge Function en vez del teléfono.
 *
 * `getTrackTopTagsBatch` nunca tira y devuelve un array alineado por índice, así que esto
 * siempre resuelve -- en el peor caso con `[]` por track, igual que antes.
 */
async function fetchTopTagsByTrackId(pool: Track[]): Promise<Record<string, string[]>> {
  const tagsByIndex = await getTrackTopTagsBatch(pool.map((track) => ({ artist: track.artist, title: track.title })));
  const result: Record<string, string[]> = {};
  pool.forEach((track, i) => {
    result[track.id] = tagsByIndex[i] ?? [];
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
 * la sesión ACTUAL (sessionTreeStore, que swipeStore.ts y postStore.ts sí pueblan vía
 * `recordSwipe` desde 2026-08-31 -- la nota que decía lo contrario acá quedó vieja) y el
 * boost explícito de la vibra elegida en el selector de sesión, que pisa esa clave si ambas
 * la tocan.
 *
 * Separado de `buildDeck`/`buildMoreTracks` para que las dos compartan exactamente el mismo
 * ranking -- "cargar más" (ver loadMore más abajo) no es un pipeline distinto, es el mismo
 * pipeline corriendo sobre un pool crudo distinto.
 */
/**
 * Resultado del deck: los tracks Y qué niveles del filtro duro hubo que relajar para
 * juntarlos. `relaxedLevels` antes se descartaba acá (rankPool devolvía Track[] pelado),
 * y esa era justo la queja: el filtro se relajaba en silencio y la persona veía una canción
 * "de otro género" sin ninguna explicación, lo que se lee como error de la app y no como el
 * comportamiento diseñado que es. Ahora sube hasta la UI (ver SwipeDeck).
 */
export interface DeckResult {
  tracks: Track[];
  relaxedLevels: FilterLevel[];
  /**
   * Los candidatos ya construidos que sobrevivieron al filtro duro, en el mismo orden que
   * `tracks`. Se conservan para poder RE-RANKEAR la cola sin volver a pedir nada a la red
   * (ver rerankTail más abajo): armar un candidato cuesta tres consultas en batch -- vibras,
   * tags de Last.fm y catálogo -- y ninguna de las tres cambia por swipear. Lo que cambia es
   * el UserState contra el que se puntúan, y eso es puramente local.
   */
  candidates: FilterableCandidate[];
}

async function rankPool(pool: Track[], vibe?: VibeKey | null, genre?: CanonicalGenre | null): Promise<DeckResult> {
  if (pool.length === 0) return { tracks: pool, relaxedLevels: [], candidates: [] };

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

  const { deck, relaxedLevels } = runDeckPipeline(candidates, selection, rankedState, sessionMultipliers);

  const tracksById = new Map(pool.map((track) => [track.id, track]));
  // Se arman en paralelo, no con dos `.map().filter()` independientes: `candidates` tiene que
  // quedar alineado índice a índice con `tracks` para que el re-rankeo de la cola pueda cortar
  // los dos por el mismo punto. Un candidato cuyo track ya no está en el pool se descarta de
  // ambas listas a la vez.
  const tracks: Track[] = [];
  const alignedCandidates: FilterableCandidate[] = [];
  for (const candidate of deck) {
    const track = tracksById.get(candidate.trackId);
    if (!track) continue;
    // La vibra canónica y el género canónico ya se resolvieron arriba para rankear; antes se
    // descartaban acá al devolver Track[]. Se adjuntan para que la tarjeta pueda reaccionar a
    // ellos (halo por género+vibra, ver theme/glow.ts) y -- más importante -- para que el
    // swipe sobre esta carta registre EXACTAMENTE las mismas categorías que se usaron para
    // mostrarla, en vez de re-resolverlas peor (ver trackToCandidate).
    // Los dos salen del CANDIDATO, no de las fuentes crudas. `genero` ya era así; `vibe` no, y
    // era un hueco real medido el 2026-09-12: acá se adjuntaba solo `vibesByTrackId` (el voto
    // de la comunidad), así que con el arranque heurístico recién puesto el filtro duro SÍ veía
    // la vibra provisional (va por `candidate.vibras`) pero el swipe NO la registraba -- el
    // Track llegaba a swipeStore con `vibe: null` y la dimensión `vibra:` seguía sin aprenderse.
    // Medido: las claves de vibra existían pero todas en el prior neutro 1/1, sin un solo swipe
    // encima. `candidate.vibe` ya trae la precedencia completa (comunidad > heurístico).
    tracks.push({
      ...track,
      vibe: (candidate.vibe as VibeKey | undefined) ?? null,
      genero: (candidate.genero as CanonicalGenre | undefined) ?? null,
    });
    alignedCandidates.push(candidate);
  }

  return { tracks, relaxedLevels, candidates: alignedCandidates };
}

async function buildDeck(anchor: DeckAnchor, vibe?: VibeKey | null, genre?: CanonicalGenre | null): Promise<DeckResult> {
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
): Promise<DeckResult> {
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

/**
 * Cada cuántos swipes se vuelve a rankear la cola del deck.
 *
 * Hasta 2026-09-09 el deck se rankeaba UNA sola vez, al traerlo (`staleTime` de 30 min), así
 * que las ~120 cartas ya cargadas conservaban su orden pasara lo que pasara: lo aprendido
 * solo se notaba en el siguiente `loadMore` (a partir de la carta ~100) o en la sesión
 * siguiente. Desde el lado de quien swipea eso se lee como que la app no aprende nada.
 *
 * 5 es el compromiso: suficientes señales para que el re-rankeo signifique algo (un solo
 * swipe apenas mueve una Beta, ver DECAY en tasteEngine.ts) y suficientemente seguido para
 * notarse dentro de una sesión.
 */
const RERANK_EVERY_SWIPES = 5;

/**
 * Cuántas cartas por delante de la actual quedan CONGELADAS al re-rankear.
 *
 * Sin esto, la carta que estás por ver podría cambiar entre que la ves asomar y la swipeas.
 * El colchón hace que el re-rankeo solo toque lo que todavía no es visible ni inminente: la
 * pila se reordena por detrás, nunca bajo el dedo.
 */
const RERANK_LOOKAHEAD = 5;

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
      const current = queryClient.getQueryData<DeckResult>(queryKey);
      const excludeIds = new Set((current?.tracks ?? []).map((track) => track.id));
      return buildMoreTracks(resolvedAnchor, vibe, genre, excludeIds);
    },
    onSuccess: (more) => {
      if (more.tracks.length === 0) return;
      // relaxedLevels se REEMPLAZA, no se acumula: describe la tanda que se acaba de traer,
      // que es lo que la persona está por ver. Acumular dejaría el aviso pegado para siempre
      // apenas una sola recarga hubiera tenido que relajar algo.
      queryClient.setQueryData<DeckResult>(queryKey, (old) => ({
        tracks: [...(old?.tracks ?? []), ...more.tracks],
        relaxedLevels: more.relaxedLevels,
        // Se concatenan igual que `tracks` para no romper la alineación índice a índice de
        // la que depende el re-rankeo de la cola.
        candidates: [...(old?.candidates ?? []), ...more.candidates],
      }));
    },
  });

  // Re-rankeo de la cola mientras se swipea -- ver RERANK_EVERY_SWIPES / RERANK_LOOKAHEAD.
  const lastRerankedAtRef = useRef(0);
  useEffect(() => {
    const deck = query.data;
    if (!deck) return;
    // currentIndex hacia atrás = el deck se reinició (reanchor / clearAnchor / resetIndex,
    // ver swipeStore.ts). Sin esto el ref se quedaría en un índice del deck anterior y
    // bloquearía el primer re-rankeo del nuevo hasta rebasarlo.
    if (currentIndex < lastRerankedAtRef.current) lastRerankedAtRef.current = 0;
    if (currentIndex < RERANK_EVERY_SWIPES) return;
    if (currentIndex - lastRerankedAtRef.current < RERANK_EVERY_SWIPES) return;

    const frozenUntil = currentIndex + RERANK_LOOKAHEAD;
    // Con menos de dos cartas más allá del colchón no hay nada que reordenar; salir ANTES de
    // marcar el ref para que el re-rankeo vuelva a intentarse cuando `loadMore` traiga cola
    // nueva, en vez de quedar bloqueado por un intento que no hizo nada.
    if (deck.tracks.length - frozenUntil < 2) return;
    lastRerankedAtRef.current = currentIndex;

    queryClient.setQueryData<DeckResult>(queryKey, (old) => {
      if (!old || old.tracks.length - frozenUntil < 2) return old;

      const tailCandidates = old.candidates.slice(frozenUntil);
      const tailTracksById = new Map(old.tracks.slice(frozenUntil).map((track) => [track.id, track]));

      // Mismo ranking suave que usó rankPool, con el estado de AHORA: lo aprendido en los
      // últimos swipes ya está en tasteStateStore (registerLocalSwipe es síncrono) y en el
      // acumulador del árbol de sesión. El filtro duro NO se vuelve a correr -- la membresía
      // del pool ya se decidió y capa 2 nunca agrega candidatos que capa 1 excluyó
      // (ver deckPipeline.ts).
      const reranked = rankCandidatesWithExploration(
        tailCandidates,
        useTasteStateStore.getState().state,
        undefined,
        {
          ...sessionTreeToMultipliers(useSessionTreeStore.getState().accumulator),
          ...(vibe ? { [`vibra:${vibe}`]: SESSION_VIBE_BOOST } : {}),
        },
      ) as FilterableCandidate[];

      const newTailTracks: Track[] = [];
      const newTailCandidates: FilterableCandidate[] = [];
      for (const candidate of reranked) {
        const track = tailTracksById.get(candidate.trackId);
        if (!track) continue;
        newTailTracks.push(track);
        newTailCandidates.push(candidate);
      }

      return {
        ...old,
        tracks: [...old.tracks.slice(0, frozenUntil), ...newTailTracks],
        candidates: [...old.candidates.slice(0, frozenUntil), ...newTailCandidates],
      };
    });
    // queryKey se arma nuevo en cada render (es un array literal); depender de él dispararía
    // este efecto en todos. Las partes que de verdad lo identifican son las de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, query.data, queryClient, vibe, resolvedAnchor.artist, resolvedAnchor.title, genre]);

  // Dispara loadMore una sola vez por "racha baja" -- sin este ref, el efecto se re-dispararía
  // en cada swipe mientras currentIndex siga dentro del colchón (incluso ya con una carga en
  // camino, o ya habiendo pedido todo lo que la fuente tenía), inundando de mutaciones
  // repetidas. Se resuelve solo apenas vuelve a haber margen (llegó un batch nuevo de verdad).
  const hasRequestedMoreRef = useRef(false);
  useEffect(() => {
    const deck = query.data;
    if (!deck) return;
    const remaining = deck.tracks.length - currentIndex;
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
