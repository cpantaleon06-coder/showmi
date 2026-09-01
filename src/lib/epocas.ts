/**
 * Taxonomía canónica de época -- tercer nivel del árbol de sesión
 * (idioma -> epoca -> genero -> vibra, ver sessionTree.ts) y dimensión del
 * filtro duro (deckPipeline.ts, `FilterableFields.epoca`).
 *
 * A diferencia de idioma (idiomas.ts) y género, época es 100% derivable de
 * un dato que YA viene en la respuesta de iTunes (`Track.releaseDate`) --
 * no necesita ninguna clasificación externa ni tabla de catálogo. Mismo
 * bucketing de década que `bucketDecade` en tasteEngine.ts (motor de
 * scoring), pero como taxonomía CERRADA con label/emoji para uso en UI --
 * `bucketDecade` sigue siendo la fuente para la dimensión de bandit
 * (`decada:1990s`), esta es la fuente para el filtro duro y el árbol de
 * sesión (`epoca:1990s`). Los dos comparten el mismo cálculo de década a
 * propósito (una sola noción de "década" en toda la app) pero vive
 * duplicado en vez de importado porque tasteEngine.ts no depende de nada
 * de UI/taxonomía (mismo principio de dirección de dependencia que
 * sessionTreeStore.ts documenta para api/ -> state/).
 */
export type EpocaKey = '2020s' | '2010s' | '2000s' | '1990s' | '1980s' | 'clasico';

export interface EpocaDef {
  key: EpocaKey;
  label: string;
  emoji: string;
}

export const EPOCAS: EpocaDef[] = [
  { key: '2020s', label: '2020s', emoji: '✨' },
  { key: '2010s', label: '2010s', emoji: '📱' },
  { key: '2000s', label: '2000s', emoji: '💿' },
  { key: '1990s', label: '90s', emoji: '📼' },
  { key: '1980s', label: '80s', emoji: '📻' },
  { key: 'clasico', label: 'Clásico (antes de los 80)', emoji: '🎞️' },
];

/**
 * `releaseDate` de iTunes viene en ISO 8601 (`"1987-06-01T07:00:00Z"`). Sin
 * fecha o fecha inválida -> `null` (= sin época, el track no participa en
 * ningún filtro POR época -- mismo patrón "no crashea, no inventa dato" que
 * `resolveCanonicalGenre`).
 */
export function resolveEpoca(releaseDate: string | null | undefined): EpocaKey | null {
  if (!releaseDate) return null;
  const year = parseInt(releaseDate.slice(0, 4), 10);
  if (Number.isNaN(year)) return null;
  if (year >= 2020) return '2020s';
  if (year >= 2010) return '2010s';
  if (year >= 2000) return '2000s';
  if (year >= 1990) return '1990s';
  if (year >= 1980) return '1980s';
  return 'clasico';
}
