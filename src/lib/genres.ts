/**
 * Taxonomía canónica de género -- fuente única reutilizada por el selector de
 * sesión (vibra/género) y, más adelante, por el sistema de progreso de
 * género de la mascota/Camerino (misma tabla de sinónimos de tags de Last.fm
 * descrita en el spec original, para no tener dos listas que se desalineen).
 *
 * Los tags de Last.fm son texto libre de la comunidad (folksonomía), no un
 * catálogo fijo -- por eso `lastfmTagSynonyms` es una lista de variantes
 * conocidas por canonicalGenre, nunca un match exacto de un solo tag.
 *
 * 2026-08-31: ampliada de 8 a 22, luego de 22 a 30, y luego de 30 a 37
 * géneros en una tercera pasada el mismo día -- la segunda pasada seguía
 * pesando mucho hacia Latino/en español (el propio feedback del usuario);
 * esta ronda suma mercados/idiomas que no tenían NINGÚN representante
 * todavía (Bollywood, pop árabe, pop turco, bossa nova/MPB brasileño en
 * portugués, soca/calypso caribeño, mandopop/cantopop, pop nórdico).
 * `rock_metal` se separó en `rock`/`metal` (audiencias reales distintas).
 * Cada lista de sinónimos es DISJUNTA de las demás a propósito --
 * `resolveCanonicalGenre` hace match exacto por elemento de array (no
 * substring), así que dos géneros nunca deberían compartir el mismo string
 * de tag, o el orden del array (arbitrario) decidiría cuál gana. Verificado
 * a mano al armar esta lista, las tres veces.
 */
