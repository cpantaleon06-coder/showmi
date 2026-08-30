/**
 * Taxonomía canónica de género -- fuente única reutilizada por el selector de
 * sesión (vibra/género) y, más adelante, por el sistema de progreso de
 * género de la mascota/Camerino (misma tabla de sinónimos de tags de Last.fm
 * descrita en el spec original, para no tener dos listas que se desalineen).
 *
 * Los tags de Last.fm son texto libre de la comunidad (folksonomía), no un
 * catálogo fijo -- por eso `lastfmTagSynonyms` es una lista de variantes
 * conocidas por canonicalGenre, nunca un match exacto de un solo tag.
 */
export type CanonicalGenre =
  | 'corridos_tumbados_regional'
  | 'banda_norteno'
  | 'reggaeton'
  | 'rock_metal'
  | 'indie_lofi'
  | 'electronica'
  | 'jazz'
  | 'punk';

export interface GenreDef {
  key: CanonicalGenre;
  label: string;
  emoji: string;
  lastfmTagSynonyms: string[];
}

export const CANONICAL_GENRES: GenreDef[] = [
  {
    key: 'corridos_tumbados_regional',
    label: 'Corridos/Regional',
    emoji: '🤠',
    lastfmTagSynonyms: ['corridos tumbados', 'corrido tumbado', 'corrido bélico', 'sad sierreño', 'sierreño', 'corridos'],
  },
  {
    key: 'banda_norteno',
    label: 'Banda/Norteño',
    emoji: '🪗',
    // "regional mexicano" es un tag paraguas ambiguo -- solo se usa como
    // respaldo si no aparece ningún tag más específico entre los top tags.
    lastfmTagSynonyms: ['banda', 'norteño', 'banda sinaloense', 'grupero', 'regional mexicano'],
  },
  {
    key: 'reggaeton',
    label: 'Reggaetón',
    emoji: '🎤',
    lastfmTagSynonyms: ['reggaeton', 'reggaetón', 'urbano latino', 'latin urban', 'trap latino'],
  },
  {
    key: 'rock_metal',
    label: 'Rock/Metal',
    emoji: '🎸',
    lastfmTagSynonyms: ['rock', 'metal', 'hard rock', 'heavy metal', 'alternative rock', 'grunge'],
  },
  {
    key: 'indie_lofi',
    label: 'Indie/Lo-fi',
    emoji: '🎧',
    lastfmTagSynonyms: ['indie', 'indie pop', 'indie rock', 'lo-fi', 'lofi', 'bedroom pop'],
  },
  {
    key: 'electronica',
    label: 'Electrónica',
    emoji: '🎛️',
    lastfmTagSynonyms: ['electronic', 'electronica', 'edm', 'house', 'techno', 'synthwave'],
  },
  {
    key: 'jazz',
    label: 'Jazz',
    emoji: '🎷',
    lastfmTagSynonyms: ['jazz', 'smooth jazz', 'jazz fusion', 'bebop'],
  },
  {
    key: 'punk',
    label: 'Punk',
    emoji: '🤘',
    lastfmTagSynonyms: ['punk', 'punk rock', 'pop punk', 'hardcore punk'],
  },
];

/**
 * Revisa los top tags de un track contra la tabla, en orden de especificidad
 * (todas las claves excepto banda_norteno se revisan primero; "regional
 * mexicano" de banda_norteno solo entra si nada más específico matcheó).
 * Usado por el matching de género real (Last.fm track.getTopTags) cuando
 * exista esa llamada -- hoy vive aquí para que el selector de sesión y el
 * futuro Camerino compartan exactamente la misma tabla.
 */
export function resolveCanonicalGenre(topTags: string[]): CanonicalGenre | null {
  const normalized = topTags.map((t) => t.toLowerCase().trim());
  const specific = CANONICAL_GENRES.filter((g) => g.key !== 'banda_norteno');
  for (const genre of specific) {
    if (genre.lastfmTagSynonyms.some((tag) => normalized.includes(tag))) return genre.key;
  }
  const bandaNorteno = CANONICAL_GENRES.find((g) => g.key === 'banda_norteno')!;
  if (bandaNorteno.lastfmTagSynonyms.some((tag) => normalized.includes(tag))) return 'banda_norteno';
  return null;
}
