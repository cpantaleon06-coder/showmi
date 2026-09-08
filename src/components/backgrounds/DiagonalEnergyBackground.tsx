import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

import { ThemeMode, colorsForMode } from '../../theme/colors';
import { wordmark } from '../../theme/wordmark';

interface DiagonalEnergyBackgroundProps {
  width: number;
  height: number;
  mode: ThemeMode;
  stripeColor?: string;
  baseColor?: string;
}

/**
 * Franjas diagonales tipo "energía" detrás de los pasos del cuestionario.
 *
 * Opacidad por modo, no un valor único: en claro las franjas van sobre ivory
 * (`lightColors.background`) y necesitan 0.35 para leerse; en oscuro el mismo
 * rosa neón sobre casi-negro contrasta MUCHO más, así que sube de tono solo, y
 * 0.35 lo convertiría en un fondo gritón que compite con los chips. Baja a 0.20.
 * (El addendum sugería SUBIR la opacidad en oscuro -- ese consejo asume un patrón
 * de color oscuro sobre fondo oscuro; acá los colores del wordmark son neón, así
 * que el ajuste correcto va en la dirección contraria.)
 */
export function DiagonalEnergyBackground({
  width,
  height,
  mode,
  stripeColor = wordmark.w.corner,
  baseColor,
}: DiagonalEnergyBackgroundProps) {
  const base = baseColor ?? colorsForMode(mode).background;
  const stripeOpacity = mode === 'dark' ? 0.2 : 0.35;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <Pattern id="diag" width={40} height={40} patternUnits="userSpaceOnUse" patternTransform="rotate(25)">
          <Rect width={16} height={40} fill={stripeColor} opacity={stripeOpacity} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={base} />
      <Rect x={0} y={0} width={width} height={height} fill="url(#diag)" />
    </Svg>
  );
}
