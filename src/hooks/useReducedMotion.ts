import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * "Movimiento reducido si el sistema lo pide" -- no opcional aunque no se
 * vea en una captura estática. Usado por cualquier animación de Reanimated
 * (spring del swipe, spring del GradientChip) para saltarse/acortar el
 * movimiento cuando el usuario activó esta preferencia de accesibilidad.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => subscription.remove();
  }, []);

  return reduced;
}
