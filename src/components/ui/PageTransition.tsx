import { ReactNode, useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '../../hooks/useReducedMotion';

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
    progress.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
  }, [reducedMotion, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 14 }],
  }));

  return <Animated.View style={[{ flex: 1 }, animatedStyle, style]}>{children}</Animated.View>;
}
