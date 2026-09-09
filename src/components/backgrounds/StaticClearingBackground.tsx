import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';

import { useReducedMotion } from '../../hooks/useReducedMotion';
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
const NOISE_ROWS = 46;
const NOISE_PER_ROW = 7;
/** Alto de la banda de interferencia que baja en loop (el "roll" de una tele mal sintonizada). */
const BAND_HEIGHT = 64;

/**
 * PRNG determinista (mulberry32). Se usa semilla fija en vez de Math.random para que el
 * campo de ruido sea SIEMPRE el mismo: si se regenerara en cada render, cada re-render de
 * React sacudiría la estática entera y se vería como un parpadeo aleatorio, no como una
 * textura. El movimiento lo pone la animación, no el azar.
 */
function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface NoiseChip {
  x: number;
  y: number;
  w: number;
  o: number;
}

function buildNoise(width: number, height: number): NoiseChip[] {
  // Semilla fija arbitraria -- lo único que importa es que no cambie entre renders.
  const rnd = seededRandom(0x5305);
  const chips: NoiseChip[] = [];
  const rowHeight = height / NOISE_ROWS;
  for (let row = 0; row < NOISE_ROWS; row++) {
    for (let i = 0; i < NOISE_PER_ROW; i++) {
      chips.push({
        x: rnd() * width,
        y: row * rowHeight,
        w: 2 + rnd() * 26,
        o: 0.05 + rnd() * 0.35,
      });
    }
  }
  return chips;
}

/**
 * Literaliza el eslogan: la estática (ruido) se despeja línea por línea. Va detrás del
 * estado de carga INICIAL del deck -- ver el comentario en SwipeDeck.tsx sobre por qué no
 * en la recarga en segundo plano.
 *
 * 2026-09-08: pasó de barras de color quietas a estática ANIMADA, porque quietas + un
 * spinner circular encima se leían como un loader genérico con rayas de adorno, no como
 * interferencia. Tres capas, y el spinner desapareció (la estática ES el indicador de que
 * algo está pasando):
 *   1. las franjas de color del wordmark, que siguen despejándose de arriba hacia abajo;
 *   2. un campo de ruido de ~320 chips que parpadea;
 *   3. una banda de interferencia que rueda en loop, como una tele mal sintonizada.
 *
 * Se descartó `feTurbulence` (ruido SVG de verdad, que sería lo ideal): react-native-svg
 * trae los tipos pero NO tiene implementación nativa -- verificado buscando en sus fuentes
 * de android/apple, no hay archivo de turbulence. O sea que se vería en el navegador y no
 * en el teléfono, que es justo donde importa. Estas tres capas son primitivas normales
 * (Rect + transform), así que corren igual en las dos plataformas.
 *
 * Respeta "movimiento reducido": con la preferencia activa no anima nada y se queda en la
 * versión quieta, igual que SwipeCard/GradientChip.
 */
export function StaticClearingBackground({ width, height, mode, baseColor }: StaticClearingBackgroundProps) {
  const reducedMotion = useReducedMotion();
  const base = baseColor ?? colorsForMode(mode).background;
  // Mismo criterio que HalftoneWaveBackground: el neón sobre casi-negro ya contrasta de
  // más, así que la rampa arranca más baja en oscuro. Se bajó menos que los otros dos
  // patrones a propósito: acá el patrón ES el mensaje, no decoración de fondo.
  const topOpacity = mode === 'dark' ? 0.38 : 0.5;
  const gap = height / LINE_COUNT;

  const noise = useMemo(() => buildNoise(width, height), [width, height]);

  const flicker = useSharedValue(1);
  const roll = useSharedValue(0);

  // En efecto y no durante el render: escribir un shared value mientras React renderiza es
  // un efecto secundario en fase de render (se dispararía de nuevo en cada re-render y en
  // el doble render de StrictMode). Acá arranca una sola vez por montaje.
  useEffect(() => {
    if (reducedMotion) return;
    flicker.value = withRepeat(withTiming(0.45, { duration: 90, easing: Easing.linear }), -1, true);
    roll.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.linear }), -1, false);
  }, [reducedMotion, flicker, roll]);

  const noiseStyle = useAnimatedStyle(() => ({ opacity: flicker.value }));
  const bandStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -BAND_HEIGHT + roll.value * (height + BAND_HEIGHT) }],
  }));

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
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

      <Animated.View style={[StyleSheet.absoluteFill, noiseStyle]} pointerEvents="none">
        <Svg width={width} height={height}>
          {noise.map((chip, i) => (
            <Rect key={i} x={chip.x} y={chip.y} width={chip.w} height={2} fill="#FFFFFF" opacity={chip.o} />
          ))}
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.band, { width }, bandStyle]} pointerEvents="none">
        <Svg width={width} height={BAND_HEIGHT}>
          <Rect x={0} y={0} width={width} height={BAND_HEIGHT} fill="#FFFFFF" opacity={0.05} />
          <Rect x={0} y={BAND_HEIGHT - 2} width={width} height={2} fill="#FFFFFF" opacity={0.18} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: BAND_HEIGHT,
  },
});
