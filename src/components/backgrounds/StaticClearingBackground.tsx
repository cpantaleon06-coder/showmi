import Svg, { Rect } from 'react-native-svg';

import { ThemeMode, colorsForMode } from '../../theme/colors';
import { WORDMARK_CORNER_SEQUENCE } from '../../theme/wordmark';

interface StaticClearingBackgroundProps {
  width: number;
  height: number;
  mode: ThemeMode;
  baseColor?: string;
}

const LINE_COUNT = 9;
const LINE_HEIGHT = 4;

/**
 * Literaliza el eslogan: la estática (ruido) se apaga línea por línea de arriba
 * hacia abajo. Versión estática, sin animar.
 *
 * Va detrás del estado de carga INICIAL del deck ("Buscando sonidos para ti…"),
 * no detrás de la recarga en segundo plano que sugería el addendum -- ver el
 * comentario en SwipeDeck.tsx para por qué esa otra ubicación no funcionaba.
 */
export function StaticClearingBackground({ width, height, mode, baseColor }: StaticClearingBackgroundProps) {
  const base = baseColor ?? colorsForMode(mode).background;
  // Mismo criterio que DiagonalEnergyBackground: el neón sobre casi-negro ya
  // contrasta de más, así que la rampa arranca más baja en oscuro. Se bajó menos
  // que los otros dos patrones a propósito: esta pantalla solo tiene un spinner y
  // una línea de texto centrados, no hay contenido que estorbar -- y es el único
  // de los tres donde el patrón ES el mensaje ("la estática se despeja"), no
  // decoración de fondo.
  const topOpacity = mode === 'dark' ? 0.38 : 0.5;
  const gap = height / LINE_COUNT;

  return (
    <Svg width={width} height={height}>
      <Rect x={0} y={0} width={width} height={height} fill={base} />
      {Array.from({ length: LINE_COUNT }).map((_, i) => (
        <Rect
          key={i}
          x={0}
          y={i * gap}
          width={width}
          height={LINE_HEIGHT}
          fill={WORDMARK_CORNER_SEQUENCE[i % WORDMARK_CORNER_SEQUENCE.length]}
          opacity={Math.max(topOpacity - (topOpacity / LINE_COUNT) * i, 0.04)}
        />
      ))}
    </Svg>
  );
}
