import { SimilarTrackSeed } from './types';
import { curatedSimilarSeeds } from './curatedSeeds';

// SDK 57 loads EXPO_PUBLIC_-prefixed vars from .env automatically at build
// time, so these are read directly off process.env -- no app.config wiring needed.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Exportada para que quien construya sugerencias sepa distinguir "datos reales de
 *  Last.fm" de "modo degradado con pool curado al azar" -- ver artistSuggestions.ts. */
export function edgeFunctionConfigured(): boolean {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
}

interface LastfmSimilarResponse {
  similar: { artist: string; title: string; matchScore: number }[];
  fellBackToArtist: boolean;
}

/**
 * Calls the `lastfm-similar` Supabase Edge Function, which holds the Last.fm
 * API key server-side (never bundled into the client) and internally falls
 * back from track.getSimilar to artist.getSimilar when the track has too few
 * scrobbles to have similarity data.
 *
 * Until EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY are set (no Supabase project
 * wired up yet), this returns hand-curated seed data so the swipe deck and
 * "dame más como esta" flow are demoable without live credentials.
 */
export async function getSimilarTracks(artist: string, title: string): Promise<SimilarTrackSeed[]> {
  if (!edgeFunctionConfigured()) {
    return curatedFallback(artist, title);
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/lastfm-similar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ artist, title }),
    });

    if (!res.ok) {
      return curatedFallback(artist, title);
    }

    const json = (await res.json()) as LastfmSimilarResponse;
    return json.similar.map((s) => ({ title: s.title, artist: s.artist, matchScore: s.matchScore }));
  } catch {
    // fetch() en sí puede tirar (bloqueo de CORS, sin red, DNS) -- no solo `!res.ok` --
    // sobre todo ahora que fetchRawSuggestions (useDeck.ts) combina esta llamada con
    // getTagTopTracks vía Promise.allSettled: cada fuente debe degradar sola, nunca
    // dejar caer a las demás.
    return curatedFallback(artist, title);
  }
}

function curatedFallback(artist: string, title: string): SimilarTrackSeed[] {
  const key = `${artist.toLowerCase()}::${title.toLowerCase()}`;
  const exact = curatedSimilarSeeds[key];
  if (exact) return exact;

  // No curated entry for this anchor: surface a random curated pool so the
  // deck never comes back empty while running without live Last.fm access.
  const pools = Object.values(curatedSimilarSeeds);
  return pools[Math.floor(Math.random() * pools.length)] ?? [];
}

interface LastfmTagTracksResponse {
  tracks: { artist: string; title: string; matchScore: number }[];
}

/**
 * Calls `lastfm-tag-tracks` (Last.fm tag.getTopTracks) -- fuente de VOLUMEN
 * para el pool de un deck, a diferencia de getSimilarTracks (que encadena
 * similitud desde UNA canción y se topa mucho antes del mínimo de 50-85
 * candidatos que necesita una sesión, ver fetchCandidatePool en useDeck.ts).
 * Sin Supabase configurado, cae a un pool curado al azar (misma lógica que
 * curatedFallback arriba) -- no hay dataset curado por tag todavía, así que
 * no intenta ser específico al tag pedido en ese modo degradado.
 */
export async function getTagTopTracks(tag: string, limit = 60): Promise<SimilarTrackSeed[]> {
  if (!edgeFunctionConfigured()) {
    const pools = Object.values(curatedSimilarSeeds);
    return pools[Math.floor(Math.random() * pools.length)] ?? [];
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/lastfm-tag-tracks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ tag, limit }),
    });

    if (!res.ok) return [];

    const json = (await res.json()) as LastfmTagTracksResponse;
    return json.tracks.map((t) => ({ title: t.title, artist: t.artist, matchScore: t.matchScore }));
  } catch {
    // fetch() en sí puede tirar (bloqueo de CORS, sin red, DNS) -- ver misma nota en
    // getSimilarTracks. Antes de este fix, esto tumbaba TODO fetchRawSuggestions (el
    // Promise.all fallaba entero) apenas lastfm-tag-tracks no estuviera desplegado --
    // el bug real detrás del deck vacío la primera vez que se probó esto en vivo.
    return [];
  }
}

/**
 * Calls `lastfm-track-tags` (Last.fm track.getTopTags) -- los tags reales de
 * UN track puntual, para resolver `genero` con más que el único string de
 * iTunes (ver resolveCanonicalGenre en lib/genres.ts, ya soporta un array de
 * tags, solo le faltaba una fuente que trajera más de uno). Nunca bloquea ni
 * tira: sin Supabase configurado o si la llamada falla, devuelve `[]` --
 * quien llama simplemente se queda con la resolución de un solo tag de
 * siempre, no un estado roto.
 */
/**
 * Tags de VARIOS tracks en una sola petición (modo batch de `lastfm-track-tags`, 2026-09-13).
 *
 * Reemplaza el patrón de una llamada por track, que era el mayor consumidor de red de la app:
 * medido contra el backend real, armar un deck disparaba 55 peticiones a esta función y la
 * latencia se degradaba de 475 ms a 1019 ms conforme se encolaban.
 *
 * El resultado viene ALINEADO POR ÍNDICE con `queries` -- sin claves calculadas que haya que
 * mantener sincronizadas entre cliente y función. Nunca tira: sin Supabase configurado, o si
 * la llamada falla, devuelve un array de arrays vacíos del mismo largo, que es exactamente lo
 * que el modo individual devolvía por track.
 */
export async function getTrackTopTagsBatch(queries: { artist: string; title: string }[]): Promise<string[][]> {
  const vacio = queries.map(() => [] as string[]);
  if (queries.length === 0 || !edgeFunctionConfigured()) return vacio;

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/lastfm-track-tags`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ queries }),
    });
    if (!res.ok) return vacio;
    const json = (await res.json()) as { results?: string[][] };
    const results = json.results ?? [];
    // Se normaliza el largo por si la función recortó el lote (tiene un tope propio): quien
    // llama indexa por posición y un array más corto le daría `undefined` en vez de `[]`.
    return vacio.map((_, i) => results[i] ?? []);
  } catch {
    return vacio;
  }
}

export async function getTrackTopTags(artist: string, title: string): Promise<string[]> {
  if (!edgeFunctionConfigured()) return [];

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/lastfm-track-tags`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ artist, title }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { tags: string[] };
    return json.tags ?? [];
  } catch {
    return [];
  }
}
