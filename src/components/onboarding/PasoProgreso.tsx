import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { useReducedMotion } from '../../hooks/useReducedMotion';
import { conResorte, conTiempo, duracion, resortes } from '../../theme/motion';
import { ThemeColors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import { wordmark } from '../../theme/wordmark';

/**
 * Barra de progreso del onboarding (2026-09-16).
 *
 * POR QUÉ EXISTE: el onboarding eran cuatro pantallas idénticas -- título, subtítulo gris,
 * chips, botón -- sin nada que dijera cuántas faltaban ni en cuál estabas. Esa ausencia es la
 * mitad de lo que hacía que se sintiera genérico: no es que estuviera feo, es que no se sabía
 * si era el principio o el final, y un formulario sin final visible se abandona.
 *
 * POR QUÉ CON LOS COLORES DEL WORDMARK Y NO CON EL COLOR DE MARCA: Showmi tiene seis letras y
 * cada una con su color muestreado (ver theme/wordmark.ts), y el onboarding tiene cuatro pasos.
 * Darle a cada paso la letra que le toca convierte la barra en algo que solo puede ser de esta
 * app; cuatro segmentos del mismo naranja serían la barra de cualquier otra. Además el color
 * AVANZA -- rojo, verde, naranja, rosa -- así que el progreso se nota aunque no se lea el "2 de
 * 4", que es justo lo que hace una barra de progreso cuando funciona.
 *
 * Los pasos ya hechos se quedan CON su color, no se apagan a gris: lo que llevas hecho es lo
 * que te anima a terminar, y borrarlo visualmente al avanzar tira ese refuerzo a la basura.
 */

/** Un color por paso, en el orden en que se recorren. */
const COLORES = [
  wordmark.s.corner,
  wordmark.h.corner,
  wordmark.o.corner,
  wordmark.w.corner,
] as const;

const ALTO = 5;

interface PasoProgresoProps {
  colors: ThemeColors;
  /** Índice del paso actual, empezando en 0. */
  indice: number;
  total: number;
}

export function PasoProgreso({ colors, indice, total }: PasoProgresoProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.barras}>
        {Array.from({ length: total }, (_, i) => (
          <Segmento
            key={i}
            color={COLORES[i % COLORES.length]}
            inerte={colors.border}
            activo={i === indice}
            hecho={i < indice}
          />
        ))}
      </View>
      <Text style={[styles.cuenta, { color: colors.textSecondary }]}>
        {indice + 1} de {total}
      </Text>
    </View>
  );
}

function Segmento({
  color,
  inerte,
  activo,
  hecho,
}: {
  color: string;
  inerte: string;
  activo: boolean;
  hecho: boolean;
}) {
  const reducedMotion = useReducedMotion();
  // `flex` animado y no `width`: los segmentos comparten una fila, así que lo que cambia es el
  // REPARTO entre ellos. Animar anchos fijos obligaría a medir la pantalla y a recalcular al
  // rotar; animar el reparto lo resuelve el propio layout.
  const peso = useSharedValue(activo ? 2 : 1);
  const relleno = useSharedValue(activo || hecho ? 1 : 0);

  useEffect(() => {
    // El segmento activo se ENSANCHA: el color solo dice cuál es, el tamaño dice dónde estás.
    // Con resorte y no con duración porque es lo único de la pantalla que se mueve al avanzar,
    // y un punto de gracia contado es justo para lo que existe `resortes.gracia`.
    peso.value = conResorte(activo ? 2 : 1, reducedMotion, resortes.gracia);
    relleno.value = conTiempo(activo || hecho ? 1 : 0, reducedMotion, duracion.base);
  }, [activo, hecho, reducedMotion, peso, relleno]);

  const estiloCaja = useAnimatedStyle(() => ({ flex: peso.value }));
  const estiloRelleno = useAnimatedStyle(() => ({ opacity: relleno.value }));

  return (
    <Animated.View style={[styles.segmento, { backgroundColor: inerte }, estiloCaja]}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: color, borderRadius: ALTO / 2 }, estiloRelleno]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  barras: { flex: 1, flexDirection: 'row', gap: 6 },
  segmento: { height: ALTO, borderRadius: ALTO / 2, overflow: 'hidden' },
  cuenta: { fontSize: 11, fontFamily: fonts.bodyBold, letterSpacing: 0.3 },
});
