import { FilterableCandidate } from '../lib/deckPipeline';
import { resolveEpoca } from '../lib/epocas';
import { resolveCanonicalGenre } from '../lib/genres';
import { resolveIdioma } from '../lib/idiomas';
import { CatalogEntry } from './tasteEngineClient';
import { splitArtists } from './normalize';
import { DeckAnchor, Track } from './types';

/**
 * Track (iTunes + Last.fm) -> FilterableCandidate (taste engine + filtro duro). Huecos reales
 * frente al diseño original del motor, que asumía la Track API de Spotify:
 *  - popularity: iTunes/Last.fm no la exponen. Se omite a propósito (Candidate.popularity
 *    es opcional) en vez de sintetizar un proxy — dimensionKeys() ya sabe saltarse esa
 *    dimensión cuando no viene.
 *  - artistIds: Track solo trae `artist: string` (nombre, no id estable). Se parte con
 *    `splitArtists` (normalize.ts), que separa las colaboraciones ("Feid & Young Miko" ->
 *    dos claves) y normaliza cada nombre para que variaciones de capitalización/acentos no
 *    generen claves de dimensión distintas para el mismo artista real. Hasta 2026-09-14 esto
 *    era `[normalizeForMatch(track.artist)]`, o sea SIEMPRE un artista: cada colaboración
 *    inventaba un artista falso ("feid young miko") y las invitadas con "feat." se perdían
 *    del todo -- ver el comentario de `splitArtists`.
 *  - idioma/epoca: resueltos localmente vía `resolveIdioma`/`resolveEpoca` (idiomas.ts,
 *    epocas.ts) -- heurístico de texto y bucketing de década respectivamente, ninguno pega a
 *    red. Sin selector de sesión propio todavía (sessionFilterStore.ts solo tiene genre/vibe,
 *    ver SessionFilterSheet.tsx), así que en la práctica nunca restringen el filtro duro HOY
 *    (HardFilterSelection.idioma/epoca quedan `undefined` porque nadie los setea desde la UI
 *    todavía) -- pero SÍ quedan poblados en cada `FilterableCandidate`, listos para cuando
 *    exista ese selector, y ya alimentan el árbol de sesión (sessionTree.ts) vía
 *    `buildSessionSelection` si en el futuro se agregan ahí.
 *
 * `vibe` no viene del Track en sí (a diferencia de genre) -- es un agregado calculado sobre
 * votos de la comunidad, resuelto aparte vía fetchTrackVibes y pasado explícitamente por quien
 * llama (ver useDeck.ts). Desde 2026-09-12 hay ADEMÁS un piso heurístico server-side
 * (`catalogEntry.vibra`, ver classify-tracks) para las canciones que todavía nadie votó -- ver
 * el orden de precedencia en el cuerpo. `vibras` (plural, para el filtro duro) se arma como
 * `[vibe]` cuando hay una -- track_canonical_vibe solo guarda la vibra de mayoría (`rnk = 1`),
 * no las 2-3 simultáneas que en teoría admite la taxonomía; un arreglo de un solo elemento es
 * el caso degenerado correcto.
 *
 * `genero` es la taxonomía canónica (22 géneros) resuelta vía `resolveCanonicalGenre`, y
 * `genre` es el string crudo de iTunes. Desde 2026-09-09 el motor de scoring aprende sobre
 * `genero`, igual que el filtro duro: antes usaba `genre` crudo y eso lo dejaba aprendiendo
 * en un espacio de claves que ninguna otra parte del sistema leía (ver Candidate.genero en
 * tasteEngine.ts). `genre` se conserva como dato de la canción, ya no como dimensión.
 *
 * 2026-08-31: `resolveCanonicalGenre` ahora recibe el string de iTunes MÁS los tags reales de
 * Last.fm (`extraTags`, ver `getTrackTopTags` en lastfm.ts) en vez de un array de un solo
 * elemento -- antes la cobertura era parcial ("Latino"/"Alternative"/"Hip-Hop/Rap" no tenían
 * sinónimo exacto con el string crudo de iTunes y el track quedaba sin género canónico, ver
 * historial de este comentario); con varios tags reales de la comunidad la resolución acierta
 * muchas más veces. `extraTags` es opcional y best-effort (quien llama en useDeck.ts ya lo
 * trae con `.catch(() => [])` resuelto) -- sin él, el comportamiento es idéntico al de antes.
 */
export function trackToCandidate(
  track: Track,
  vibe?: string,
  extraTags: string[] = [],
  catalogEntry?: CatalogEntry,
): FilterableCandidate {
  const genreTags = [track.genre, ...extraTags].filter((t): t is string => !!t);

  // Precedencia de la vibra, de más a menos autoridad:
  //   1. `vibe` explícito = voto de la COMUNIDAD (fetchTrackVibes). La única fuente real.
  //   2. `track.vibe` = lo que rankPool ya resolvió y adjuntó a este Track.
  //   3. `catalogEntry.vibra` = piso HEURÍSTICO de classify-tracks (2026-09-12).
  //
  // El heurístico va último a propósito: existe para que la dimensión no esté muerta mientras
  // nadie ha votado, no para competirle a quien sí escuchó la canción.
  //
  // Que el paso 2 exista es lo que arregló el bug de 2026-09-09: swipeStore/postStore llaman a
  // esta función SIN vibra ni tags, así que el candidato de un swipe salía sin `vibe` (la
  // dimensión `vibra:` no se registraba nunca, aunque `track.vibe` viniera poblado) y con un
  // `genero` resuelto peor que el que se usó para mostrar esa misma carta.
  const resolvedVibe = vibe ?? track.vibe ?? catalogEntry?.vibra ?? undefined;
  const resolvedGenero =
    catalogEntry?.genero ??
    track.genero ??
    (genreTags.length > 0 ? (resolveCanonicalGenre(genreTags) ?? undefined) : undefined);

  return {
    trackId: track.id,
    artistIds: splitArtists(track.artist),
    releaseDate: track.releaseDate ?? '',
    genre: track.genre ?? undefined,
    vibe: resolvedVibe,
    genero: resolvedGenero,
    vibras: resolvedVibe ? [resolvedVibe] : undefined,
    idioma: catalogEntry?.idioma ?? resolveIdioma(track.title, track.artist) ?? undefined,
    epoca: catalogEntry?.epoca ?? resolveEpoca(track.releaseDate) ?? undefined,
  };
}

/** `${artist}::${title}` -- mismo formato que ya usan las claves de curatedSimilarSeeds. */
export function serializeAnchor(anchor: DeckAnchor): string {
  return `${anchor.artist}::${anchor.title}`;
}
