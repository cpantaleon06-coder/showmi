import { Track } from './types';
import { normalizeForMatch } from './normalize';

const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search';
const ITUNES_LOOKUP_URL = 'https://itunes.apple.com/lookup';

// SDK 57 carga las EXPO_PUBLIC_* del .env en tiempo de build -- mismo acceso directo a
// process.env que usa lastfm.ts, sin wiring de app.config.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function edgeFunctionConfigured(): boolean {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
}

interface ItunesRawTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  primaryGenreName?: string;
  releaseDate?: string;
}

function upscaleArtwork(url: string | undefined): string {
  if (!url) return '';
  // iTunes serves 100x100 by default; the URL pattern accepts other sizes.
  return url.replace('100x100bb', '600x600bb');
}

function toTrack(raw: ItunesRawTrack): Track {
  return {
    id: `itunes-${raw.trackId}`,
    title: raw.trackName,
    artist: raw.artistName,
    album: raw.collectionName ?? '',
    artworkUrl: upscaleArtwork(raw.artworkUrl100),
    previewUrl: raw.previewUrl ?? null,
    genre: raw.primaryGenreName ?? null,
    releaseDate: raw.releaseDate ?? null,
    isrc: null,
    source: 'itunes',
  };
}

/**
 * Llamada DIRECTA a iTunes desde el cliente, sin proxy -- no necesita API key.
 *
 * 2026-09-09: esta ya NO es la ruta que usa el deck. Armar un deck por acá dispara una
 * petición por sugerencia contra un límite de ~20 req/min por IP, y el 2026-09-08 quedó
 * medido que no hay ajuste de cliente que cierre esa brecha (ni menos peticiones, ni menos
 * ráfaga, ni reintentos). El deck ahora pasa por `findItunesCandidatesBatch`, que resuelve
 * contra un caché compartido server-side.
 *
 * Sigue existiendo para los usos de UNA búsqueda suelta, donde el volumen nunca fue el
 * problema: `findItunesTrack` (resolver un track puntual) y el modo degradado sin Supabase
 * configurado.
 */
export async function searchItunesTracks(term: string, limit = 5): Promise<Track[]> {
  const url = `${ITUNES_SEARCH_URL}?term=${encodeURIComponent(term)}&entity=song&limit=${limit}`;

  // Se probó reintentar tras un 403 con 1.5s de espera y se descartó, con medición: la cuota
  // de iTunes es por MINUTO, así que el reintento cae dentro de la misma ventana agotada y
  // vuelve a fallar. Resultado medido: misma tasa de pérdida (~22%) y la carga del deck
  // pasó de 7s a 33s. Reintentar un rate limit sin esperar a que la ventana se renueve solo
  // agrega latencia.
  const res = await fetch(url);

  if (!res.ok) throw new Error(`iTunes search failed: ${res.status}`);
  const json = (await res.json()) as { results: ItunesRawTrack[] };
  return json.results.filter((r) => !!r.previewUrl).map(toTrack);
}

/**
 * Finds the best iTunes match for a given artist+title pair, used to turn a
 * Last.fm similar-track suggestion into a playable card. Returns null when
 * no result has a preview clip.
 */
/**
 * Caché en memoria de artista+título -> resultado. Los pools crudos de builds sucesivos se
 * solapan muchísimo (salen de los mismos tags de Last.fm), así que sin esto cada "cargar más"
 * vuelve a gastar cuota de la API en canciones que ya se resolvieron. Solo memoria, a
 * propósito: no vale la pena persistir un caché de matches que caduca con el catálogo, y así
 * no se agrega otra clave a AsyncStorage.
 *
 * Guarda también los `null` (no hubo match): repetir una búsqueda que ya se sabe vacía gasta
 * exactamente la misma cuota que una que sí sirve.
 */
const searchCache = new Map<string, Track[]>();

/**
 * Todos los tracks que devuelve la búsqueda de una sugerencia, no solo el mejor match.
 *
 * Antes se pedían 5 resultados y se tiraban 4 (`results[0]`), y para llenar el pool había que
 * hacer una búsqueda POR SUGERENCIA -- ~110 por deck. Con un límite de ~20 req/min eso es
 * insostenible desde el cliente: medido, el 17-22% volvía 403 y esos candidatos se perdían.
 *
 * Cosechar los resultados que ya venían en la misma respuesta da la misma cantidad de
 * candidatos con muchas menos peticiones. Los extra son lo que iTunes considera más relevante
 * para "artista título", casi siempre del mismo artista -- candidatos legítimos, y de todos
 * modos el filtro duro y el motor de gustos deciden después cuáles sobreviven.
 */
export async function findItunesCandidates(artist: string, title: string, limit = 3): Promise<Track[]> {
  // Misma clave que la ruta en batch (ver batchKey abajo) a propósito: con dos esquemas de
  // clave distintos las dos rutas compartirían el Map sin compartir NADA en la práctica, y
  // una búsqueda ya resuelta por una volvería a costar cuota si la pedía la otra.
  const key = batchKey(artist, title, limit);
  const cached = searchCache.get(key);
  if (cached !== undefined) return cached;

  const results = await searchItunesTracks(`${artist} ${title}`, limit);
  searchCache.set(key, results);
  return results;
}

export async function findItunesTrack(artist: string, title: string): Promise<Track | null> {
  const results = await findItunesCandidates(artist, title, 5);
  return results[0] ?? null;
}

