/**
 * iTunes Search never exposes ISRC, so artist+title fuzzy matching is the
 * primary way to line up a Last.fm similarity result with an iTunes track.
 * ISRC (when Spotify exposes it under external_ids) is only a secondary,
 * opportunistic check elsewhere — never the primary key.
 */
// eslint-disable-next-line no-misleading-character-class
const COMBINING_MARKS = /[̀-ͯ]/g;

export function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/\(feat\.?.*?\)/g, '')
    .replace(/\bfeat\.?\s.*/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isLikelyMatch(a: { title: string; artist: string }, b: { title: string; artist: string }): boolean {
  const titleA = normalizeForMatch(a.title);
  const titleB = normalizeForMatch(b.title);
  const artistA = normalizeForMatch(a.artist);
  const artistB = normalizeForMatch(b.artist);

  const titleMatches = titleA === titleB || titleA.includes(titleB) || titleB.includes(titleA);
  const artistMatches = artistA === artistB || artistA.includes(artistB) || artistB.includes(artistA);

  return titleMatches && artistMatches;
}

/**
 * "Feid & Young Miko" -> ['feid', 'young miko'].
 *
 * Bug real que motivó esto (2026-09-14): `trackToCandidate` armaba `artistIds` como
 * `[normalizeForMatch(track.artist)]` -- SIEMPRE un solo elemento. Con una colaboración eso
 * rompía por dos lados a la vez:
 *
 *   - "Feid & Young Miko" quedaba como la clave `artista:feid young miko`, un artista que no
 *     existe. Ni Feid ni Young Miko se llevaban el crédito del like, y el Perfil mostraba el
 *     engendro como si fuera una persona (que es como lo cachó el usuario).
 *   - "Karol G feat. Nicki Minaj" era todavía peor: `normalizeForMatch` recorta todo lo que
 *     venga después de "feat.", así que la invitada se descartaba en silencio. Colaborar no
 *     sumaba nada.
 *
 * El motor YA soportaba varios artistas -- `dimensionKeys` reparte el peso entre
 * `artistIds` y `pickNeighborStats` consulta cada clave. Lo único que faltaba era partir el
 * string. El PRIMERO se conserva como principal porque `tasteEngine.ts` lo usa así
 * (`artistIds[0]` = artista dominante para el tramo de exploración).
 *
 * Separadores elegidos midiendo contra el catálogo real de Showmi, que es urbano/latino:
 * ahí "A, B" y "A & B" son colaboraciones casi sin excepción. NO es cierto en rock y soul
 * ("Nick Cave & The Bad Seeds", "Earth, Wind & Fire"), así que:
 *
 *   - Un fragmento que empieza con "the"/"los"/"las" NO se separa: cubre la forma dominante
 *     del falso positivo (banda con nombre de líder + grupo) sin listas de bandas que
 *     mantener.
 *   - " y " NO es separador, aunque en espanol una a veces una colaboracion. En este
 *     catalogo separa mas duos que son UN acto ("Wisin y Yandel", "Jesse y Joy") que
 *     colaboraciones reales, asi que corta mas de lo que arregla.
 *   - "Earth, Wind & Fire" SIGUE partiéndose mal. Es una limitación conocida y acotada: el
 *     costo es aprender tres claves flojas en vez de una, contra el costo actual, que es
 *     inventar un artista falso en CADA colaboración del género principal de la app.
 *
 * Se parte el string CRUDO y se normaliza cada trozo después: `normalizeForMatch` borra los
 * signos de puntuación (y con ellos los separadores), así que al revés no funcionaría.
 */
const ARTIST_SEPARATORS =
  /\s*(?:,|&|\+|\/|\bfeat\.?|\bft\.?|\bfeaturing\b|\bwith\b|\bcon\b|\bvs\.?|\bversus\b|\bx\b|\bpresents\b)\s+/gi;

/** Fragmentos que casi siempre son la segunda mitad del nombre de UNA banda, no otro artista. */
const BAND_TAIL = /^(the|los|las|his|her|su|sus)\b/i;

export function splitArtists(value: string): string[] {
  // "Nombre (feat. Otro)" / "Nombre [con Otro]" -> los paréntesis solo estorban; el separador
  // de adentro ya lo maneja el split.
  const flat = value.replace(/[()[\]]/g, ' ');

  const pieces: string[] = [];
  let cursor = 0;
  ARTIST_SEPARATORS.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ARTIST_SEPARATORS.exec(flat)) !== null) {
    const head = flat.slice(cursor, match.index);
    const tail = flat.slice(match.index + match[0].length);
    // Si lo que sigue es "The ...", el separador pertenece al nombre de la banda: se deja
    // pasar sin cortar, y el trozo sigue creciendo hasta el próximo separador de verdad.
    if (BAND_TAIL.test(tail.trimStart())) continue;
    pieces.push(head);
    cursor = match.index + match[0].length;
  }
  pieces.push(flat.slice(cursor));

  const out: string[] = [];
  for (const piece of pieces) {
    const normalized = normalizeForMatch(piece);
    // Fragmentos de una sola letra son residuo de nombres como "AC/DC", no artistas.
    if (normalized.length < 2) continue;
    if (!out.includes(normalized)) out.push(normalized);
  }
  // Nunca devolver vacío: si todo se cayó, la clave del nombre entero es peor que ninguna
  // clave, pero ninguna clave rompe `artistIds[0]`.
  return out.length > 0 ? out : [normalizeForMatch(value)].filter((s) => s.length > 0);
}
