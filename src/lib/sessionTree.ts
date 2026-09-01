/**
 * Vendorizado desde `C:\Users\HP\taste-engine\src\sessionTree.ts` (fuente de
 * verdad, validado ahí con sus propios tests antes de copiarlo aquí -- mismo
 * patrón que tasteEngine.ts). Si el árbol cambia en el paquete standalone,
 * hay que volver a copiar el archivo a mano.
 *
 * Árbol de decisiones por sesión — Showmi
 * -----------------------------------------
 * Señal de CORTO plazo (una sesión de swipe) que se consolida en el perfil de
 * largo plazo al cerrar sesión. No reemplaza ni compite con Thompson
 * Sampling/Beta-Bernoulli (ver tasteEngine.ts) por la misma decisión: el
 * árbol decide "qué combinación de idioma/época/género/vibra ofrecer la
 * próxima vez" y aporta un boost de `sessionMultipliers` (ranking suave)
 * sobre el pool ya filtrado; nunca decide qué candidatos entran a ese pool
 * (eso es el filtro duro, un sistema aparte) ni toca el cascade de fallback
 * de `resolveSeed` (historial → vecinos → global → neutral).
 *
 * Jerarquía: idioma -> época -> género -> vibra -> ancla. Las primeras 4 son
 * opcionales (selección de sesión; "todas" = sin filtrar en ese nivel);
 * ancla siempre está presente (todo deck sale de un DeckAnchor, aunque sea
 * uno elegido al azar cuando no se filtró nada). Vibra es multi-etiqueta: una
 * sesión puede filtrar por 2-3 vibras a la vez, cada una recibe su propia
 * rama del árbol.
 *
 * idioma/época NO tienen taxonomía cerrada todavía en este repo (a
 * 2026-08-30 no existe `src/lib/idiomas.ts` ni `epocas.ts` en Showmi, a
 * diferencia de género/vibra que sí la tienen, ver src/lib/genres.ts y
 * src/lib/vibes.ts) -- se modelan aquí como `string` genérico a propósito,
 * para no inventar valores que puedan chocar con lo que defina el hilo de
 * trabajo del selector de sesión (UI), que es explícitamente otro alcance.
 */

export type TreeLevel = "idioma" | "epoca" | "genero" | "vibra" | "ancla";

/**
 * Lo que el usuario eligió (o no) al abrir la sesión. `vibras` es la única
 * multi-etiqueta; el resto es una sola selección o ausente ("todas").
 * `ancla` siempre presente: es el DeckAnchor serializado (`${artist}::${title}`)
 * que terminó armando el pool de esa sesión, sea por selección explícita o
 * por default aleatorio.
 */
export interface SessionSelection {
  idioma?: string;
  epoca?: string;
  genero?: string;
  vibras?: string[];
  ancla: string;
}

/** Clave de un nodo del árbol: el path "nivel:valor" desde la raíz hasta ese punto, unido con ">" */
export type TreeNodeKey = string;

/** Nodo -> peso acumulado. Mismo shape para el acumulador de una sesión activa y para el perfil consolidado de largo plazo -- son la misma estructura en dos momentos distintos. */
export type SessionTreeWeights = Record<TreeNodeKey, number>;

const LEVEL_SEPARATOR = ">";

/**
 * Enumera los nodos que un swipe en `selection` toca, junto con la fracción del
 * peso de ese swipe que le corresponde a cada uno. Los niveles fijos
 * (idioma/época/género) no se reparten -- aparecen una sola vez con share=1
 * porque no son multi-etiqueta. Vibra sí: si se seleccionaron N vibras, cada
 * rama (el nodo de esa vibra y el ancla debajo de ella) recibe 1/N del peso,
 * mismo principio que `dimensionKeys()` repartiendo 0.5/N entre artistas de
 * una colaboración -- una sesión con 3 vibras marcadas no debe pesar 3x más
 * que una con 1 sola.
 */