/**
 * Clave de una búsqueda. Debe calcularse EXACTAMENTE igual que en la Edge Function
 * `itunes-search` (ahí está duplicada a mano, Deno no puede importar de acá): si los dos
 * lados no coinciden, el cliente pediría con una clave y el servidor guardaría con otra, y
 * el caché nunca acertaría -- un fallo silencioso que se vería solo como "sigue lento".
 */
function batchKey(artist: string, title: string, limit: number): string {
  return `${normalizeForMatch(artist)}::${normalizeForMatch(title)}::${limit}`;
}

export interface ItunesBatchStats {
  requested: number;
  cached: number;
  fresh: number;
  throttled: number;
  failed: number;
  skipped: number;
  aborted: boolean;
  unresolved: number;
}

export interface ItunesBatchResult {
  /** Candidatos por consulta, en el mismo orden en que se pidieron. Una consulta que no se
   *  pudo resolver (cuota agotada, presupuesto) NO aparece -- no se confunde con `[]`, que
   *  sí es un resultado real ("esta canción no tiene clip en iTunes"). */
  byQuery: (Track[] | undefined)[];
  stats: ItunesBatchStats;
}

export class ItunesBatchUnavailableError extends Error {}

/**
 * Resuelve MUCHAS sugerencias (artista+título) en una sola petición, vía la Edge Function
 * `itunes-search`.
 *
 * Este es el arreglo de raíz de los 403 que el 2026-09-08 solo se pudo mitigar. El problema
 * nunca fue de tuning del cliente sino de arquitectura: cada cliente pegaba a iTunes por su
 * cuenta y pagaba la cuota desde cero, sin compartir nada -- ni con su propio "cargar más"
 * de hace un minuto, ni con los demás usuarios. La Edge Function guarda lo resuelto en
 * `itunes_search_cache` (Postgres), así que una consulta cuesta cuota UNA vez en la vida del
 * proyecto y no una vez por build.
 *
 * Se mantiene el caché en memoria como primera capa: un hit acá ni siquiera cuesta la
 * petición a la Edge Function, y "cargar más" dentro de una misma sesión re-pide muchísimo.
 *
 * Sin Supabase configurado tira `ItunesBatchUnavailableError` en vez de caer a búsquedas
 * directas una por una: eso es exactamente el comportamiento que se acaba de demostrar que
 * no funciona, y hacerlo en silencio dejaría al deck degradándose sin que nadie se entere.
 * Quien llama decide qué hacer con eso (ver fetchCandidatePool en useDeck.ts).
 */
export async function findItunesCandidatesBatch(
  queries: { artist: string; title: string }[],
  limit = 3,
): Promise<ItunesBatchResult> {
  const keys = queries.map((q) => batchKey(q.artist, q.title, limit));
  const byQuery: (Track[] | undefined)[] = keys.map((key) => searchCache.get(key));

  const pendingIdx = byQuery.flatMap((hit, i) => (hit === undefined ? [i] : []));
  const memoryHits = queries.length - pendingIdx.length;

  if (pendingIdx.length === 0) {
    return {
      byQuery,
      stats: {
        requested: queries.length,
        cached: memoryHits,
        fresh: 0,
        throttled: 0,
        failed: 0,
        skipped: 0,
        aborted: false,
        unresolved: 0,
      },
    };
  }

  if (!edgeFunctionConfigured()) {
    throw new ItunesBatchUnavailableError('Supabase no está configurado: sin itunes-search no hay deck');
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/itunes-search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      queries: pendingIdx.map((i) => queries[i]),
      limit,
    }),
  });

  if (!res.ok) {
    throw new ItunesBatchUnavailableError(`itunes-search respondió ${res.status}`);
  }

  const json = (await res.json()) as {
    results: Record<string, Track[]>;
    stats: Omit<ItunesBatchStats, 'requested' | 'cached'> & { requested: number; cached: number };
  };

  for (const i of pendingIdx) {
    const resolved = json.results[keys[i]];
    if (resolved === undefined) continue;
    byQuery[i] = resolved;
    searchCache.set(keys[i], resolved);
  }

  return {
    byQuery,
    // `cached` suma las dos capas: lo que ya estaba en memoria acá y lo que la Edge Function
    // sirvió desde Postgres. Las dos significan lo mismo para lo que importa medir -- una
    // búsqueda que no costó cuota de iTunes.
    stats: { ...json.stats, requested: queries.length, cached: memoryHits + json.stats.cached },
  };
}

export async function lookupItunesTrack(trackId: number): Promise<Track | null> {
  const url = `${ITUNES_LOOKUP_URL}?id=${trackId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`iTunes lookup failed: ${res.status}`);
  const json = (await res.json()) as { results: ItunesRawTrack[] };
  const raw = json.results[0];
  return raw ? toTrack(raw) : null;
}

/**
 * Resuelve el `track_id` con el que se guarda todo en Supabase (posts, swipes,
 * community picks -- formato "itunes-123456") de vuelta a un Track completo
 * para mostrarlo. null si el id no tiene el formato esperado o ya no existe.
 */
export async function resolveStoredTrackId(storedId: string): Promise<Track | null> {
  const match = storedId.match(/^itunes-(\d+)$/);
  if (!match) return null;
  try {
    return await lookupItunesTrack(Number(match[1]));
  } catch {
    return null;
  }
}