export type CanonicalGenre =
  | 'corridos_tumbados_regional'
  | 'banda_norteno'
  | 'reggaeton'
  | 'trap_latino'
  | 'salsa'
  | 'bachata'
  | 'cumbia'
  | 'vallenato'
  | 'merengue'
  | 'ranchera_mariachi'
  | 'pop_latino'
  | 'rock'
  | 'metal'
  | 'indie_lofi'
  | 'pop'
  | 'hip_hop_rap'
  | 'rnb_soul'
  | 'electronica'
  | 'jazz'
  | 'blues'
  | 'k_pop'
  | 'j_pop'
  | 'mandopop_cantopop'
  | 'bollywood'
  | 'arabic_pop'
  | 'turkish_pop'
  | 'bossa_nova_mpb'
  | 'soca_calypso'
  | 'nordic_pop'
  | 'country_folk'
  | 'classical'
  | 'ambient_new_age'
  | 'funk_disco'
  | 'reggae'
  | 'afrobeats'
  | 'gospel_cristiana'
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
    lastfmTagSynonyms: ['reggaeton', 'reggaetón', 'urbano latino', 'latin urban'],
  },
  {
    key: 'trap_latino',
    label: 'Trap Latino',
    emoji: '🕶️',
    lastfmTagSynonyms: ['trap latino', 'latin trap', 'trap en español'],
  },
  {
    key: 'salsa',
    label: 'Salsa',
    emoji: '💃',
    lastfmTagSynonyms: ['salsa', 'salsa romantica', 'salsa dura'],
  },
  {
    key: 'bachata',
    label: 'Bachata',
    emoji: '🌹',
    lastfmTagSynonyms: ['bachata', 'bachata romantica'],
  },
  {
    key: 'cumbia',
    label: 'Cumbia',
    emoji: '🪘',
    lastfmTagSynonyms: ['cumbia', 'cumbia sonidera', 'cumbia pop'],
  },
  {
    key: 'vallenato',
    label: 'Vallenato',
    emoji: '🌴',
    lastfmTagSynonyms: ['vallenato', 'vallenato romantico'],
  },
  {
    key: 'merengue',
    label: 'Merengue',
    emoji: '🥁',
    lastfmTagSynonyms: ['merengue', 'merengue tipico'],
  },
  {
    key: 'ranchera_mariachi',
    label: 'Ranchera/Mariachi',
    emoji: '🌵',
    lastfmTagSynonyms: ['ranchera', 'rancheras', 'mariachi'],
  },
  {
    key: 'pop_latino',
    label: 'Pop Latino',
    emoji: '✨',
    lastfmTagSynonyms: ['pop latino', 'latin pop', 'latino'],
  },
  {
    key: 'rock',
    label: 'Rock',
    emoji: '🎸',
    lastfmTagSynonyms: ['rock', 'alternative rock', 'grunge', 'classic rock', 'hard rock'],
  },
  {
    key: 'metal',
    label: 'Metal',
    emoji: '⚡',
    lastfmTagSynonyms: ['metal', 'heavy metal', 'thrash metal', 'death metal'],
  },
  {
    key: 'indie_lofi',
    label: 'Indie/Lo-fi',
    emoji: '🎧',
    lastfmTagSynonyms: ['indie', 'indie pop', 'indie rock', 'lo-fi', 'lofi', 'bedroom pop'],
  },
  {
    key: 'pop',
    label: 'Pop',
    emoji: '🎶',
    lastfmTagSynonyms: ['pop', 'pop rock', 'dance pop', 'synth-pop'],
  },
  {
    key: 'hip_hop_rap',
    label: 'Hip-Hop/Rap',
    emoji: '🎙️',
    lastfmTagSynonyms: ['hip hop', 'hip-hop', 'rap', 'trap'],
  },
  {
    key: 'rnb_soul',
    label: 'R&B/Soul',
    emoji: '🎵',
    lastfmTagSynonyms: ['r&b', 'rnb', 'soul', 'neo soul'],
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
    key: 'blues',
    label: 'Blues',
    emoji: '🎺',
    lastfmTagSynonyms: ['blues', 'delta blues', 'electric blues'],
  },
  {
    key: 'k_pop',
    label: 'K-Pop',
    emoji: '💜',
    lastfmTagSynonyms: ['k-pop', 'kpop', 'korean pop'],
  },
  {
    key: 'j_pop',
    label: 'J-Pop',
    emoji: '🎌',
    lastfmTagSynonyms: ['j-pop', 'jpop', 'japanese pop'],
  },
  {
    key: 'mandopop_cantopop',
    label: 'Mandopop/Cantopop',
    emoji: '🐉',
    lastfmTagSynonyms: ['mandopop', 'cantopop', 'chinese pop'],
  },
  {
    key: 'bollywood',
    label: 'Bollywood',
    emoji: '🎬',
    lastfmTagSynonyms: ['bollywood', 'indian pop', 'hindi pop'],
  },
  {
    key: 'arabic_pop',
    label: 'Pop Árabe',
    emoji: '🕌',
    lastfmTagSynonyms: ['arabic pop', 'khaleeji', 'arab pop'],
  },
  {
    key: 'turkish_pop',
    label: 'Pop Turco',
    emoji: '🌟',
    lastfmTagSynonyms: ['turkish pop', 'pop turco', 'türkçe pop'],
  },
  {
    key: 'bossa_nova_mpb',
    label: 'Bossa Nova/MPB',
    emoji: '🌊',
    lastfmTagSynonyms: ['bossa nova', 'mpb', 'musica popular brasileira'],
  },
  {
    key: 'soca_calypso',
    label: 'Soca/Calypso',
    emoji: '🏝️',
    lastfmTagSynonyms: ['soca', 'calypso'],
  },
  {
    key: 'nordic_pop',
    label: 'Pop Nórdico',
    emoji: '❄️',
    lastfmTagSynonyms: ['nordic pop', 'scandipop', 'swedish pop'],
  },
  {
    key: 'country_folk',
    label: 'Country/Folk',
    emoji: '🪕',
    lastfmTagSynonyms: ['country', 'folk', 'americana', 'singer-songwriter'],
  },
  {
    key: 'classical',
    label: 'Clásica',
    emoji: '🎻',
    lastfmTagSynonyms: ['classical', 'orchestral', 'soundtrack'],
  },
  {
    key: 'ambient_new_age',
    label: 'Ambient/New Age',
    emoji: '🕊️',
    lastfmTagSynonyms: ['ambient', 'new age', 'meditation'],
  },
  {
    key: 'funk_disco',
    label: 'Funk/Disco',
    emoji: '🕺',
    lastfmTagSynonyms: ['funk', 'disco', 'boogie'],
  },
  {
    key: 'reggae',
    label: 'Reggae',
    emoji: '🦁',
    lastfmTagSynonyms: ['reggae', 'dancehall', 'dub', 'ska'],
  },
  {
    key: 'afrobeats',
    label: 'Afrobeats',
    emoji: '🌍',
    lastfmTagSynonyms: ['afrobeats', 'afropop', 'amapiano'],
  },
  {
    key: 'gospel_cristiana',
    label: 'Gospel/Cristiana',
    emoji: '🙏',
    lastfmTagSynonyms: ['gospel', 'christian', 'musica cristiana'],
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
 * `topTags` ahora típicamente trae VARIOS tags reales (Last.fm
 * track.getTopTags, ver lastfm.ts/tasteAdapter.ts) además del género crudo
 * de iTunes -- antes solo se le pasaba ese único string, lo que dejaba sin
 * resolver cualquier track cuyo `primaryGenreName` de iTunes no calzara
 * exacto con un sinónimo (ver comentario histórico en tasteAdapter.ts).
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
