/**
 * Taste Engine — Showmi
 * ----------------------
 * Vendorizado desde el paquete standalone `C:\Users\HP\taste-engine\src\tasteEngine.ts`
 * (fuente de verdad, validado ahí con su propio demo antes de copiarlo aquí). No hay
 * workspace/symlink porque Metro (Expo) complica resolver paquetes fuera de esta carpeta
 * sin configuración extra; si el motor cambia en el paquete standalone, hay que volver a
 * copiar el archivo a mano.
 *
 * Scoring de candidatos vía Thompson Sampling con priors Beta-Bernoulli,
 * uno por dimensión (artista, década, popularidad, género opcional).
 *
 * Decisiones de diseño (discutidas antes de este archivo, para contexto
 * al retomar el módulo más adelante):
 *  - El género NO viene en el objeto Track de la API de Spotify, solo en
 *    Artist, y requiere una llamada extra por artista. Por eso es la
 *    dimensión con menor peso y la única opcional.
 *  - Audio Features / Audio Analysis / Recommendations están deprecados
 *    para apps nuevas desde nov-2024, sin reemplazo oficial. No se usan.
 *  - artistId, año de lanzamiento y popularity vienen gratis en el
 *    objeto Track/Album estándar, sin llamadas adicionales — pero Showmi NO
 *    usa la Track API de Spotify (usa iTunes + Last.fm), así que popularity
 *    es opcional en Candidate y se omite en el adaptador de este repo.
 *  - No es un bandit contextual "correcto" (tipo LinTS con regresión
 *    bayesiana conjunta); son varios bandits Beta-Bernoulli independientes
 *    combinados en un promedio ponderado. Simplificación intencional para
 *    mantenerlo ligero.
 */

export type BetaParams = { alpha: number; beta: number };

/** Estado del usuario: mapa de clave de dimensión -> parámetros Beta */
export type UserState = Record<string, BetaParams>;

export type Candidate = {
  trackId: string;
  /** Todos los artistas del track (colaboraciones incluidas); el primero se trata como principal */
  artistIds: string[];
  /** ISO date string, típicamente track.album.release_date */
  releaseDate: string;
  /** 0-100. Opcional: fuentes que no son la Track API de Spotify (ej. iTunes/Last.fm) no la exponen */
  popularity?: number;
  /** Opcional: requiere llamada a GET /artists/{id}, puede no venir */
  genre?: string;
};

export type DimensionWeight = { key: string; weight: number };

const DEFAULT_WEIGHTS = {
  artist: 0.5,
  decade: 0.2,
  popularity: 0.15,
  genre: 0.15,
};

/**
 * Factor de decaimiento aplicado a alpha/beta existentes antes de cada nueva observación.
 * Half-life ~23 swipes en la misma clave (ln(0.5)/ln(DECAY)), techo de muestra efectiva
 * ~33 (1/(1-DECAY)). Calibrado para que un cambio de humor dentro de una sesión típica
 * de swipe alcance a moverle la aguja a una clave ya reforzada, sin ser tan agresivo
 * como para que 2-3 swipes sueltos tumben una preferencia establecida.
 */
const DECAY = 0.97;

/**
 * Agregado global de swipes de toda la comunidad Showmi, misma forma de llaves que
 * UserState (`artista:x`, `genero:x`, etc.) pero sumado entre todos los usuarios.
 * Se alimenta fuera de este módulo — no hace falta tiempo real, basta un job por hora
 * que sume los deltas de swipes desde el último corte.
 */
export type GlobalStats = Record<string, { likes: number; total: number }>;

/** Pseudo-observaciones que el consenso global le presta a una clave nueva de un usuario */
const PRIOR_STRENGTH = 6;
/** Por debajo de esto el consenso global no es confiable (p.ej. sesgado a early adopters) */
const MIN_GLOBAL_SAMPLE = 20;

export type Neighbor = { artistId: string; similarity: number };

