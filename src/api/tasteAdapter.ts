import { FilterableCandidate } from '../lib/deckPipeline';
import { resolveEpoca } from '../lib/epocas';
import { resolveCanonicalGenre } from '../lib/genres';
import { resolveIdioma } from '../lib/idiomas';
import { normalizeForMatch } from './normalize';
import { DeckAnchor, Track } from './types';

/**
 * Track (iTunes + Last.fm) -> FilterableCandidate (taste engine + filtro duro). Huecos reales
 * frente al diseño original del motor, que asumía la Track API de Spotify:
 *  - popularity: iTunes/Last.fm no la exponen. Se omite a propósito (Candidate.popularity
 *    es opcional) en vez de sintetizar un proxy — dimensionKeys() ya sabe saltarse esa
 *    dimensión cuando no viene.
 *  - artistIds: Track solo trae `artist: string` (nombre, no id estable). Se normaliza con
 *    normalizeForMatch (la misma utilidad que ya usa el matching iTunes<->Last.fm) para que
 *    variaciones de capitalización/acentos no generen claves de dimensión distintas para el
 *    mismo artista real.
 *  - idioma/epoca: resueltos localmente vía `resolveIdioma`/`resolveEpoca` (idiomas.ts,
 *    epocas.ts) -- heurístico de texto y bucketing de década respectivamente, ninguno pega a
 *    red. Sin selector de sesión propio todavía (sessionFilterStore.ts solo tiene genre/vibe,
 *    ver SessionFilterSheet.tsx), así que en la práctica nunca restringen el filtro duro HOY
 *    (HardFilterSelection.idioma/epoca quedan `undefined` porque nadie los setea desde la UI
 *    todavía) -- pero SÍ quedan poblados en cada `FilterableCandidate`, listos para cuando
 *    exista ese selector, y ya alimentan el árbol de sesión (sessionTree.ts) vía
 *    `buildSessionSelection` si en el futuro se agregan ahí.
 *
 * `vibe` no viene del Track en sí (a diferencia de genre) -- es la vibra canónica votada por
 * la comunidad para ESTE track, resuelta aparte vía fetchTrackVibes y pasada explícitamente
 * por quien llama (ver useDeck.ts). Se mantiene como parámetro separado en vez de meterla en
 * Track porque no es un dato de la canción, es un agregado calculado sobre votos. `vibras`
 * (plural, para el filtro duro) se arma como `[vibe]` cuando hay una -- track_canonical_vibe
 * solo guarda la vibra de mayoría hoy (`rnk = 1` en schema.sql), no las 2-3 simultáneas que en
 * teoría admite la taxonomía; un arreglo de un solo elemento es el caso degenerado correcto.
 *
 * `genero` (para el filtro duro) es DISTINTO de `genre` (el string crudo de iTunes que ya usa
 * el motor de scoring, sin tocar): se resuelve a la taxonomía canónica de 8 géneros vía
 * `resolveCanonicalGenre`, reusando exactamente la función que ya existía para esto (pensada
 * para tags de Last.fm, no para `primaryGenreName` de iTunes -- por eso la cobertura es
 * parcial: "Rock"/"Electronic"/"Jazz" matchean por igualdad exacta con un sinónimo, pero
 * "Latino"/"Alternative"/"Hip-Hop/Rap" no tienen sinónimo exacto y quedan sin género
 * canónico, así que ese track simplemente no participa en ningún filtro POR género —
 * comportamiento seguro, no un crash, y estrictamente mejor que no resolver nada).
 */
export function trackToCandidate(track: Track, vibe?: string): FilterableCandidate {
  return {
    trackId: track.id,
    artistIds: [normalizeForMatch(track.artist)],
    releaseDate: track.releaseDate ?? '',
    genre: track.genre ?? undefined,
    vibe,
    genero: track.genre ? (resolveCanonicalGenre([track.genre]) ?? undefined) : undefined,
    vibras: vibe ? [vibe] : undefined,
    idioma: resolveIdioma(track.title, track.artist) ?? undefined,
    epoca: resolveEpoca(track.releaseDate) ?? undefined,
  };
}

/** `${artist}::${title}` -- mismo formato que ya usan las claves de curatedSimilarSeeds. */
export function serializeAnchor(anchor: DeckAnchor): string {
  return `${anchor.artist}::${anchor.title}`;
}
