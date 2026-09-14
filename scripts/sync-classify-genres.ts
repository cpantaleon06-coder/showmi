/**
 * Regenera la tabla de géneros VENDORIZADA dentro de supabase/functions/classify-tracks
 * a partir de src/lib/genres.ts, la única fuente de verdad.
 *
 * Deno no puede importar del bundle de React Native, así que la Edge Function lleva su
 * propia copia. El comentario de ese archivo ya decía "si esa lista cambia, hay que
 * regenerar esto" -- pero regenerarlo era a mano, y a mano se desincronizó: al 2026-09-14 la
 * copia del servidor tenía 4 sinónimos MENOS que el cliente en hip_hop_rap y country_folk, y
 * su normalización era `toLowerCase().trim()`, sin quitar acentos ni partir por "/". O sea el
 * cliente resolvía "Singer/Songwriter" y el servidor no, para el MISMO track.
 *
 * Uso:  npx tsx scripts/sync-classify-genres.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';

import { CANONICAL_GENRES } from '../src/lib/genres';

const TARGET = 'supabase/functions/classify-tracks/index.ts';
const START = 'const GENRE_SYNONYMS: Record<string, string[]> = {';
const END = '// ---------- vibra provisional (2026-09-12) ----------';

const tabla = CANONICAL_GENRES.map(
  (g) => `  ${g.key}: [${g.lastfmTagSynonyms.map((s) => JSON.stringify(s)).join(', ')}],`,
).join('\n');

const bloque = `${START}
${tabla}
};

// GENERADO por scripts/sync-classify-genres.ts desde src/lib/genres.ts -- no editar a mano.
// normalizeTag y resolveGenero son copia literal de ese archivo: minúsculas, NFD para que los
// acentos caigan con el resto de lo no alfanumérico, y comparación EXACTA sobre el token
// completo (con substring, "pop" matchearía k-pop, j-pop y pop punk). Partir por "/" no
// afloja nada -- iTunes compone "Hip-Hop/Rap" donde cada mitad es una etiqueta entera.
function normalizeTag(tag: string): string {
  return tag.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
}

const NORMALIZED_SYNONYMS: { key: string; tags: Set<string> }[] = Object.entries(GENRE_SYNONYMS).map(
  ([key, tags]) => ({ key, tags: new Set(tags.map(normalizeTag)) }),
);

// banda_norteno se revisa último (mismo orden que resolveCanonicalGenre en src/lib/genres.ts)
// -- "regional mexicano" es el cajón paraguas y solo debe ganar si nada más específico matcheó.
function resolveGenero(tags: string[], itunesGenre: string | null): string | null {
  const candidates = new Set<string>();
  for (const raw of [itunesGenre, ...tags]) {
    if (!raw) continue;
    candidates.add(normalizeTag(raw));
    if (raw.includes('/')) for (const part of raw.split('/')) candidates.add(normalizeTag(part));
  }
  candidates.delete('');

  for (const genre of NORMALIZED_SYNONYMS) {
    if (genre.key === 'banda_norteno') continue;
    for (const tag of genre.tags) if (candidates.has(tag)) return genre.key;
  }
  const banda = NORMALIZED_SYNONYMS.find((g) => g.key === 'banda_norteno');
  if (banda) for (const tag of banda.tags) if (candidates.has(tag)) return 'banda_norteno';
  return null;
}

`;

const src = readFileSync(TARGET, 'utf8');
const i = src.indexOf(START);
const j = src.indexOf(END);
if (i === -1 || j === -1 || j < i) throw new Error('No se encontraron los marcadores en ' + TARGET);

writeFileSync(TARGET, src.slice(0, i) + bloque + src.slice(j), 'utf8');
console.log(`${TARGET}: ${CANONICAL_GENRES.length} géneros, ${CANONICAL_GENRES.reduce((n, g) => n + g.lastfmTagSynonyms.length, 0)} sinónimos.`);
