import { CANONICAL_GENRES, CanonicalGenre } from '../lib/genres';
import { artistsForGenre } from './curatedSeeds';
import { edgeFunctionConfigured, getTagTopTracks } from './lastfm';
import { normalizeForMatch } from './normalize';

/** Cuántos artistas se ofrecen como máximo por género elegido. */
const PER_GENRE_LIMIT = 10;
/** Tope global: con 4-5 géneros elegidos, sin esto la pantalla se volvía una lista infinita. */
const TOTAL_LIMIT = 24;
/** Cuántos tracks se piden por tag para extraer artistas distintos de ahí. */
const TRACKS_PER_TAG = 60;

/**
 * Artistas de referencia sugeridos para el onboarding.
 *
 * Antes esto era `artistsForGenre` a secas, que devuelve el artista del ancla curada más los
 * de sus semillas similares -- o sea SIEMPRE 4 nombres fijos por género, los mismos en cada
 * sesión. Ahora los 4 curados siguen yendo primero (son conocidos, on-brand y funcionan sin
 * red) y detrás se rellena con artistas reales sacados de los tracks top del tag de Last.fm
 * de ese género, hasta PER_GENRE_LIMIT.
 *
 * Por qué los tracks top y no `tag.getTopArtists`: la Edge Function que ya existe y está
 * desplegada es `lastfm-tag-tracks`. Pedir artistas directo necesitaría una función nueva y
 * un despliegue, que hoy no es posible desde acá. Los artistas distintos de los tracks top de
 * un tag son una aproximación honesta -- de hecho sesgada hacia artistas con canciones
 * populares en ese género, que es exactamente lo que sirve como "artista de referencia".
 *
 * En modo degradado (sin Edge Functions configuradas) `getTagTopTracks` devuelve un pool
 * curado AL AZAR, que no corresponde al género pedido -- por eso se chequea
 * `edgeFunctionConfigured()` antes: es mejor mostrar solo los 4 curados correctos que 10
 * nombres de un género que la persona no eligió.
 */
export async function fetchArtistSuggestions(genres: CanonicalGenre[]): Promise<string[]> {
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (artist: string) => {
    const key = normalizeForMatch(artist);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(artist);
  };

  // Los curados de TODOS los géneros elegidos van primero, para que la lista nunca dependa
  // de que la red responda.
  for (const genre of genres) {
    artistsForGenre(genre).forEach(push);
  }

  if (!edgeFunctionConfigured()) return out.slice(0, TOTAL_LIMIT);

  const perGenreCounts = new Map<CanonicalGenre, number>(genres.map((g) => [g, artistsForGenre(g).length]));

  const settled = await Promise.allSettled(
    genres.map((genre) => {
      const tag = CANONICAL_GENRES.find((g) => g.key === genre)?.lastfmTagSynonyms[0];
      return tag ? getTagTopTracks(tag, TRACKS_PER_TAG) : Promise.resolve([]);
    }),
  );

  settled.forEach((result, i) => {
    if (result.status !== 'fulfilled') return;
    const genre = genres[i];
    for (const seed of result.value) {
      if ((perGenreCounts.get(genre) ?? 0) >= PER_GENRE_LIMIT) break;
      if (out.length >= TOTAL_LIMIT) break;
      const before = out.length;
      push(seed.artist);
      if (out.length > before) perGenreCounts.set(genre, (perGenreCounts.get(genre) ?? 0) + 1);
    }
  });

  return out.slice(0, TOTAL_LIMIT);
}
