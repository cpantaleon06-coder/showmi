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
 * esa ronda sumó mercados/idiomas que no tenían NINGÚN representante todavía
 * (Bollywood, pop árabe, pop turco, bossa nova/MPB brasileño en portugués,
 * soca/calypso caribeño, mandopop/cantopop, pop nórdico).
 *
 * 2026-09-01: ampliada de 37 a 53 -- `electronica` (solo 2 en su categoría)
 * se desglosó en house/techno/trance/dubstep-bass/drum&bass (audiencias
 * reales distintas, igual razón que rock_metal); se sumaron emo/shoegaze
 * (rock), drill (urbano), tejano/boleros (Latino), ópera/flamenco/bluegrass
 * y highlife/celtic/fado (raíces y del mundo, huecos reales que quedaban).
 * `rock_metal` se separó en `rock`/`metal` en la primera pasada. Cada lista
 * de sinónimos es DISJUNTA de las demás a propósito -- `resolveCanonicalGenre`
 * hace match exacto por elemento de array (no substring), así que dos
 * géneros nunca deberían compartir el mismo string de tag, o el orden del
 * array (arbitrario) decidiría cuál gana. Verificado a mano, las cuatro veces.
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
  | 'tejano'
  | 'boleros'
  | 'pop_latino'
  | 'rock'
  | 'metal'
  | 'indie_lofi'
  | 'emo'
  | 'shoegaze_dreampop'
  | 'pop'
  | 'hip_hop_rap'
  | 'drill'
  | 'rnb_soul'
  | 'electronica'
  | 'house'
  | 'techno'
  | 'trance'
  | 'dubstep_bass'
  | 'drum_and_bass'
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
  | 'opera'
  | 'flamenco'
  | 'bluegrass'
  | 'ambient_new_age'
  | 'funk_disco'
  | 'reggae'
  | 'afrobeats'
  | 'highlife'
  | 'celtic_irish'
  | 'fado'
  | 'gospel_cristiana'
  | 'punk';

/**
 * 2026-09-01: agregado `category` -- con 37 géneros, una sola fila de scroll
 * horizontal (o un wrap plano) ya no se puede escanear de un vistazo. El
 * selector ahora agrupa por categoría con "mostrar más" por sección (ver
 * CategorizedChipPicker.tsx, inspirado en el picker de intereses de apps
 * tipo Hinge que mandó el usuario de referencia) en vez de una lista larga
 * sin estructura.
 */
export type GenreCategory = 'Latino' | 'Rock/Alternativo' | 'Pop/Urbano' | 'Electrónica/Chill' | 'Raíces' | 'Del Mundo';

/** Orden de aparición de las secciones en el selector -- Latino primero porque sigue siendo
 *  el foco principal del mercado de Showmi (ver memoria de producto), no alfabético. */
export const GENRE_CATEGORY_ORDER: GenreCategory[] = [
  'Latino',
  'Rock/Alternativo',
  'Pop/Urbano',
  'Electrónica/Chill',
  'Raíces',
  'Del Mundo',
];

export interface GenreDef {
  key: CanonicalGenre;
  category: GenreCategory;
  label: string;
  emoji: string;
  lastfmTagSynonyms: string[];
}

