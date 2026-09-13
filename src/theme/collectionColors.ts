import { getGenreColor } from './genreColors';
import { WORDMARK_CORNER_SEQUENCE, wordmark } from './wordmark';

/**
 * Color por COLECCIÓN de la Biblioteca (2026-09-12).
 *
 * Por qué existe: hasta ahora todas las pestañas de colección se pintaban con `colors.brand`,
 * el mismo terracota para "Para escuchar", "Escuchadas" y cualquier lista nueva. Funcionaba,
 * pero dejaba la pantalla en un solo acento -- lo contrario de lo que la Biblioteca tiene que
 * ser ahora: un mural, no una lista con un color de marca encima.
 *
 * Se reparte la secuencia de las 6 esquinas del wordmark (ver wordmark.ts) en vez de inventar
 * una paleta nueva, por el mismo motivo que `genreColors.ts` hace lo suyo: cualquier color
 * que aparezca en esta pantalla ya es un color de la marca. Con más de 6 colecciones la
 * secuencia da la vuelta -- repetir un color de la identidad es mejor que estirar la paleta
 * con tonos que no son de nadie.
 *
 * Las dos colecciones por defecto se fijan a mano y NO por índice: son las únicas que existen
 * en TODAS las instalaciones, así que su color es parte de cómo se ve la app recién abierta y
 * no debe moverse si algún día cambia el orden de la lista.
 */
const FIXED_COLLECTION_COLORS: Record<string, string> = {
  // Rosa: lo que está por descubrirse, el lado "vivo" de la biblioteca.
  para_escuchar: wordmark.w.corner,
  // Verde: lo ya consumido, cerrado, en su lugar.
  escuchadas: wordmark.h.corner,
};

export function getCollectionColor(collectionId: string, index: number): string {
  return (
    FIXED_COLLECTION_COLORS[collectionId] ??
    // +2 para que la primera colección personalizada no repita el rosa/verde de las fijas.
    WORDMARK_CORNER_SEQUENCE[(index + 2) % WORDMARK_CORNER_SEQUENCE.length]
  );
}

/**
 * Color del contorno de una teja del mosaico.
 *
 * Prefiere el color real del GÉNERO del track (ver genreColors.ts) para que el mosaico diga
 * algo verdadero sobre lo que guardaste -- dos corridos comparten contorno, un techno destaca.
 * Cuando el género no se resuelve (iTunes no siempre lo trae, y la tabla de sinónimos no cubre
 * el 100%) cae a la secuencia del wordmark por POSICIÓN, no a un gris: un hueco de color en
 * mitad del mural se lee como error de carga, y aquí la variedad es el punto.
 */
export function getTileAccent(rawGenre: string | null | undefined, index: number): string {
  return getGenreColor(rawGenre) ?? WORDMARK_CORNER_SEQUENCE[index % WORDMARK_CORNER_SEQUENCE.length];
}

/**
 * Fondo de las tejas y los paneles del mosaico, en LOS DOS temas.
 *
 * No sale de `colors.surface` a propósito, y es la decisión visual más discutible de esta
 * pantalla, así que queda escrita: las tarjetas son negras sobre papel en tema claro y negras
 * sobre pizarra en tema oscuro. Es el recurso de la referencia de museo que mandó el usuario
 * (UI clara, tarjetas negras con patrón saturado encima) y es lo que hace que los contornos de
 * color funcionen -- sobre `surface` claro (#FFFDF8) el amarillo y el verde neón del wordmark
 * se lavan hasta desaparecer.
 */
export const TILE_SURFACE = '#141414';

/** Texto secundario DENTRO de una teja negra -- `colors.textSecondary` es casi negro en tema
 *  claro y ahí desaparecería. */
export const TILE_TEXT_MUTED = '#A8A29A';