/**
 * Top-K vecinos por artista según similaridad de co-ocurrencia (Jaccard sobre usuarios que
 * dieron like a ambos / usuarios que interactuaron con ambos), no similitud de sonido.
 * Se calcula offline y periódicamente (agregación pesada, no en cada swipe); por catálogo
 * completo solo se guardan los 10-15 vecinos más fuertes por artista, no la matriz entera.
 */
export type CoOccurrence = Record<string, Neighbor[]>;

/** Piso de historial propio en el vecino para considerarlo señal fuerte y no ruido */
const MIN_NEIGHBOR_SAMPLE = 5;

/**
 * Prior de arranque para una clave sin historial propio, mezclando dos señales por
 * confianza relativa en vez de elegir una y descartar la otra (una cascada todo-o-nada
 * tira información útil cuando ambas señales existen pero ninguna es abrumadora):
 * consenso global (si tiene >= minGlobalSample) y consenso del vecino por co-ocurrencia
 * más fuerte (ponderado por su propia similarity, un vecino débil pesa menos incluso si
 * el usuario lo probó mucho). Si ninguna señal está disponible, Beta(1,1) neutro. Esto es
 * solo semilla de arranque: una vez que `state[key]` existe, no se vuelve a mezclar.
 */
export function computeSeedPrior(
  globalStats: { likes: number; total: number } | null,
  neighborStats: { ratio: number; similarity: number } | null,
  priorStrength = PRIOR_STRENGTH,
  minGlobalSample = MIN_GLOBAL_SAMPLE,
): BetaParams {
  const global =
    globalStats && globalStats.total >= minGlobalSample ? globalStats.likes / globalStats.total : null;
  const neighbor = neighborStats ? neighborStats.ratio * neighborStats.similarity : null;

  if (global === null && neighbor === null) return { alpha: 1, beta: 1 };

  const gW = global !== null ? 0.4 : 0;
  const nW = neighbor !== null ? 0.6 * (neighborStats?.similarity ?? 0) : 0;
  const totalW = gW + nW || 1;
  const blended = ((global ?? 0) * gW + (neighbor ?? 0) * nW) / totalW;

  return {
    alpha: 1 + blended * priorStrength,
    beta: 1 + (1 - blended) * priorStrength,
  };
}

/**
 * Encuentra, para un artista, el vecino por co-ocurrencia más fuerte (ya vienen rankeados
 * por similarity) que el usuario sí haya probado con señal propia suficiente. null si
 * ninguno sirve, para que `computeSeedPrior` se quede solo con la señal global si la hay.
 */
export function pickNeighborStats(
  artistId: string,
  userState: UserState,
  co: CoOccurrence,
): { ratio: number; similarity: number } | null {
  const neighbors = co[artistId] ?? [];
  for (const { artistId: neighborId, similarity } of neighbors) {
    const neighborState = userState[`artista:${neighborId}`];
    if (neighborState && neighborState.alpha + neighborState.beta >= MIN_NEIGHBOR_SAMPLE) {
      const ratio = neighborState.alpha / (neighborState.alpha + neighborState.beta);
      return { ratio, similarity };
    }
  }
  return null;
}

/** Resuelve el prior de arranque para una clave sin historial propio, juntando ambas fuentes */
function resolveSeed(key: string, state: UserState, global?: GlobalStats, co?: CoOccurrence): BetaParams {
  const globalStats = global?.[key] ?? null;
  const neighborStats =
    co && key.startsWith("artista:") ? pickNeighborStats(key.slice("artista:".length), state, co) : null;
  return computeSeedPrior(globalStats, neighborStats);
}

// ---------- Muestreo aleatorio ----------

