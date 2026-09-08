/**
 * Showmi -- paleta del wordmark, muestreada letra por letra (2026-09-08).
 *
 * ADVERTENCIA DE PRECISIÓN (viene del addendum que originó este archivo): estos
 * valores salieron de un muestreo visual del wordmark, NO de un archivo fuente
 * vectorial. Si aparece el original (AI/SVG/Figma), confirmar cada par contra él
 * antes de tratarlos como canon.
 *
 * Deliberadamente separado de `colors.ts`: ese archivo es la paleta FUNCIONAL
 * (fondo, texto, marca interactiva, estados de like/pass), esto es la paleta de
 * IDENTIDAD -- las 6 letras del logo. Misma separación que ya existe entre
 * `brand` y `nagaiGradient` (ver el comentario largo de colors.ts): dos sistemas
 * de color con trabajos distintos, que no deben acoplarse ni "corregirse" el uno
 * contra el otro.
 *
 * NOTA sobre el ivory/ink del addendum: se omitieron a propósito. `#F3ECE0` y
 * `#141414` NO son valores nuevos -- son exactamente `lightColors.background` y
 * `lightColors.textPrimary` de colors.ts. Re-declararlos acá crearía dos fuentes
 * de verdad para el mismo hex, y la próxima vez que alguien ajuste el tema claro
 * quedarían desincronizados en silencio. Los fondos de patrón sacan su color base
 * de `colorsForMode(mode).background`, así que siguen el tema solos.
 */
export const wordmark = {
  s: { corner: '#F7083F', fill: '#E0F89C' },
  h: { corner: '#17C772', fill: '#0C8448' },
  o: { corner: '#F28407', fill: '#F48000' },
  w: { corner: '#F95AB6', fill: '#FC0084' },
  m: { corner: '#087ADB', fill: '#0010D8' },
  i: { corner: '#F9EB06', fill: '#000000' },
} as const;

/**
 * Las 6 esquinas en el orden en que se usan como secuencia (estática que se
 * despeja, ver StaticClearingBackground). Derivado de `wordmark` en vez de ser
 * una lista de hexes aparte, para que agregar/ajustar una letra no deje esta
 * secuencia apuntando a un color viejo.
 */
export const WORDMARK_CORNER_SEQUENCE: readonly string[] = [
  wordmark.s.corner,
  wordmark.m.corner,
  wordmark.h.corner,
  wordmark.w.corner,
  wordmark.o.corner,
  wordmark.i.corner,
];
