/**
 * Vendorizado desde `C:\Users\HP\taste-engine\src\deckPipeline.ts` (fuente de
 * verdad, validado ahí con sus propios tests antes de copiarlo aquí -- mismo
 * patrón que tasteEngine.ts/sessionTree.ts). Si el pipeline cambia en el
 * paquete standalone, hay que volver a copiar el archivo a mano.
 *
 * Pipeline de dos capas — Showmi
 * -------------------------------
 * Capa 1 (este archivo, nueva): filtro duro determinístico que arma el pool
 * de candidatos. Capa 2 (ya existía): ranking suave -- `rankCandidates` /
 * `rankCandidatesWithExploration` en tasteEngine.ts, con `sessionMultipliers`
 * ya resuelto por `sessionTreeToMultipliers` (sessionTree.ts). Este archivo
 * NO reimplementa la capa 2, solo la conecta: filtra, y le pasa el resultado
 * a la función de ranking existente sin tocarla.
 *
 * Separación de responsabilidades: capa 1 nunca ve `UserState` ni produce
 * scores -- solo decide qué candidatos entran al pool. Capa 2 nunca ve la
 * selección de sesión (idioma/época/género/vibra) ni decide membresía del
 * pool -- solo reordena lo que ya recibió. Ninguna capa expande lo que la
 * otra ya redujo: capa 2 jamás agrega candidatos que capa 1 excluyó.
 */

import {
  Candidate,
  CoOccurrence,
  GlobalStats,
  UserState,
  rankCandidatesWithExploration,
} from "./tasteEngine";
import { SessionSelection } from "./sessionTree";

// ---------- Capa 1: filtro duro ----------

/**
 * Campos de un track relevantes para el filtro duro. Separado de `Candidate`
 * (tasteEngine.ts) a propósito: el filtro duro opera ANTES de que un track se
 * convierta en candidato de scoring, y le importan dimensiones (idioma,
 * época) que el motor de Thompson Sampling ni siquiera conoce. `vibras` es
 * plural aquí (a diferencia de `Candidate.vibe`, singular) porque un track
 * puede tener 2-3 vibras canónicas a la vez -- el motor de scoring solo usa
 * la vibra dominante como dimensión de bandit, pero el filtro duro necesita
 * ver el conjunto completo para poder hacer match por cualquiera de ellas.
 */
export interface FilterableFields {
  idioma?: string;
  epoca?: string;
  genero?: string;
  vibras?: string[];
}

/**
 * Selección de sesión para el filtro duro: mismos 4 niveles que
 * `SessionSelection` (sessionTree.ts) menos `ancla` (no es una dimensión de
 * filtro, es metadata de qué generó el pool). Reutiliza ese tipo en vez de
 * declarar uno paralelo, para que "todas"/sin preferencia signifique
 * exactamente lo mismo en las dos partes del sistema: el campo,
 * simplemente, no está presente (`undefined`) -- no `null`, no un string
 * especial como `"*"`. Es la convención que ya fijó sessionTree.ts para
 * idioma/época/género, y vibras (`string[]`) sigue el mismo patrón: ausente
 * o arreglo vacío = sin filtrar por vibra.
 */
export type HardFilterSelection = Omit<SessionSelection, "ancla">;

export type FilterLevel = keyof HardFilterSelection;

/**
 * Orden de relajación automática cuando el pool queda por debajo del mínimo:
 * época primero (la dimensión más arbitraria/menos "identitaria" para el
 * usuario -- preferir una década sobre otra es la elección más débil de las
 * 4), luego vibra (el ánimo del momento, más volátil que el género de fondo),
 * luego género, e idioma al final (la restricción más "dura" del producto --
 * un usuario que pidió reggaetón en español probablemente prefiere seguir en
 * español aunque cambie de género antes que aceptar resultados en otro
 * idioma). Orden dado explícitamente por la tarea, documentado aquí para que
 * quede claro el razonamiento y sea fácil de re-priorizar si no calza en la
 * práctica.
 */
export const RELAXATION_ORDER: readonly FilterLevel[] = ["epoca", "vibras", "genero", "idioma"];

/**
 * Mínimo de canciones que dispara la relajación automática. Propuesto (no
 * medido con datos reales todavía, mismo espíritu que DEFAULT_WEIGHTS/
 * SESSION_DECAY): 12 -- suficiente para sostener una sesión real de swipe sin
 * quedarse sin cartas a los pocos segundos ni forzar un refetch inmediato,
 * pero no tan alto como para relajar de más combinaciones nicho que sí
 * tienen suficientes resultados reales sin necesitar ayuda.
 */
export const MIN_POOL_SIZE = 12;

function matchesSelection(track: FilterableFields, selection: HardFilterSelection): boolean {
  if (selection.idioma !== undefined && track.idioma !== selection.idioma) return false;
  if (selection.epoca !== undefined && track.epoca !== selection.epoca) return false;
  if (selection.genero !== undefined && track.genero !== selection.genero) return false;
  if (selection.vibras && selection.vibras.length > 0) {
    // OR dentro de vibra (el track matchea si tiene AL MENOS UNA de las vibras
    // pedidas) -- vibra es multi-etiqueta en la sesión Y en el track, exigir
    // que el track tenga TODAS las vibras seleccionadas simultáneamente
    // vaciaría el pool en la práctica para casi cualquier combinación de 2+.
    const trackVibras = track.vibras ?? [];
    if (!selection.vibras.some((v) => trackVibras.includes(v))) return false;
  }
  return true;
}