function buildWeightedNodes(selection: SessionSelection): { key: TreeNodeKey; share: number }[] {
  const nodes: { key: TreeNodeKey; share: number }[] = [];

  const fixedSegments: string[] = [];
  if (selection.idioma) fixedSegments.push(`idioma:${selection.idioma}`);
  if (selection.epoca) fixedSegments.push(`epoca:${selection.epoca}`);
  if (selection.genero) fixedSegments.push(`genero:${selection.genero}`);

  let fixedPrefix = "";
  for (const segment of fixedSegments) {
    fixedPrefix = fixedPrefix ? `${fixedPrefix}${LEVEL_SEPARATOR}${segment}` : segment;
    nodes.push({ key: fixedPrefix, share: 1 });
  }

  const vibras = selection.vibras?.filter(Boolean) ?? [];
  if (vibras.length === 0) {
    const anclaKey = fixedPrefix
      ? `${fixedPrefix}${LEVEL_SEPARATOR}ancla:${selection.ancla}`
      : `ancla:${selection.ancla}`;
    nodes.push({ key: anclaKey, share: 1 });
    return nodes;
  }

  const share = 1 / vibras.length;
  for (const vibra of vibras) {
    const vibraKey = fixedPrefix
      ? `${fixedPrefix}${LEVEL_SEPARATOR}vibra:${vibra}`
      : `vibra:${vibra}`;
    nodes.push({ key: vibraKey, share });
    nodes.push({ key: `${vibraKey}${LEVEL_SEPARATOR}ancla:${selection.ancla}`, share });
  }

  return nodes;
}

/**
 * Fórmula de actualización de peso por swipe (propuesta, documentada para revisión):
 * `delta = liked ? +intensity : -intensity`, sin transformar `intensity` más allá del
 * clamp [0.1, 1] que ya usa `registerSwipe()` en tasteEngine.ts. Un acumulador lineal
 * simple, no una distribución Beta -- el árbol es señal de sesión, no de largo plazo,
 * así que no necesita la maquinaria de Thompson Sampling (eso ya lo hace el motor
 * principal). Reutiliza la MISMA escala de intensidad que ya está establecida en el
 * lado de Showmi, no inventa una segunda:
 *   - swipe plano (like/pass): intensity 0.7 (ver directionToSignal en swipeStore.ts)
 *   - rating 1-5 estrellas: 4-5★ -> like intensity 1, 3★ -> like intensity 0.5,
 *     1-2★ -> dislike intensity 1 (ver ratingToSignal en postStore.ts) -- un rating
 *     pesa más que un swipe plano porque el usuario ya escuchó la canción completa
 *     antes de calificar, no es una reacción de medio segundo a una portada.
 * Quien llama (Showmi) ya calcula `{liked, intensity}` con esa semántica para
 * alimentar `registerSwipe()`; esta función recibe exactamente el mismo par, sin
 * duplicar esa lógica de producto aquí.
 */
export function recordSessionSwipe(
  accumulator: SessionTreeWeights,
  selection: SessionSelection,
  liked: boolean,
  intensity: number,
): SessionTreeWeights {
  const clampedIntensity = Math.max(0.1, Math.min(1, intensity));
  const signed = liked ? clampedIntensity : -clampedIntensity;
  const next = { ...accumulator };
  for (const { key, share } of buildWeightedNodes(selection)) {
    next[key] = (next[key] ?? 0) + signed * share;
  }
  return next;
}

