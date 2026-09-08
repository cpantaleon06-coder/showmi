import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

import { ThemeMode, colorsForMode } from '../../theme/colors';
import { wordmark } from '../../theme/wordmark';

interface DotGridBackgroundProps {
  width: number;
  height: number;
  mode: ThemeMode;
  dotColor?: string;
  baseColor?: string;
}

/**
 * Retícula de puntos para estados VACÍOS (Biblioteca sin canciones, Feed sin
 * posts todavía) -- da textura a una pantalla que si no queda como un error, sin
 * meter ilustración ni copy extra.
 *
 * Solo se monta cuando la lista está vacía: con contenido real encima, la
 * retícula competiría con las filas/tarjetas, que es justo lo que el sistema de
 * diseño evita (ver la nota de "nunca en listas, filas, texto o navegación" en
 * colors.ts).
 */
export function DotGridBackground({
  width,
  height,
  mode,
  dotColor = wordmark.h.corner,
  baseColor,
}: DotGridBackgroundProps) {
  const base = baseColor ?? colorsForMode(mode).background;
  // Ver DiagonalEnergyBackground: el verde neón sobre casi-negro contrasta más
  // que sobre ivory, así que baja en oscuro en vez de subir.
  const dotOpacity = mode === 'dark' ? 0.3 : 0.5;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <Pattern id="dotGrid" width={24} height={24} patternUnits="userSpaceOnUse">
          <Circle cx={12} cy={12} r={2} fill={dotColor} opacity={dotOpacity} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={base} />
      <Rect x={0} y={0} width={width} height={height} fill="url(#dotGrid)" />
    </Svg>
  );
}