export interface HardFilterResult<T extends FilterableFields> {
  pool: T[];
  /** La selección que efectivamente se aplicó, tras relajar lo que haya hecho falta */
  appliedSelection: HardFilterSelection;
  /** Niveles relajados, en el orden en que se relajaron (vacío si no hizo falta relajar nada) */
  relaxedLevels: FilterLevel[];
}

/**
 * Capa 1. AND de arity variable sobre idioma/época/género/vibra -- cada
 * dimensión ausente de `selection` no restringe (arity variable = el AND
 * solo incluye las cláusulas de las dimensiones presentes). Si el pool
 * resultante queda por debajo de `minPoolSize`, relaja una dimensión a la
 * vez en `RELAXATION_ORDER`, recalculando el pool tras cada relajación y
 * deteniéndose apenas se alcanza el mínimo (o al agotar las 4 dimensiones,
 * lo que pase primero). Caso "todas en todo" (`selection = {}`): ninguna
 * cláusula se activa, el pool es el catálogo completo sin restricción --
 * la personalización queda enteramente en manos de la capa 2.
 */
export function applyHardFilter<T extends FilterableFields>(
  catalog: T[],
  selection: HardFilterSelection,
  minPoolSize = MIN_POOL_SIZE,
): HardFilterResult<T> {
  let current: HardFilterSelection = { ...selection };
  let pool = catalog.filter((track) => matchesSelection(track, current));
  const relaxedLevels: FilterLevel[] = [];

  for (const level of RELAXATION_ORDER) {
    if (pool.length >= minPoolSize) break;
    if (current[level] === undefined) continue; // ya estaba en "todas" en ese nivel, nada que relajar
    current = { ...current, [level]: undefined };
    relaxedLevels.push(level);
    pool = catalog.filter((track) => matchesSelection(track, current));
  }

  return { pool, appliedSelection: current, relaxedLevels };
}

// ---------- Punto de integración futuro: similitud de sonido del ancla ----------

/**
 * STUB -- SIN IMPLEMENTACIÓN. Reservado para la beta de análisis de audio
 * propio (otro hilo de trabajo, fuera de alcance de esta tarea). Cuando
 * exista, calculará qué tan similar suena `candidate` a la canción ancla de
 * la sesión (0 = nada parecido, 1 = prácticamente igual).
 *
 * Contrato de entrada/salida nada más -- esta interfaz no prescribe CÓMO se
 * fusionaría el resultado con el resto del ranking (podría multiplicar el
 * score final, mezclarse dentro de `sessionMultipliers` con una clave
 * sintética, o convertirse en un GlobalStats-like adicional); esa decisión
 * le toca a quien implemente el análisis de audio real. `buildDeck` de abajo
 * ya tiene el parámetro `anchorSoundSimilarity` reservado en su firma para
 * cuando eso exista, pero hoy no lo usa -- agregarlo ahora evita un cambio
 * de firma (rompiendo a quien ya llame `buildDeck`) el día que se conecte.
 */
export type AnchorSoundSimilarityScorer = (
  candidate: Candidate,
  anchorTrackId: string,
) => number | Promise<number>;

// ---------- Pipeline completo ----------

/** Un track del catálogo que ya trae los campos de filtro Y los de scoring */
export type FilterableCandidate = Candidate & FilterableFields;

export interface DeckPipelineResult {
  deck: FilterableCandidate[];
  appliedSelection: HardFilterSelection;
  relaxedLevels: FilterLevel[];
}

export interface DeckPipelineOptions {
  minPoolSize?: number;
  exploreRatio?: number;
  global?: GlobalStats;
  co?: CoOccurrence;
  /** Reservado, sin efecto todavía -- ver AnchorSoundSimilarityScorer arriba. */
  anchorSoundSimilarity?: AnchorSoundSimilarityScorer;
}

/**
 * Pipeline completo: catálogo -> filtro duro (capa 1, `applyHardFilter`) ->
 * pool de candidatos -> `rankCandidatesWithExploration` con
 * `sessionMultipliers` (capa 2, YA existía en tasteEngine.ts, no se toca) ->
 * deck ordenado. No hay lógica de ranking nueva acá -- esta función solo
 * conecta las dos capas en el orden correcto y documenta el contrato.
 *
 * `sessionMultipliers` se recibe ya resuelto (normalmente el output de
 * `sessionTreeToMultipliers`, ver sessionTree.ts) -- este pipeline no lo
 * calcula, solo lo reenvía a `rankCandidatesWithExploration` tal cual.
 */
export function buildDeck(
  catalog: FilterableCandidate[],
  selection: HardFilterSelection,
  state: UserState,
  sessionMultipliers?: Record<string, number>,
  options: DeckPipelineOptions = {},
): DeckPipelineResult {
  const { pool, appliedSelection, relaxedLevels } = applyHardFilter(
    catalog,
    selection,
    options.minPoolSize,
  );

  const deck = rankCandidatesWithExploration(
    pool,
    state,
    options.exploreRatio,
    sessionMultipliers,
    options.global,
    options.co,
  );

  return { deck, appliedSelection, relaxedLevels };
}
