/**
 * Taxonomía canónica de idioma -- primer nivel del árbol de sesión
 * (idioma -> epoca -> genero -> vibra, ver sessionTree.ts) y dimensión del
 * filtro duro (deckPipeline.ts, `FilterableFields.idioma`), la más "dura"
 * de las 4 (última en `RELAXATION_ORDER`).
 *
 * Nota de arquitectura importante: la fuente de verdad originalmente
 * propuesta para esto era MusicBrainz -> fallback Last.fm -> manual, vía un
 * job de clasificación periódico (sección 9) que escribiría el resultado en
 * una tabla de catálogo de tracks. Ese catálogo NO EXISTE en Showmi hoy --
 * a diferencia de lo que ese diseño asumía, esta app nunca persiste tracks:
 * todo (título, artista, género, fecha) se trae en vivo de iTunes/Last.fm
 * en cada armado de deck (ver useDeck.ts, tasteAdapter.ts) y solo se guarda
 * `track_id` como llave opaca (swipes, track_vibe_votes, posts, etc.).
 * Meter una clasificación MusicBrainz real requeriría agregar esa tabla de
 * catálogo primero -- alcance mayor, no incluido acá.
 *
 * Mientras tanto, este resolver es un heurístico local (0 llamadas de red,
 * corre en el mismo hilo que resolveCanonicalGenre para cada track del
 * pool) sobre artista+título: castellano si el texto trae señales fuertes
 * de español (acentos/ñ, o palabras funcionales comunes en español que casi
 * nunca aparecen en títulos en inglés), inglés como default en caso
 * contrario. Es deliberadamente conservador -- ambigüedad (títulos
 * instrumentales, nombres propios, mezcla real de idiomas) puede resultar
 * en un idioma equivocado, pero sigue el mismo principio de "nunca
 * bloquea, en el peor caso el track no calza con el filtro" que el resto
 * de la taxonomía. Reemplazar por la clasificación real (MusicBrainz +
 * tabla de catálogo) es trabajo futuro, no un blocker para tener el nivel
 * "idioma" funcionando hoy en el árbol de sesión y el filtro duro.
 */
export type IdiomaKey = 'es' | 'en';

export interface IdiomaDef {
  key: IdiomaKey;
  label: string;
  emoji: string;
}

export const IDIOMAS: IdiomaDef[] = [
  { key: 'es', label: 'Español', emoji: '🇪🇸' },
  { key: 'en', label: 'Inglés', emoji: '🇬🇧' },
];

const SPANISH_ACCENT_CHARS = /[áéíóúñ¿¡]/i;

/**
 * Palabras funcionales (artículos, preposiciones, pronombres) que aparecen
 * con muchísima frecuencia en títulos en español y casi nunca en inglés --
 * a diferencia de sustantivos/nombres propios, que no distinguen idioma
 * confiablemente. Se buscan como palabra completa (con \b) para no
 * matchear substrings dentro de otra palabra.
 */
const SPANISH_STOPWORDS = [
  'el', 'la', 'los', 'las', 'de', 'del', 'que', 'con', 'por', 'para',
  'sin', 'mi', 'tu', 'su', 'te', 'me', 'se', 'es', 'un', 'una', 'y',
  'amor', 'corazon', 'vida', 'noche', 'nunca', 'siempre',
];
const SPANISH_STOPWORD_RE = new RegExp(`\\b(${SPANISH_STOPWORDS.join('|')})\\b`, 'i');

/**
 * `title`/`artist` tal cual vienen de iTunes (`Track.title`/`Track.artist`).
 * Sin texto (título vacío) -> `null`, mismo patrón "sin dato, no inventa"
 * que `resolveEpoca`/`resolveCanonicalGenre`.
 */
export function resolveIdioma(title: string | null | undefined, artist?: string | null): IdiomaKey | null {
  const text = `${title ?? ''} ${artist ?? ''}`.trim();
  if (!text) return null;
  if (SPANISH_ACCENT_CHARS.test(text) || SPANISH_STOPWORD_RE.test(text)) return 'es';
  return 'en';
}