/**
 * Decaimiento por recencia al consolidar una sesión en el perfil de largo plazo.
 * Constante PROPIA, no reutiliza el DECAY de tasteEngine.ts -- justificación:
 * DECAY ahí decae por SWIPE individual (half-life ~23 swipes, pensado para que un
 * cambio de humor DENTRO de una sesión mueva la aguja). Consolidar por SESIÓN es
 * una granularidad distinta: una sesión típica ya trae 20-50 swipes, así que
 * aplicar el mismo 0.97 por sesión tendría un half-life de menos de un mes de uso
 * normal -- demasiado agresivo, borraría preferencias reales por una sola sesión
 * atípica. SESSION_DECAY=0.9 da un half-life de ~6.6 sesiones (ln(0.5)/ln(0.9)):
 * el gusto reciente (última semana-dos de uso) domina, pero una sesión suelta con
 * ánimo raro no tira semanas de señal acumulada. Punto de partida razonado, no
 * medido con datos reales todavía -- mismo espíritu que DEFAULT_WEIGHTS.
 */
export const SESSION_DECAY = 0.9;

/**
 * Consolida el acumulador de una sesión recién cerrada en el perfil de largo plazo.
 * Decae CADA nodo existente del perfil (tocado o no esta sesión) antes de sumar --
 * a diferencia del decay lazy de `registerSwipe()` (que solo decae una clave cuando
 * esa clave específica se vuelve a tocar), acá se decae todo el perfil en cada
 * consolidación a propósito: lo que se quiere capturar es "cuántas sesiones han
 * pasado desde entonces" para TODO el perfil por igual, no solo para lo que se tocó
 * hoy -- un decay lazy subestimaría la antigüedad real de un nodo que no se ha
 * vuelto a tocar en meses.
 */
export function consolidateSession(
  profile: SessionTreeWeights,
  sessionAccumulator: SessionTreeWeights,
): SessionTreeWeights {
  const next: SessionTreeWeights = {};
  const allKeys = new Set([...Object.keys(profile), ...Object.keys(sessionAccumulator)]);
  for (const key of allKeys) {
    const decayed = (profile[key] ?? 0) * SESSION_DECAY;
    next[key] = decayed + (sessionAccumulator[key] ?? 0);
  }
  return next;
}

/** Combinación sugerida para preseleccionar el selector de sesión la próxima vez */
export interface SuggestedSelection {
  idioma?: string;
  epoca?: string;
  genero?: string;
  vibras?: string[];
}

/**
 * PUNTO DE INTEGRACIÓN (a) -- para el hilo de trabajo del selector de sesión.
 *
 * Sugiere la combinación idioma->época->género->vibra con más peso acumulado en el
 * perfil consolidado, bajando nivel por nivel (greedy): en cada nivel, entre los
 * nodos hijos del path ya elegido, se queda con el de mayor peso POSITIVO -- un
 * peso <= 0 corta la bajada en ese nivel (no tiene sentido sugerir algo que el
 * usuario en neto no prefirió; mejor dejarlo en "todas" que sugerir un dislike).
 * Vibra es multi-etiqueta: toma hasta `vibraLimit` por peso positivo bajo el path
 * ya armado, no solo la mejor. Perfil vacío o sin señal positiva en ningún nivel
 * -> `{}` (todas), el mismo resultado neutral que un usuario sin sesiones todavía.
 */
