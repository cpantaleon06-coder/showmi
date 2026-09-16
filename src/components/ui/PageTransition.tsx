import { ReactNode, useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { useReducedMotion } from '../../hooks/useReducedMotion';
import { conTiempo, duracion } from '../../theme/motion';

interface PageTransitionProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Fade-in + leve subida al montar (14px, 260ms) para las pantallas a las que se navega
 * (Perfil, Camerino, Premium, Auth, editar-onboarding) -- antes aparecían de golpe sin
 * transición propia, dependiendo solo de la animación nativa del stack (que además no
 * corre en el preview web -- ver comentario en app/_layout.tsx). Esto SÍ se ve en web,
 * porque es contenido animado con Reanimated, no la transición del navegador nativo.
 *
 * flex:1 para no romper el layout de quien envuelve (SafeAreaView/View con flex:1 dentro).
 */
export function PageTransition({ children, style }: PageTransitionProps) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) return;
    // 260 -> duracion.base (240) y la curva compartida: la entrada de una pantalla y la de
    // una teja ahora desaceleran igual, que es lo que las hace leer como el mismo sistema.
    progress.value = conTiempo(1, reducedMotion, duracion.base);
  }, [reducedMotion, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 14 }],
  }));

  return <Animated.View style={[{ flex: 1 }, animatedStyle, style]}>{children}</Animated.View>;
}
