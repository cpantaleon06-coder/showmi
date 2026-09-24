import { Pressable, StyleSheet, View } from 'react-native';
import { ArrowUUpLeftIcon, HeartIcon, UploadSimpleIcon, XIcon } from 'phosphor-react-native';

import { ThemeColors } from '../../theme/colors';
import { iconSize } from '../../theme/icons';
import { FLOATING_TAB_BAR_CLEARANCE } from '../../theme/layout';

interface ActionButtonsProps {
  colors: ThemeColors;
  /** Color reactivo de vibra de sesión (ver SwipeDeck.tsx) -- usado en el ícono del botón
   *  central en vez de colors.brand. */
  accentColor: string;
  onPass: () => void;
  onLike: () => void;
  onHeard: () => void;
  /** Deshacer el último swipe. */
  onUndo: () => void;
  /** Sin nada que deshacer, el botón se queda pero apagado -- ver la nota del componente. */
  puedeDeshacer: boolean;
}

/**
 * 2026-09-01: rediseño completo a botones circulares solo-ícono (sin texto),
 * siguiendo la referencia de swipe cards estilo Tinder que mandó el usuario:
 * círculos de fondo claro (colors.surface) con el ícono en color, sombra
 * suave, tamaño alternado (pasar/guardar más grandes, escuchada al medio y
 * más chico) -- reemplaza los botones rectangulares con texto de antes.
 * Pasar = X, Guardar = corazón, Ya la escuché = ícono de upload (nunca
 * texto, tal como se pidió).
 */
export function ActionButtons({
  colors,
  accentColor,
  onPass,
  onLike,
  onHeard,
  onUndo,
  puedeDeshacer,
}: ActionButtonsProps) {
  return (
    <View style={styles.row}>
      {/* Deshacer va PRIMERO y es el más chico: es una salida, no una acción del juego, y
          tenerlo al lado de la X evita que la mano tenga que viajar tras un toque
          accidental -- que es justo cuando se necesita.

          Se renderiza SIEMPRE, apagado cuando no hay nada que deshacer, en vez de aparecer y
          desaparecer: montarlo a mitad de partida correría los otros tres botones justo
          debajo del dedo que acaba de swipear. */}
      <Pressable
        onPress={onUndo}
        disabled={!puedeDeshacer}
        accessibilityRole="button"
        accessibilityLabel="Deshacer el último swipe"
        accessibilityState={{ disabled: !puedeDeshacer }}
        style={[
          styles.circle,
          styles.undoCircle,
          { backgroundColor: colors.surface, opacity: puedeDeshacer ? 1 : 0.35 },
        ]}
        hitSlop={8}
      >
        {/* 20 y el 22 de compartir se quedan en crudo: no coinciden con ningun paso de
            `iconSize`, y acercarlos costaria 2 y 4 pixeles visibles en los controles mas usados
            de la app. Eso es una decision de diseno, no una limpieza de escala. */}
        <ArrowUUpLeftIcon weight="bold" size={20} color={colors.textSecondary} />
      </Pressable>

      <Pressable
        onPress={onPass}
        accessibilityRole="button"
        accessibilityLabel="Pasar"
        style={[styles.circle, styles.sideCircle, { backgroundColor: colors.surface }]}
        hitSlop={8}
      >
        <XIcon weight="bold" size={iconSize.xl} color={colors.pass} />
      </Pressable>

      <Pressable
        onPress={onHeard}
        accessibilityRole="button"
        accessibilityLabel="Ya la escuché"
        style={[styles.circle, styles.centerCircle, { backgroundColor: colors.surface }]}
        hitSlop={8}
      >
        <UploadSimpleIcon weight="bold" size={22} color={accentColor} />
      </Pressable>

      <Pressable
        onPress={onLike}
        accessibilityRole="button"
        accessibilityLabel="Guardar"
        style={[styles.circle, styles.sideCircle, { backgroundColor: colors.surface }]}
        hitSlop={8}
      >
        <HeartIcon weight="fill" size={iconSize.xl} color={colors.like} />
      </Pressable>
    </View>
  );
}

/** Ver la nota de floatingTabBarStyle en src/theme/layout.ts: boxShadow reemplaza al cuarteto
 *  shadow* + elevation, deprecado desde RN 0.76. */
const shadow = {
  boxShadow: '0px 3px 6px rgba(0, 0, 0, 0.18)',
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 20,
    // La isla flotante (position: absolute) no reserva su propio espacio en el layout --
    // sin este colchón, estos botones quedaban literalmente tapados detrás de ella.
    paddingBottom: FLOATING_TAB_BAR_CLEARANCE,
    paddingTop: 8,
  },
  circle: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  sideCircle: {
    width: 60,
    height: 60,
  },
  centerCircle: {
    width: 50,
    height: 50,
  },
  undoCircle: {
    width: 44,
    height: 44,
  },
});
