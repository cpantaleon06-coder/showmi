import { ReactNode, useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay } from 'react-native-reanimated';

import { useReducedMotion } from '../../hooks/useReducedMotion';
import { conTiempo, duracion, retraso } from '../../theme/motion';

interface TileRevealProps {
  children: ReactNode;
  /** Posición en la rejilla -- define cuánto se retrasa esta teja respecto de la anterior. */
  index: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Entrada escalonada de las tejas del mosaico (2026-09-12).
 *
 * Sube 18px, entra en opacidad y crece de 0.94 a 1. El escalón hace que el mural se ARME a la
 * vista en vez de aparecer entero de golpe, que es lo que separa "colorido" de "colorido y
 * animado".
 *
 * Escrito a mano con useSharedValue y no con las `entering={FadeInDown}` de Reanimated a
 * propósito: las animaciones de entrada declarativas se re-disparan cuando FlatList RECICLA
 * una fila al hacer scroll, así que la rejilla parpadearía cada vez que una teja vuelve a
 * entrar en pantalla. Este efecto corre en el montaje y nada más, que es lo que se quiere.
 *
 * El tope del retraso existe por lo mismo: sin él, la teja número 40 de una biblioteca grande
 * esperaría casi dos segundos para aparecer, y a esa altura ya no es una entrada, es una
 * pantalla que carga lento.
 */
export function TileReveal({ children, index, style }: TileRevealProps) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      progress.value = 1;
      return;
    }
    // El tope del escalonado vive ahora en theme/motion (`retraso`), compartido con
    // cualquier otra lista que lo necesite en vez de re-derivarlo acá.
    progress.value = withDelay(retraso(index), conTiempo(1, reducedMotion, duracion.lenta));
    // `index` fuera de las dependencias a propósito: si la lista se reordena (crear una
    // colección, quitar una canción), re-animar las tejas que YA estaban en pantalla sería
    // ruido. La entrada pertenece al montaje.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 18 }, { scale: 0.94 + progress.value * 0.06 }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
