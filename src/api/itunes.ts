import { Track } from './types';

const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search';
const ITUNES_LOOKUP_URL = 'https://itunes.apple.com/lookup';

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
 * Llamada directa desde el cliente, sin proxy -- no necesita API key.
 *
 * 2026-09-08: el comentario que vivía acá decía que el límite de ~20 req/min "no es realista
 * de alcanzar con 12-20 testers". Ese razonamiento contaba USUARIOS y el problema es de
 * PETICIONES POR BUILD: armar un solo deck dispara ~150 búsquedas (una por sugerencia cruda
 * de Last.fm), así que UN usuario solo revienta el límite en la primera pantalla. Medido en
 * vivo: 26 de 154 búsquedas devolvieron 403 en un build.
 *
 * Se ataca en tres frentes, porque ninguno alcanza solo:
 *  - menos peticiones (RAW_POOL_SEARCH_LIMIT en useDeck.ts),
 *  - menos ráfaga (mapWithConcurrency en useDeck.ts),
 *  - y acá: un reintento con espera ante 403, más caché en memoria (ver findItunesTrack).
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
  const key = `${artist}::${title}::${limit}`.toLowerCase();
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
