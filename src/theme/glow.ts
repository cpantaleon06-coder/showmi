import { VibeKey } from '../lib/vibes';
import { getGenreColor } from './genreColors';
import { VIBE_COLORS } from './vibeColors';

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Mezcla lineal en RGB. `t=0` devuelve `a`, `t=1` devuelve `b`. */
function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = parseHex(a);
  const [r2, g2, b2] = parseHex(b);
  const to2 = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${to2(r1 + (r2 - r1) * t)}${to2(g1 + (g2 - g1) * t)}${to2(b1 + (b2 - b1) * t)}`;
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Cuánto pesa la vibra frente al género en la mezcla del halo. 0.5 exacto daría un
 * color intermedio que a menudo no se parece a ninguno de los dos (mezclar dos matices
 * opuestos en RGB tiende al gris). 0.4 deja al género marcando la familia de color y a
 * la vibra tiñéndolo -- el género de una canción es estable, la vibra es la señal que
 * la comunidad vota y puede cambiar, así que manda el más estable.
 */
const VIBE_WEIGHT = 0.4;

/**
 * Color del halo de una tarjeta, combinando SU género y SU vibra.
 *
 * - Con ambos: género teñido por la vibra (ver VIBE_WEIGHT).
 * - Con solo uno: ese color tal cual.
 * - Con ninguno: `fallback` (el acento de sesión, que ya usa el resto del deck).
 *
 * La vibra por track es la canónica votada por la comunidad (`track_canonical_vibe`),
 * que solo existe con suficientes votos -- por eso lo normal al principio es caer al
 * caso "solo género", y el halo igual reacciona carta a carta.
 */
export function cardGlowColor(
  rawGenre: string | null | undefined,
  vibe: VibeKey | null | undefined,
  fallback: string,
): string {
  const genreColor = getGenreColor(rawGenre);
  const vibeColor = vibe ? VIBE_COLORS[vibe] : undefined;

  if (genreColor && vibeColor) return mixHex(genreColor, vibeColor, VIBE_WEIGHT);
  return genreColor ?? vibeColor ?? fallback;
}

/**
 * `boxShadow` (no las props `shadow*`, deprecadas en RN 0.86 -- ver el warning de
 * consola que ya salía en el proyecto) para el halo alrededor de una tarjeta.
 *
 * La tarjeta activa brilla más fuerte que las de atrás: en la pila las de abajo se ven
 * escaladas y desplazadas, y con el mismo halo las tres se sumaban en una mancha de
 * color en vez de leerse como una pila. El de abajo apenas insinúa el color de la
 * siguiente carta, que es la información útil ("lo que viene es de otro palo").
 */
export function cardGlowShadow(color: string, isActive: boolean): string {
  return isActive ? `0 0 28px 2px ${rgba(color, 0.55)}` : `0 0 14px ${rgba(color, 0.25)}`;
}