export function suggestNextSessionSelection(
  profile: SessionTreeWeights,
  vibraLimit = 2,
): SuggestedSelection {
  const suggestion: SuggestedSelection = {};
  let prefix = "";

  const bestChildAtLevel = (level: "idioma" | "epoca" | "genero"): string | null => {
    const marker = prefix ? `${prefix}${LEVEL_SEPARATOR}${level}:` : `${level}:`;
    let best: { value: string; weight: number } | null = null;
    for (const [key, weight] of Object.entries(profile)) {
      if (!key.startsWith(marker) || weight <= 0) continue;
      const value = key.slice(marker.length).split(LEVEL_SEPARATOR)[0];
      if (!best || weight > best.weight) best = { value, weight };
    }
    return best?.value ?? null;
  };

  // No corta en el primer nivel sin datos: una sesión puede haber fijado idioma+género
  // pero no época (el path resultante salta esa época directo a "idioma:x>genero:y"), así
  // que un nivel sin hijos no significa que los niveles MÁS profundos tampoco los tengan --
  // solo significa que ESE nivel se queda en "todas" y se sigue bajando con el mismo prefix.
  for (const level of ["idioma", "epoca", "genero"] as const) {
    const value = bestChildAtLevel(level);
    if (!value) continue;
    suggestion[level] = value;
    prefix = prefix ? `${prefix}${LEVEL_SEPARATOR}${level}:${value}` : `${level}:${value}`;
  }

  const vibraMarker = prefix ? `${prefix}${LEVEL_SEPARATOR}vibra:` : "vibra:";
  const vibraWeights = new Map<string, number>();
  for (const [key, weight] of Object.entries(profile)) {
    if (weight <= 0 || !key.startsWith(vibraMarker)) continue;
    const value = key.slice(vibraMarker.length).split(LEVEL_SEPARATOR)[0];
    vibraWeights.set(value, Math.max(vibraWeights.get(value) ?? 0, weight));
  }
  if (vibraWeights.size > 0) {
    suggestion.vibras = [...vibraWeights.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, vibraLimit)
      .map(([value]) => value);
  }

  return suggestion;
}

const MULTIPLIER_STRENGTH = 0.3;
const MULTIPLIER_SATURATION = 5;

/**
 * PUNTO DE INTEGRACIÓN (b) -- para el hilo de trabajo del deck/ranking.
 *
 * Convierte un `SessionTreeWeights` (el acumulador de la sesión activa, o el
 * perfil consolidado de largo plazo -- misma forma, cualquiera de los dos sirve
 * de input) en un mapa `sessionMultipliers`: el mismo shape que `scoreTrack()` y
 * `rankCandidates()` en tasteEngine.ts YA aceptan como parámetro opcional. No
 * requiere ningún cambio en el motor de scoring -- solo produce el input que el
 * motor ya sabe consumir, así que el árbol nunca toca el filtro duro ni el cascade
 * de fallback existente.
 *
 * Solo género/vibra producen multiplicador: son las únicas dos dimensiones que
 * `dimensionKeys()` conoce de un `Candidate` (no existe `Candidate.idioma` ni
 * `Candidate.epoca`) -- idioma/época/ancla existen en el árbol solo para el punto
 * de integración (a), no tienen contraparte en el scoring de candidatos.
 *
 * Para cada nodo del árbol se usa SOLO su segmento final (`path.split(">").pop()`)
 * para decidir si es género o vibra -- un nodo "idioma:es>genero:reggaeton" y su
 * propio hijo "idioma:es>genero:reggaeton>vibra:fiesta" ambos "contienen" la
 * palabra género/vibra en el path completo, pero solo el primero TERMINA en
 * género y solo el segundo TERMINA en vibra; sumar por substring en vez de por
 * segmento final contaría el mismo swipe varias veces (una vez por cada nodo en
 * el que su género/vibra aparece como ancestro).
 */
export function sessionTreeToMultipliers(weights: SessionTreeWeights): Record<string, number> {
  const engineWeights: Record<string, number> = {};
  for (const [path, weight] of Object.entries(weights)) {
    const segments = path.split(LEVEL_SEPARATOR);
    const lastSegment = segments[segments.length - 1];
    if (lastSegment.startsWith("genero:") || lastSegment.startsWith("vibra:")) {
      engineWeights[lastSegment] = (engineWeights[lastSegment] ?? 0) + weight;
    }
  }

  const multipliers: Record<string, number> = {};
  for (const [engineKey, weight] of Object.entries(engineWeights)) {
    if (weight <= 0) continue;
    const saturated = Math.min(weight, MULTIPLIER_SATURATION) / MULTIPLIER_SATURATION;
    multipliers[engineKey] = 1 + saturated * MULTIPLIER_STRENGTH;
  }
  return multipliers;
}
