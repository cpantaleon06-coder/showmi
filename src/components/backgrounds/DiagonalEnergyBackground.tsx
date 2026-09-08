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
 * Opacidad por modo, no un valor único: el mismo rosa neón sobre casi-negro
 * contrasta MUCHO más que sobre ivory, así que en oscuro va más bajo, no más
 * alto. (El addendum sugería SUBIR la opacidad en oscuro -- ese consejo asume un
 * patrón de color oscuro sobre fondo oscuro; acá los colores del wordmark son
 * neón, así que el ajuste correcto va en la dirección contraria.)
 *
 * 2026-09-08: ambas bajaron fuerte (claro 0.35->0.12, oscuro 0.20->0.10). A 0.35
 * el modo claro se leía como papel tapiz de rayas rosas y competía con el texto
 * y los chips encima -- exactamente el "ruido de fondo decorativo" que colors.ts
 * dice evitar. El patrón debe notarse al mirar el fondo, no al leer el contenido.
 * Complemento del mismo arreglo: los elementos que antes eran transparentes
 * (chips sin seleccionar, input de búsqueda, filas de resultado) ahora tienen
 * fondo opaco, así que el patrón ya no cruza por detrás de ninguna letra.
 */
export function DiagonalEnergyBackground({
  width,
  height,
  mode,
  stripeColor = wordmark.w.corner,
  baseColor,
}: DiagonalEnergyBackgroundProps) {
  const base = baseColor ?? colorsForMode(mode).background;
  const stripeOpacity = mode === 'dark' ? 0.1 : 0.12;

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
