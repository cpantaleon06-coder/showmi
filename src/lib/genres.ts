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

/**
 * Auditoría de la tabla de sinónimos (2026-09-08). Se midió resolviendo una muestra de 54
 * etiquetas reales: `primaryGenreName` de iTunes (los strings que de verdad llegan en las
 * tarjetas: "Alternative", "Hip-Hop/Rap", "Música Mexicana", "R&B/Soul"...) más los tags más
 * frecuentes de Last.fm.
 *
 *   80% resolvían  ->  87% al normalizar la ortografía (ver normalizeTag)
 *                  ->  96% al cerrar los huecos reales de esta tabla
 *   Colisiones (un mismo sinónimo en dos géneros): 0, antes y después.
 *
 * Por qué importa más de lo que parece: un track cuyo género NO resuelve queda con
 * `genero: undefined`, y `matchesSelection` (deckPipeline.ts) EXCLUYE esos tracks de
 * cualquier filtro de género. O sea que cada hueco de esta tabla encoge el pool filtrado,
 * lo empuja bajo MIN_POOL_SIZE y fuerza al filtro duro a relajarse -- y recién ahí entran
 * esos mismos tracks, ahora sin filtro. Ese era el mecanismo detrás del reporte de "pedí
 * Pop+Chill y salió algo etiquetado Alternative": "alternative" no estaba en la tabla.
 *
 * Dos etiquetas se dejan A PROPÓSITO sin resolver: "world" y "experimental". No son géneros
 * en esta taxonomía sino paraguas, y mapearlas a la fuerza mandaría tracks a un género que
 * la persona no pidió. Es preferible que no resuelvan a que resuelvan mal.
 */
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
    lastfmTagSynonyms: ['banda', 'norteño', 'banda sinaloense', 'grupero', 'regional mexicano', 'musica mexicana', 'regional mexican'],
  },
  {
    key: 'reggaeton',
    category: 'Latino',
    label: 'Reggaetón',
    emoji: '🎤',
    lastfmTagSynonyms: ['reggaeton', 'reggaetón', 'urbano latino', 'latin urban', 'perreo'],
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
    lastfmTagSynonyms: ['salsa', 'salsa romantica', 'salsa dura', 'musica tropical', 'salsa y tropical', 'tropical'],
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
    lastfmTagSynonyms: ['rock', 'alternative rock', 'grunge', 'classic rock', 'hard rock', 'alternative', 'alternativa', 'alt rock', 'rock and roll', 'garage rock'],
  },
  {
    key: 'metal',
    category: 'Rock/Alternativo',
    label: 'Metal',
    emoji: '⚡',
    lastfmTagSynonyms: ['metal', 'heavy metal', 'thrash metal', 'death metal', 'metalcore', 'black metal', 'doom metal'],
  },
  {
    key: 'indie_lofi',
    category: 'Rock/Alternativo',
    label: 'Indie/Lo-fi',
    emoji: '🎧',
    lastfmTagSynonyms: ['indie', 'indie pop', 'indie rock', 'lo-fi', 'lofi', 'bedroom pop', 'chillhop'],
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
    lastfmTagSynonyms: ['pop', 'pop rock', 'dance pop', 'synth-pop', 'electropop', 'power pop', 'teen pop'],
  },
  {
    key: 'hip_hop_rap',
    category: 'Pop/Urbano',
    label: 'Hip-Hop/Rap',
    emoji: '🎙️',
    lastfmTagSynonyms: ['hip hop', 'hip-hop', 'rap', 'trap', 'boom bap', 'gangsta rap', 'alternative rap', 'alternative hip hop'],
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
    lastfmTagSynonyms: ['r&b', 'rnb', 'soul', 'neo soul', 'contemporary rnb', 'motown'],
  },
  {
    // 2026-09-01: 'house'/'techno' se movieron a sus propios géneros abajo
    // (ver comentario de cabecera) -- esta entrada queda como el catch-all
    // genérico de electrónica, no como el bucket de todo el EDM.
    key: 'electronica',
    category: 'Electrónica/Chill',
    label: 'Electrónica',
    emoji: '🎛️',
    lastfmTagSynonyms: ['electronic', 'electronica', 'edm', 'synthwave', 'dance', 'electro', 'idm'],
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
    lastfmTagSynonyms: ['jazz', 'smooth jazz', 'jazz fusion', 'bebop', 'nu jazz'],
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
    lastfmTagSynonyms: ['country', 'folk', 'americana', 'singer-songwriter', 'folk rock', 'indie folk', 'singer/songwriter', 'singer songwriter'],
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
    lastfmTagSynonyms: ['funk', 'disco', 'boogie', 'nu disco'],
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
    lastfmTagSynonyms: ['punk', 'punk rock', 'pop punk', 'hardcore punk', 'hardcore', 'skate punk'],
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
/**
 * Normaliza una etiqueta para comparar: minúsculas, sin acentos y SIN separadores.
 * "Hip-Hop" / "hip hop" / "HipHop" -> "hiphop"; "Reggaetón" -> "reggaeton".
 *
 * 2026-09-08: nace de auditar la tabla. La tabla en sí estaba bien (0 colisiones), pero el
 * matcheo era exacto sobre el string crudo, así que fallaba por pura ORTOGRAFÍA: la tabla
 * decía 'synth-pop' y Last.fm mandaba "synthpop"; decía 'singer-songwriter' e iTunes mandaba
 * "Singer/Songwriter". Enumerar cada variante a mano es una carrera que no se gana -- se
 * normaliza y ya.
 *
 * Sigue siendo comparación EXACTA sobre el token completo, no substring: eso es deliberado y
 * está documentado (ver categoryForRawGenre en cosmetics.ts, que sí es laxa a propósito).
 * Con substring, "pop" matchearía k-pop, j-pop, pop punk y britpop, y eso cambiaría qué
 * canciones ve la persona, no solo una etiqueta.
 */
function normalizeTag(tag: string): string {
  return tag
    .toLowerCase()
    // NFD separa "ó" en "o" + marca de acento, y el replace de abajo se lleva la marca
    // junto con todo lo que no sea alfanumérico -- no hace falta una regla aparte de acentos.
    .normalize('NFD')
    .replace(/[^a-z0-9]/g, '');
}

/** Índice normalizado, calculado una sola vez -- resolveCanonicalGenre corre una vez por
 *  track de cada pool, no tiene sentido re-normalizar 160+ sinónimos cada vez. */
const NORMALIZED_SYNONYMS: { key: CanonicalGenre; tags: Set<string> }[] = CANONICAL_GENRES.map((g) => ({
  key: g.key,
  tags: new Set(g.lastfmTagSynonyms.map(normalizeTag)),
}));

export function resolveCanonicalGenre(topTags: string[]): CanonicalGenre | null {
  const candidates = new Set<string>();
  for (const raw of topTags) {
    if (!raw) continue;
    candidates.add(normalizeTag(raw));
    // iTunes compone géneros con barra ("Hip-Hop/Rap", "R&B/Soul", "Singer/Songwriter") donde
    // CADA parte es una etiqueta completa por sí sola. Partir por "/" no afloja el matcheo
    // (cada parte se sigue comparando entera), solo deja de perder esos casos.
    if (raw.includes('/')) {
      for (const part of raw.split('/')) candidates.add(normalizeTag(part));
    }
  }
  candidates.delete('');

  for (const genre of NORMALIZED_SYNONYMS) {
    if (genre.key === 'banda_norteno') continue;
    for (const tag of genre.tags) {
      if (candidates.has(tag)) return genre.key;
    }
  }
  // banda_norteno al final a propósito: es el cajón regional más amplio ("música mexicana",
  // "regional mexicano"), así que solo debe ganar cuando nada más específico matcheó.
  const bandaNorteno = NORMALIZED_SYNONYMS.find((g) => g.key === 'banda_norteno')!;
  for (const tag of bandaNorteno.tags) {
    if (candidates.has(tag)) return 'banda_norteno';
  }
  return null;
}

/** Mapa género canónico -> categoría, armado una sola vez desde la taxonomía de arriba. */
const CATEGORY_BY_GENRE = new Map(CANONICAL_GENRES.map((g) => [g.key, g.category] as const));

/**
 * Categoría a la que pertenece el string CRUDO de género de iTunes (`Track.genre`, ej.
 * "Latin", "Urbano latino", "Hip-Hop/Rap").
 *
 * A propósito es MÁS LAXA que `resolveCanonicalGenre` (que exige match exacto de tag): primero
 * intenta la resolución estricta, y si falla cae a substring en ambos sentidos. La razón es la
 * asimetría del costo -- equivocarse aquí solo tiñe el halo de una tarjeta con el color de la
 * categoría vecina, mientras que aflojar el matcher del deck cambiaría qué canciones ve la
 * persona. Con el matcher estricto solo, strings comunísimos de iTunes como "Latin" no
 * resuelven a nada y media biblioteca saldría sin color.
 *
 * Vivía en `lib/cosmetics.ts`, donde servía para repartir progreso del Camerino por categoría.
 * Al eliminarse el Camerino (2026-09-16) se mudó acá, que es de donde salen sus datos: su único
 * consumidor vivo es `theme/genreColors.ts`.
 */
export function categoryForRawGenre(rawGenre: string | null | undefined): GenreCategory | null {
  if (!rawGenre) return null;

  const strict = resolveCanonicalGenre([rawGenre]);
  if (strict) return CATEGORY_BY_GENRE.get(strict) ?? null;

  const needle = rawGenre.toLowerCase().trim();
  if (!needle) return null;
  for (const genre of CANONICAL_GENRES) {
    for (const tag of genre.lastfmTagSynonyms) {
      if (tag.includes(needle) || needle.includes(tag)) return genre.category;
    }
  }
  return null;
}
