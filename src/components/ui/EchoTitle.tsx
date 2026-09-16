import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { fonts } from '../../theme/typography';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface EchoTitleProps {
  text: string;
  /** Color de las copias de atrás -- normalmente el de la colección activa. */
  accent: string;
  /** Color de la copia sólida de enfrente. */
  color: string;
  size: number;
}

/**
 * Título con "eco": la misma palabra repetida detrás de sí misma, desplazada y en color
 * (2026-09-12).
 *
 * Es el recurso que se robó de la referencia de la app de música que mandó el usuario, donde
 * cada tarjeta tiene su figura repetida en capas hacia atrás. Traído a tipografía hace dos
 * cosas a la vez: da el volumen de cartel que pedía el encargo ("maximalista") y convierte el
 * cambio de colección en un evento VISIBLE -- el eco viaja al color de la colección nueva con
 * un spring, así que tocar una pestaña se siente, no solo se ve.
 *
 * Las copias son Text de verdad y no una sombra: `shadow*` está descartado en este sistema de
 * diseño (ver la restricción anti-"AI slop" del proyecto) y además una sombra difusa no da
 * este efecto -- acá los bordes de cada copia quedan duros, que es justo lo que lo hace leer
 * como impresión mal registrada y no como relieve.
 *
 * `accessibilityElementsHidden` en las copias: para un lector de pantalla esto es UNA palabra,
 * no cuatro.
 */
/**
 * Opacidades subidas tras verlo en vivo (0.2/0.35/0.6 -> 0.28/0.48/0.75): con un color claro
 * del wordmark (el amarillo `#F9EB06`) sobre el fondo ivory del tema claro, el eco al 20%
 * simplemente no estaba. Sigue sin igualar la fuerza que tiene sobre el fondo oscuro -- el
 * amarillo sobre crema es de bajo contraste por definición y ninguna opacidad lo arregla --
 * pero deja de desaparecer, y ahí el eco es decoración, no información.
 */
/**
 * 2026-09-15: de tres capas a dos, y los desplazamientos a la mitad (12/8/4 -> 6/3 en x).
 * Visto en vivo a 42px, el eco de 12px se extendia tanto hacia abajo-derecha que chocaba con
 * la linea de "N canciones" y dejaba de leerse como impresion mal registrada para leerse como
 * una mancha. El recurso funciona cuando las copias casi se tocan: apretado es un efecto,
 * separado es un borron.
 */
const ECHO_LAYERS = [
  { dx: 6, dy: 5, opacity: 0.38 },
  { dx: 3, dy: 2.5, opacity: 0.7 },
];

export function EchoTitle({ text, accent, color, size }: EchoTitleProps) {
  const reducedMotion = useReducedMotion();
  // El color se interpola por un progreso numérico compartido en vez de animar el string
  // directamente: así el MISMO spring mueve el color y el desplazamiento del eco, que nacen
  // del mismo evento (cambiar de colección) y tienen que llegar juntos.
  const from = useSharedValue(accent);
  const to = useSharedValue(accent);
  const progress = useSharedValue(1);

  useEffect(() => {
    from.value = to.value;
    to.value = accent;
    progress.value = 0;
    progress.value = reducedMotion
      ? withTiming(1, { duration: 1 })
      : withSpring(1, { damping: 14, stiffness: 120 });
  }, [accent, from, to, progress, reducedMotion]);

  return (
    <View style={styles.wrap}>
      {ECHO_LAYERS.map((layer) => (
        <EchoLayer key={`${layer.dx}`} text={text} layer={layer} size={size} from={from} to={to} progress={progress} />
      ))}
      <Text style={[styles.text, { color, fontSize: size, lineHeight: size * 1.06 }]}>{text}</Text>
    </View>
  );
}

function EchoLayer({
  text,
  layer,
  size,
  from,
  to,
  progress,
}: {
  text: string;
  layer: (typeof ECHO_LAYERS)[number];
  size: number;
  from: SharedValue<string>;
  to: SharedValue<string>;
  progress: SharedValue<number>;
}) {
  // Cada capa entra desde un poco más lejos y se asienta en su offset final: el eco
  // "aterriza" al cambiar de colección en vez de saltar.
  const animatedStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [from.value, to.value]),
    transform: [
      { translateX: layer.dx * (0.55 + progress.value * 0.45) },
      { translateY: layer.dy * (0.55 + progress.value * 0.45) },
    ],
  }));

  return (
    <Animated.Text
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.text,
        styles.echo,
        { fontSize: size, lineHeight: size * 1.06, opacity: layer.opacity },
        animatedStyle,
      ]}
    >
      {text}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  wrap: {
    // El eco se sale hacia abajo-derecha del cuadro del texto; sin esto lo recorta el padre.
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: fonts.display,
    // includeFontPadding/letterSpacing apretado: a este tamaño ArchivoBlack necesita que las
    // letras se toquen para leerse como un bloque de cartel y no como palabras sueltas.
    letterSpacing: -1.2,
  },
  echo: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