function gaussianRandom(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Marsaglia-Tsang, válido para shape >= 1. Con DECAY, alpha/beta ya no están acotados por
 * abajo en 1 (el lado no reforzado decae geométricamente hacia 0 sin nunca sumar), así que
 * para shape < 1 se usa el boost exacto: Gamma(shape) = Gamma(shape+1) * U^(1/shape).
 */
function sampleGamma(shape: number): number {
  if (shape < 1) {
    const boosted = sampleGamma(shape + 1);
    const u = Math.random();
    return boosted * Math.pow(u, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let x: number;
    let v: number;
    do {
      x = gaussianRandom();
      v = 1 + c * x;
    } while (v <= 0);
    v = v ** 3;
    const u = Math.random();
    if (u < 1 - 0.0331 * x ** 4) return d * v;
    if (Math.log(u) < 0.5 * x ** 2 + d * (1 - v + Math.log(v))) return d * v;
  }
}

export function sampleBeta(alpha: number, beta: number): number {
  const x = sampleGamma(alpha);
  const y = sampleGamma(beta);
  return x / (x + y);
}

// ---------- Buckets ----------

export function bucketDecade(releaseDate: string): string {
  const year = parseInt(releaseDate.slice(0, 4), 10);
  if (Number.isNaN(year)) return "decada:desconocida";
  const decade = Math.floor(year / 10) * 10;
  return `decada:${decade}s`;
}

export function bucketPopularity(popularity: number): string {
  const clamped = Math.max(0, Math.min(100, popularity));
  const bucketStart = Math.floor(clamped / 20) * 20;
  return `popularidad:${bucketStart}-${bucketStart + 20}`;
}

// ---------- Claves por candidato ----------

/**
 * Exportada porque el cliente (ej. el batching de priors antes de armar un deck) necesita
 * saber qué claves toca un candidato sin duplicar esta lógica.
 */
export function dimensionKeys(track: Candidate): DimensionWeight[] {
  const perArtistWeight = DEFAULT_WEIGHTS.artist / track.artistIds.length;
  const dims: DimensionWeight[] = track.artistIds.map((artistId) => ({
    key: `artista:${artistId}`,
    weight: perArtistWeight,
  }));
  dims.push({ key: bucketDecade(track.releaseDate), weight: DEFAULT_WEIGHTS.decade });
  if (track.popularity !== undefined) {
    dims.push({ key: bucketPopularity(track.popularity), weight: DEFAULT_WEIGHTS.popularity });
  }
  if (track.genre) {
    dims.push({ key: `genero:${track.genre}`, weight: DEFAULT_WEIGHTS.genre });
  }
  return dims;
}

// ---------- Utilidades de mezcla ----------

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Intercala `secondary` dentro de `primary`, distribuido a intervalos ~regulares */
function interleave<T>(primary: T[], secondary: T[]): T[] {
  if (secondary.length === 0) return [...primary];
  const result: T[] = [];
  const ratio = primary.length / secondary.length;
  let secondaryIndex = 0;
  let sinceLastInsert = 0;
  for (const item of primary) {
    result.push(item);
    sinceLastInsert += 1;
    if (sinceLastInsert >= ratio && secondaryIndex < secondary.length) {
      result.push(secondary[secondaryIndex]);
      secondaryIndex += 1;
      sinceLastInsert -= ratio;
    }
  }
  while (secondaryIndex < secondary.length) {
    result.push(secondary[secondaryIndex]);
    secondaryIndex += 1;
  }
  return result;
}

// ---------- API pública ----------

/**
 * Puntúa un candidato muestreando cada dimensión Beta activa y promediando por peso.
 * `sessionMultipliers` es un ajuste efímero ("¿de qué tienes ganas hoy?") que vive solo
 * en memoria de la sesión: si la clave de una dimensión coincide con una llave del mapa,
 * el score final se multiplica por ese valor. No se persiste en UserState.
 */
export function scoreTrack(
  track: Candidate,
  state: UserState,
  sessionMultipliers?: Record<string, number>,
  global?: GlobalStats,
  co?: CoOccurrence,
): number {
  const dims = dimensionKeys(track);
  let score = 0;
  let totalWeight = 0;
  for (const { key, weight } of dims) {
    const { alpha, beta } = state[key] ?? resolveSeed(key, state, global, co);
    score += weight * sampleBeta(alpha, beta);
    totalWeight += weight;
  }
  let result = totalWeight > 0 ? score / totalWeight : 0.5;
  if (sessionMultipliers) {
    for (const { key } of dims) {
      const multiplier = sessionMultipliers[key];
      if (multiplier !== undefined) result *= multiplier;
    }
  }
  return result;
}

/** Ordena un pool de candidatos de mayor a menor score muestreado */
export function rankCandidates(
  candidates: Candidate[],
  state: UserState,
  sessionMultipliers?: Record<string, number>,
  global?: GlobalStats,
  co?: CoOccurrence,
): Candidate[] {
  return [...candidates]
    .map((track) => ({ track, score: scoreTrack(track, state, sessionMultipliers, global, co) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.track);
}

/**
 * Ranking con cuota de exploración garantizada. Separa el pool en "frías" (la clave del
 * artista principal tiene alpha+beta < 5, es decir casi sin historial) y "calientes" (el
 * resto). Las calientes se ordenan por score normal; de las frías se toma una muestra
 * aleatoria de tamaño `exploreRatio * candidates.length` y se intercala dentro del orden
 * de las calientes en vez de anexarla al final, para que la exploración de verdad aparezca
 * en el deck y no quede enterrada.
 */
export function rankCandidatesWithExploration(
  candidates: Candidate[],
  state: UserState,
  exploreRatio = 0.2,
  sessionMultipliers?: Record<string, number>,
  global?: GlobalStats,
  co?: CoOccurrence,
): Candidate[] {
  const dominantArtistKey = (track: Candidate) => `artista:${track.artistIds[0]}`;
  const isCold = (track: Candidate) => {
    const key = dominantArtistKey(track);
    const { alpha, beta } = state[key] ?? resolveSeed(key, state, global, co);
    return alpha + beta < 5;
  };

  const cold: Candidate[] = [];
  const hot: Candidate[] = [];
  for (const track of candidates) {
    (isCold(track) ? cold : hot).push(track);
  }

  const hotSorted = [...hot]
    .map((track) => ({ track, score: scoreTrack(track, state, sessionMultipliers, global, co) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.track);

  const sampleSize = Math.round(exploreRatio * candidates.length);
  const coldSample = shuffle(cold).slice(0, sampleSize);

  return interleave(hotSorted, coldSample);
}

/**
 * Actualiza el estado del usuario tras un swipe (muta y regresa el mismo objeto).
 * Antes de sumar la nueva observación aplica DECAY a alpha/beta existentes, así el
 * tamaño de muestra efectivo de una clave queda acotado (converge a intensity / (1 - DECAY))
 * y el sampleo nunca deja de poder reaccionar a un cambio de gusto reciente.
 * `intensity` (clamped a [0.1, 1]) escala cuánto pesa este swipe en particular.
 * Si la clave todavía no existe en `state`, arranca desde `resolveSeed` (blend de consenso
 * global + vecino por co-ocurrencia, ver `computeSeedPrior`) en vez de siempre Beta(1,1) —
 * pero solo en este primer toque: de ahí en adelante `state[key]` ya existe y ningún prior
 * externo vuelve a mezclarse.
 */
export function registerSwipe(
  track: Candidate,
  liked: boolean,
  state: UserState,
  intensity = 1,
  global?: GlobalStats,
  co?: CoOccurrence,
): UserState {
  const clampedIntensity = Math.max(0.1, Math.min(1, intensity));
  const keys = dimensionKeys(track).map((d) => d.key);
  for (const key of keys) {
    const cur = state[key] ?? resolveSeed(key, state, global, co);
    const alpha = cur.alpha * DECAY + (liked ? clampedIntensity : 0);
    const beta = cur.beta * DECAY + (liked ? 0 : clampedIntensity);
    state[key] = { alpha, beta };
  }
  return state;
}

/** Siembra el estado inicial a partir del cuestionario de onboarding (cold start) */
export function seedFromOnboarding(
  preferredArtistIds: string[],
  preferredGenres: string[],
  state: UserState = {},
): UserState {
  for (const artistId of preferredArtistIds) {
    state[`artista:${artistId}`] = { alpha: 2, beta: 1 };
  }
  for (const genre of preferredGenres) {
    state[`genero:${genre}`] = { alpha: 2, beta: 1 };
  }
  return state;
}
