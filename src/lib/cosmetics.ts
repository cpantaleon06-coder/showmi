import { CANONICAL_GENRES, GENRE_CATEGORY_ORDER, GenreCategory, resolveCanonicalGenre } from './genres';

/**
 * Sistema de cosméticos del Camerino. Reglas de producto ya establecidas y NO negociables
 * (ver memoria de producto de Showmi):
 *  - earn-or-buy: un cosmético o se GANA con progreso real, o viene con Showmi More. Nunca
 *    las dos cosas para el mismo item, para que ninguno se sienta "comprable a la mala".
 *  - **Cero aleatoriedad en lo que se paga.** Los items de More se ven y se nombran ANTES de
 *    pagar; no hay cajas sorpresa ni tiradas. Los ganados también son determinísticos acá
 *    (cada nivel entrega un item concreto y anunciado) -- la regla solo prohíbe azar en lo
 *    comprado, pero un objetivo claro ("llega a nivel 2 en Latino y te dan el sombrero") es
 *    mejor producto que una sorpresa, así que no se usa azar en ningún lado.
 *
 * El progreso se lleva por CATEGORÍA de género (6: Latino, Rock/Alternativo, ...), no por los
 * 53 géneros canónicos -- 53 barras de progreso serían ilegibles y ninguna avanzaría a un
 * ritmo perceptible.
 */

export type CosmeticSlot = 'sombrero' | 'accesorio' | 'estampado';

export const COSMETIC_SLOTS: { key: CosmeticSlot; label: string }[] = [
  { key: 'sombrero', label: 'Cabeza' },
  { key: 'accesorio', label: 'Accesorio' },
  { key: 'estampado', label: 'Estampado' },
];

export interface CosmeticItem {
  id: string;
  name: string;
  slot: CosmeticSlot;
  /** Color principal con el que se dibuja la pieza (ver Mascot.tsx). */
  color: string;
  /** `earned`: se desbloquea llegando a `level` en `category`. `more`: viene con Showmi More. */
  source: { kind: 'earned'; category: GenreCategory; level: number } | { kind: 'more' };
}

/**
 * Calificaciones acumuladas necesarias para cada nivel. Nivel 0 = sin progreso; el índice del
 * arreglo es el nivel. Curva deliberadamente suave al principio (5 calificaciones dan el
 * primer desbloqueo) para que el Camerino no se sienta vacío en la primera sesión real.
 */
export const LEVEL_THRESHOLDS = [0, 5, 15, 30];

export const MAX_LEVEL = LEVEL_THRESHOLDS.length - 1;

export function levelForRatings(ratings: number): number {
  let level = 0;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (ratings >= LEVEL_THRESHOLDS[i]) level = i;
  }
  return level;
}

/** Progreso hacia el SIGUIENTE nivel, 0-1. Devuelve 1 si ya está al máximo. */
export function progressToNextLevel(ratings: number): number {
  const level = levelForRatings(ratings);
  if (level >= MAX_LEVEL) return 1;
  const from = LEVEL_THRESHOLDS[level];
  const to = LEVEL_THRESHOLDS[level + 1];
  return Math.max(0, Math.min(1, (ratings - from) / (to - from)));
}

/**
 * Dos items ganados por categoría (nivel 1 y 2) + un estampado al nivel 3, y tres exclusivos
 * de Showmi More. Los colores salen de la paleta constructivista del proyecto (rojo cartel,
 * crema, negro) más acentos propios por categoría -- no de `nagaiGradient`, que está reservado
 * a headers y chips seleccionados (ver colors.ts).
 */