export const CANONICAL_GENRES: GenreDef[] = [
  {
    key: 'corridos_tumbados_regional',
    category: 'Latino',
    label: 'Corridos/Regional',
    emoji: '🤠',
    lastfmTagSynonyms: ['corridos tumbados', 'corrido tumbado', 'corrido bélico', 'sad sierreño', 'sierreño', 'corridos'],
  },
  {
    key: 'banda_norteno',
    category: 'Latino',
    label: 'Banda/Norteño',
    emoji: '🪗',
    // "regional mexicano" es un tag paraguas ambiguo -- solo se usa como
    // respaldo si no aparece ningún tag más específico entre los top tags.
    lastfmTagSynonyms: ['banda', 'norteño', 'banda sinaloense', 'grupero', 'regional mexicano'],
  },
  {
    key: 'reggaeton',
    category: 'Latino',
    label: 'Reggaetón',
    emoji: '🎤',
    lastfmTagSynonyms: ['reggaeton', 'reggaetón', 'urbano latino', 'latin urban'],
  },
  {
    key: 'trap_latino',
    category: 'Latino',
    label: 'Trap Latino',
    emoji: '🕶️',
    lastfmTagSynonyms: ['trap latino', 'latin trap', 'trap en español'],
  },
  {
    key: 'salsa',
    category: 'Latino',
    label: 'Salsa',
    emoji: '💃',
    lastfmTagSynonyms: ['salsa', 'salsa romantica', 'salsa dura'],
  },
  {
    key: 'bachata',
    category: 'Latino',
    label: 'Bachata',
    emoji: '🌹',
    lastfmTagSynonyms: ['bachata', 'bachata romantica'],
  },
  {
    key: 'cumbia',
    category: 'Latino',
    label: 'Cumbia',
    emoji: '🪘',
    lastfmTagSynonyms: ['cumbia', 'cumbia sonidera', 'cumbia pop'],
  },
  {
    key: 'vallenato',
    category: 'Latino',
    label: 'Vallenato',
    emoji: '🌴',
    lastfmTagSynonyms: ['vallenato', 'vallenato romantico'],
  },
  {
    key: 'merengue',
    category: 'Latino',
    label: 'Merengue',
    emoji: '🥁',
    lastfmTagSynonyms: ['merengue', 'merengue tipico'],
  },
  {
    key: 'ranchera_mariachi',
    category: 'Latino',
    label: 'Ranchera/Mariachi',
    emoji: '🌵',
    lastfmTagSynonyms: ['ranchera', 'rancheras', 'mariachi'],
  },
  {
    key: 'tejano',
    category: 'Latino',
    label: 'Tejano',
    emoji: '🐎',
    lastfmTagSynonyms: ['tejano', 'tex-mex'],
  },
  {
    key: 'boleros',
    category: 'Latino',
    label: 'Boleros',
    emoji: '💐',
    lastfmTagSynonyms: ['bolero', 'boleros'],
  },
  {
    key: 'pop_latino',
    category: 'Latino',
    label: 'Pop Latino',
    emoji: '✨',
    lastfmTagSynonyms: ['pop latino', 'latin pop', 'latino'],
  },
  {
    key: 'rock',
    category: 'Rock/Alternativo',
    label: 'Rock',
    emoji: '🎸',
    lastfmTagSynonyms: ['rock', 'alternative rock', 'grunge', 'classic rock', 'hard rock'],
  },
  {
    key: 'metal',
    category: 'Rock/Alternativo',
    label: 'Metal',
    emoji: '⚡',
    lastfmTagSynonyms: ['metal', 'heavy metal', 'thrash metal', 'death metal'],
  },
  {
    key: 'indie_lofi',
    category: 'Rock/Alternativo',
    label: 'Indie/Lo-fi',
    emoji: '🎧',
    lastfmTagSynonyms: ['indie', 'indie pop', 'indie rock', 'lo-fi', 'lofi', 'bedroom pop'],
  },
  {
    key: 'emo',
    category: 'Rock/Alternativo',
    label: 'Emo',
    emoji: '🖤',
    lastfmTagSynonyms: ['emo', 'emo pop', 'screamo'],
  },
  {
    key: 'shoegaze_dreampop',
    category: 'Rock/Alternativo',
    label: 'Shoegaze/Dream Pop',
    emoji: '💭',
    lastfmTagSynonyms: ['shoegaze', 'dream pop', 'dreampop'],
  },
  {
    key: 'pop',
    category: 'Pop/Urbano',
    label: 'Pop',
    emoji: '🎶',
    lastfmTagSynonyms: ['pop', 'pop rock', 'dance pop', 'synth-pop'],
  },
  {
    key: 'hip_hop_rap',
    category: 'Pop/Urbano',
    label: 'Hip-Hop/Rap',
    emoji: '🎙️',
    lastfmTagSynonyms: ['hip hop', 'hip-hop', 'rap', 'trap'],
  },
  {
    key: 'drill',
    category: 'Pop/Urbano',
    label: 'Drill',
    emoji: '🧊',
    lastfmTagSynonyms: ['drill', 'uk drill', 'brooklyn drill'],
  },
  {
    key: 'rnb_soul',
    category: 'Pop/Urbano',
    label: 'R&B/Soul',
    emoji: '🎵',
    lastfmTagSynonyms: ['r&b', 'rnb', 'soul', 'neo soul'],
  },
  {
    // 2026-09-01: 'house'/'techno' se movieron a sus propios géneros abajo
    // (ver comentario de cabecera) -- esta entrada queda como el catch-all
    // genérico de electrónica, no como el bucket de todo el EDM.
    key: 'electronica',
    category: 'Electrónica/Chill',
    label: 'Electrónica',
    emoji: '🎛️',
    lastfmTagSynonyms: ['electronic', 'electronica', 'edm', 'synthwave'],
  },
  {
    key: 'house',
    category: 'Electrónica/Chill',
    label: 'House',
    emoji: '🏠',
    lastfmTagSynonyms: ['house', 'deep house', 'tech house'],
  },
  {
    key: 'techno',
    category: 'Electrónica/Chill',
    label: 'Techno',
    emoji: '⚙️',
    lastfmTagSynonyms: ['techno', 'minimal techno', 'acid techno'],
  },
  {
    key: 'trance',
    category: 'Electrónica/Chill',
    label: 'Trance',
    emoji: '🌀',
    lastfmTagSynonyms: ['trance', 'progressive trance', 'psytrance'],
  },
  {
    key: 'dubstep_bass',
    category: 'Electrónica/Chill',
    label: 'Dubstep/Bass',
    emoji: '💥',
    lastfmTagSynonyms: ['dubstep', 'bass music', 'drumstep'],
  },
  {
    key: 'drum_and_bass',
    category: 'Electrónica/Chill',
    label: 'Drum & Bass',
    emoji: '🔊',
    lastfmTagSynonyms: ['drum and bass', 'dnb', 'jungle'],
  },
  {
    key: 'jazz',
    category: 'Raíces',
    label: 'Jazz',
    emoji: '🎷',
    lastfmTagSynonyms: ['jazz', 'smooth jazz', 'jazz fusion', 'bebop'],
  },
  {
    key: 'blues',
    category: 'Raíces',
    label: 'Blues',
    emoji: '🎺',
    lastfmTagSynonyms: ['blues', 'delta blues', 'electric blues'],
  },
  {
    key: 'k_pop',
    category: 'Pop/Urbano',
    label: 'K-Pop',
    emoji: '💜',
    lastfmTagSynonyms: ['k-pop', 'kpop', 'korean pop'],
  },
  {
    key: 'j_pop',
    category: 'Pop/Urbano',
    label: 'J-Pop',
    emoji: '🎌',
    lastfmTagSynonyms: ['j-pop', 'jpop', 'japanese pop'],
  },
  {
    key: 'mandopop_cantopop',
    category: 'Pop/Urbano',
    label: 'Mandopop/Cantopop',
    emoji: '🐉',
    lastfmTagSynonyms: ['mandopop', 'cantopop', 'chinese pop'],
  },
  {
    key: 'bollywood',
    category: 'Del Mundo',
    label: 'Bollywood',
    emoji: '🎬',
    lastfmTagSynonyms: ['bollywood', 'indian pop', 'hindi pop'],
  },
  {
    key: 'arabic_pop',
    category: 'Del Mundo',
    label: 'Pop Árabe',
    emoji: '🕌',
    lastfmTagSynonyms: ['arabic pop', 'khaleeji', 'arab pop'],
  },
  {
    key: 'turkish_pop',
    category: 'Del Mundo',
    label: 'Pop Turco',
    emoji: '🌟',
    lastfmTagSynonyms: ['turkish pop', 'pop turco', 'türkçe pop'],
  },
  {
    key: 'bossa_nova_mpb',
    category: 'Del Mundo',
    label: 'Bossa Nova/MPB',
    emoji: '🌊',
    lastfmTagSynonyms: ['bossa nova', 'mpb', 'musica popular brasileira'],
  },
  {
    key: 'soca_calypso',
    category: 'Del Mundo',
    label: 'Soca/Calypso',
    emoji: '🏝️',
    lastfmTagSynonyms: ['soca', 'calypso'],
  },
  {
    key: 'nordic_pop',
    category: 'Del Mundo',
    label: 'Pop Nórdico',
    emoji: '❄️',
    lastfmTagSynonyms: ['nordic pop', 'scandipop', 'swedish pop'],
  },
  {
    key: 'country_folk',
    category: 'Raíces',
    label: 'Country/Folk',
    emoji: '🪕',
    lastfmTagSynonyms: ['country', 'folk', 'americana', 'singer-songwriter'],
  },
  {
    key: 'classical',
    category: 'Raíces',
    label: 'Clásica',
    emoji: '🎻',
    lastfmTagSynonyms: ['classical', 'orchestral', 'soundtrack'],
  },
  {
    key: 'opera',
    category: 'Raíces',
    label: 'Ópera',
    emoji: '🎭',
    lastfmTagSynonyms: ['opera', 'aria'],
  },
  {
    key: 'flamenco',
    category: 'Raíces',
    label: 'Flamenco',
    emoji: '🩰',
    lastfmTagSynonyms: ['flamenco', 'flamenco pop'],
  },
  {
    key: 'bluegrass',
    category: 'Raíces',
    label: 'Bluegrass',
    emoji: '🌾',
    lastfmTagSynonyms: ['bluegrass', 'old-time'],
  },
  {
    key: 'ambient_new_age',
    category: 'Electrónica/Chill',
    label: 'Ambient/New Age',
    emoji: '🕊️',
    lastfmTagSynonyms: ['ambient', 'new age', 'meditation'],
  },
  {
    key: 'funk_disco',
    category: 'Raíces',
    label: 'Funk/Disco',
    emoji: '🕺',
    lastfmTagSynonyms: ['funk', 'disco', 'boogie'],
  },
  {
    key: 'reggae',
    category: 'Del Mundo',
    label: 'Reggae',
    emoji: '🦁',
    lastfmTagSynonyms: ['reggae', 'dancehall', 'dub', 'ska'],
  },
  {
    key: 'afrobeats',
    category: 'Del Mundo',
    label: 'Afrobeats',
    emoji: '🌍',
    lastfmTagSynonyms: ['afrobeats', 'afropop', 'amapiano'],
  },
  {
    key: 'highlife',
    category: 'Del Mundo',
    label: 'Highlife',
    emoji: '🔔',
    lastfmTagSynonyms: ['highlife', 'west african highlife'],
  },
  {
    key: 'celtic_irish',
    category: 'Del Mundo',
    label: 'Celta/Irlandesa',
    emoji: '☘️',
    lastfmTagSynonyms: ['celtic', 'irish folk', 'irish traditional'],
  },
  {
    key: 'fado',
    category: 'Del Mundo',
    label: 'Fado',
    emoji: '🎼',
    lastfmTagSynonyms: ['fado', 'fado portugues'],
  },
  {
    key: 'gospel_cristiana',
    category: 'Raíces',
    label: 'Gospel/Cristiana',
    emoji: '🙏',
    lastfmTagSynonyms: ['gospel', 'christian', 'musica cristiana'],
  },
  {
    key: 'punk',
    category: 'Rock/Alternativo',
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
