import { GenreCategory, categoryForRawGenre } from '../lib/genres';
import { wordmark } from './wordmark';

/**
 * Color por categoría de género -- contraparte de `vibeColors.ts` (mismo rol, otra
 * dimensión del motor). Alimenta el halo reactivo de las tarjetas del deck, ver
 * `theme/glow.ts`.
 *
 * Se mapea contra las 6 letras del wordmark y no contra una paleta nueva: hay
 * exactamente 6 categorías de género (ver genres.ts) y exactamente 6 letras, así que
 * el halo de una tarjeta siempre es un color que YA es de la marca. La asignación
 * letra->categoría en sí es una elección de tono (rojo=fiesta latina, azul
 * eléctrico=rock, rosa=pop, verde neón=electrónica, naranja tierra=raíces,
 * amarillo=del mundo), no una correspondencia con la letra inicial.
 *
 * Se usan los tonos `corner` y no los `fill` porque el fill de la "i" es negro puro
 * (#000000) -- inservible como halo, y mezclar corner/fill según la letra rompería la
 * consistencia. Los 6 corner son 6 matices vivos y bien separados entre sí.
 */
export const GENRE_CATEGORY_COLORS: Record<GenreCategory, string> = {
  Latino: wordmark.s.corner,
  'Rock/Alternativo': wordmark.m.corner,
  'Pop/Urbano': wordmark.w.corner,
  'Electrónica/Chill': wordmark.h.corner,
  Raíces: wordmark.o.corner,
  'Del Mundo': wordmark.i.corner,
};

/**
 * Color de un género CRUDO de iTunes (`track.genre`, ej. "Hip-Hop/Rap", "Latino").
 * Devuelve null cuando el string no cae en ninguna categoría -- quien llama decide el
 * fallback, igual que `getVibeColor`.
 *
 * Reusa `categoryForRawGenre` (lib/genres.ts) a propósito en vez de re-implementar el
 * matcheo: esa función ya es deliberadamente laxa (cae a substring) porque un género
 * mal clasificado ahí solo mueve un color, nunca cambia qué canciones ve la persona.
 */
export function getGenreColor(rawGenre: string | null | undefined): string | null {
  const category = categoryForRawGenre(rawGenre);
  return category ? GENRE_CATEGORY_COLORS[category] : null;
}