export const COSMETICS: CosmeticItem[] = [
  // --- Latino ---
  { id: 'sombrero_charro', name: 'Sombrero charro', slot: 'sombrero', color: '#C9A227', source: { kind: 'earned', category: 'Latino', level: 1 } },
  { id: 'flor_oreja', name: 'Flor en la oreja', slot: 'accesorio', color: '#E8362A', source: { kind: 'earned', category: 'Latino', level: 2 } },

  // --- Rock/Alternativo ---
  { id: 'cresta', name: 'Cresta punk', slot: 'sombrero', color: '#E8362A', source: { kind: 'earned', category: 'Rock/Alternativo', level: 1 } },
  { id: 'pua', name: 'Púa al cuello', slot: 'accesorio', color: '#F2ECE4', source: { kind: 'earned', category: 'Rock/Alternativo', level: 2 } },

  // --- Pop/Urbano ---
  { id: 'gorra', name: 'Gorra de lado', slot: 'sombrero', color: '#2D5BFF', source: { kind: 'earned', category: 'Pop/Urbano', level: 1 } },
  { id: 'cadena', name: 'Cadena', slot: 'accesorio', color: '#C9A227', source: { kind: 'earned', category: 'Pop/Urbano', level: 2 } },

  // --- Electrónica/Chill ---
  { id: 'audifonos', name: 'Audífonos', slot: 'sombrero', color: '#0F6E7D', source: { kind: 'earned', category: 'Electrónica/Chill', level: 1 } },
  { id: 'visor', name: 'Visor LED', slot: 'accesorio', color: '#0F6E7D', source: { kind: 'earned', category: 'Electrónica/Chill', level: 2 } },

  // --- Raíces ---
  { id: 'boina', name: 'Boina', slot: 'sombrero', color: '#5C5449', source: { kind: 'earned', category: 'Raíces', level: 1 } },
  { id: 'moño', name: 'Moño de gala', slot: 'accesorio', color: '#141414', source: { kind: 'earned', category: 'Raíces', level: 2 } },

  // --- Del Mundo ---
  { id: 'turbante', name: 'Turbante', slot: 'sombrero', color: '#D9718C', source: { kind: 'earned', category: 'Del Mundo', level: 1 } },
  { id: 'bufanda', name: 'Bufanda larga', slot: 'accesorio', color: '#FF8C5A', source: { kind: 'earned', category: 'Del Mundo', level: 2 } },

  // --- Estampados por nivel 3 (los más difíciles de ganar) ---
  { id: 'rayas', name: 'Rayas', slot: 'estampado', color: '#141414', source: { kind: 'earned', category: 'Latino', level: 3 } },
  { id: 'lunares', name: 'Lunares', slot: 'estampado', color: '#141414', source: { kind: 'earned', category: 'Pop/Urbano', level: 3 } },

  // --- Exclusivos de Showmi More (compra directa, nunca aleatorios) ---
  { id: 'corona', name: 'Corona', slot: 'sombrero', color: '#C9A227', source: { kind: 'more' } },
  { id: 'lentes_dorados', name: 'Lentes dorados', slot: 'accesorio', color: '#C9A227', source: { kind: 'more' } },
  { id: 'estrellas', name: 'Estrellas', slot: 'estampado', color: '#C9A227', source: { kind: 'more' } },
];

export function cosmeticById(id: string): CosmeticItem | undefined {
  return COSMETICS.find((c) => c.id === id);
}

/** Mapa género canónico -> categoría, armado una sola vez desde la taxonomía existente. */
const CATEGORY_BY_GENRE = new Map(CANONICAL_GENRES.map((g) => [g.key, g.category] as const));

/**
 * Categoría a la que sumarle progreso a partir del string CRUDO de género de iTunes
 * (`Track.genre`, ej. "Latin", "Urbano latino", "Hip-Hop/Rap").
 *
 * A propósito es MÁS LAXA que `resolveCanonicalGenre` (que exige match exacto de tag): primero
 * intenta la resolución estricta, y si falla cae a substring en ambos sentidos. La razón es la
 * asimetría del costo -- equivocarse aquí solo hace que unas calificaciones sumen a la barra
 * vecina, mientras que aflojar el matcher del deck cambiaría qué canciones ve la persona. Con
 * el matcher estricto solo, strings comunísimos de iTunes como "Latin" no resuelven a nada y
 * el Camerino se sentiría muerto aunque la persona califique mucho.
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

export { GENRE_CATEGORY_ORDER };
export type { GenreCategory };
