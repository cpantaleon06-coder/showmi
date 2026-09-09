import Svg, { Circle, Defs, LinearGradient, Pattern, Rect, Stop } from 'react-native-svg';

import { ThemeMode, colorsForMode } from '../../theme/colors';

interface HalftoneWaveBackgroundProps {
  width: number;
  height: number;
  mode: ThemeMode;
  baseColor?: string;
  dotColor?: string;
}

/** Paso de la retícula y radio del punto. Fino a propósito: a esta escala la trama se lee
 *  como textura impresa y no como "puntos", que es lo que la vuelve tranquila. */
const DOT_PITCH = 7;
const DOT_RADIUS = 1.5;

/**
 * Trama de semitono (halftone) con bandas suaves de luz en diagonal.
 *
 * 2026-09-08: reemplaza a DiagonalEnergyBackground (franjas diagonales sólidas), que mareaba.
 * El problema de aquel no era la opacidad -- ya se había bajado a 0.10-0.12 -- sino los BORDES
 * DUROS: franjas paralelas de alto contraste con filo definido generan vibración/moiré cuando
 * uno mueve la vista o hace scroll. Bajar la opacidad lo atenúa pero no lo quita.
 *
 * Acá no hay ningún borde: la trama es uniforme y lo que varía es cuánto se la ve, con un
 * degradado suave encima. La textura se apaga y se enciende en ondas en vez de cortarse.
 *
 * Cómo está hecho, y por qué así: en un halftone de verdad varía el TAMAÑO de cada punto, lo
 * que obliga a dibujar un círculo por posición -- a paso 7px en una pantalla de teléfono son
 * ~5000 nodos SVG, demasiado para nativo. Acá el patrón se tilea una sola vez (2 nodos) y las
 * ondas salen de un degradado del color de fondo encima, que "apaga" los puntos donde es más
 * opaco. A 1.5px de radio la diferencia entre variar tamaño y variar visibilidad no se nota.
 */
export function HalftoneWaveBackground({
  width,
  height,
  mode,
  baseColor,
  dotColor,
}: HalftoneWaveBackgroundProps) {
  const themed = colorsForMode(mode);
  const base = baseColor ?? themed.background;
  // En oscuro los puntos son luz sobre el fondo; en claro, tinta sobre el papel ivory.
  const dot = dotColor ?? (mode === 'dark' ? '#FFFFFF' : themed.textPrimary);
  const dotOpacity = mode === 'dark' ? 0.6 : 0.42;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <Pattern id="halftone" width={DOT_PITCH} height={DOT_PITCH} patternUnits="userSpaceOnUse">
          <Circle cx={DOT_PITCH / 2} cy={DOT_PITCH / 2} r={DOT_RADIUS} fill={dot} opacity={dotOpacity} />
        </Pattern>
        {/*
          Las paradas son irregulares a propósito. Repartidas de forma pareja, las bandas
          quedan rítmicas y vuelven a leerse como un patrón que late -- justo lo que se está
          corrigiendo. Espaciadas de forma despareja se leen como luz cayendo sobre una
          superficie, que es lo que hace la referencia.
        */}
        <LinearGradient id="waves" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={base} stopOpacity="0.24" />
          <Stop offset="0.19" stopColor={base} stopOpacity="0.58" />
          <Stop offset="0.36" stopColor={base} stopOpacity="0.94" />
          <Stop offset="0.54" stopColor={base} stopOpacity="0.3" />
          <Stop offset="0.71" stopColor={base} stopOpacity="0.86" />
          <Stop offset="0.88" stopColor={base} stopOpacity="0.55" />
          <Stop offset="1" stopColor={base} stopOpacity="0.97" />
        </LinearGradient>
      </Defs>

      <Rect x={0} y={0} width={width} height={height} fill={base} />
      <Rect x={0} y={0} width={width} height={height} fill="url(#halftone)" />
      <Rect x={0} y={0} width={width} height={height} fill="url(#waves)" />
    </Svg>
  );
}
