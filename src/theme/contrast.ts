/**
 * Elección de color de texto por contraste medido (2026-09-12).
 *
 * Nace de un bug real del rediseño maximalista de Biblioteca: los chips rellenos escribían
 * `#FFFFFF` fijo encima, lo cual estaba bien mientras el relleno fuera siempre el terracota de
 * marca, pero dejó de estarlo en cuanto cada colección pasó a tener su propio color del
 * wordmark. Blanco sobre el amarillo `#F9EB06` da 1.07:1 -- texto invisible, no "poco
 * contrastado".
 *
 * No es una regla estética sino aritmética: se calcula el contraste WCAG contra tinta y contra
 * blanco y gana el mayor. Y de paso coincide con la referencia de póster que originó el
 * rediseño, donde los pills saturados llevan tipografía NEGRA, no blanca.
 */

const INK = '#141414';
const WHITE = '#FFFFFF';

function channelLuminance(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const normalized = hex.replace('#', '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Tinta o blanco, el que más contraste dé sobre `background`. Para texto/íconos ENCIMA de un
 *  bloque de color sólido (chips rellenos, botones de acento). */
export function readableOn(background: string): string {
  return contrastRatio(background, INK) >= contrastRatio(background, WHITE) ? INK : WHITE;
}
