import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { ThemeColors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface GradientChipProps {
  colors: ThemeColors;
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Color sólido del fill cuando `selected` -- default `colors.brand` (género, artista, tabs
   *  de Biblioteca). Quien llama pasa un color de `theme/vibeColors.ts` para que un chip de
   *  vibra reaccione con SU propio color en vez del rojo de marca genérico (ver
   *  SessionFilterSheet.tsx/OnboardingFlow.tsx). */
  fillColor?: string;
}

/**
 * 2026-08-31: reemplaza el fill de degradado Nagai por un bloque de color
 * sólido (ver comentario de pivote en theme/colors.ts) -- coherente con el
 * resto del sistema maximalista de bloques planos (SwipeCard/ActionButtons),
 * un degradado de 3 paradas en un chip chico competía visualmente en vez de
 * leerse como señal clara de selección. Mantiene el spring-in (`progress`)
 * y bordes angulares (radius 4, no 18) en vez de pill.
 */
export function GradientChip({ colors, label, selected, onPress, fillColor }: GradientChipProps) {
  const progress = useSharedValue(selected ? 1 : 0);
  const reducedMotion = useReducedMotion();
  const fill = fillColor ?? colors.brand;

  useEffect(() => {
    progress.value = reducedMotion
      ? withTiming(selected ? 1 : 0, { duration: 1 })
      : withSpring(selected ? 1 : 0, { damping: 15, stiffness: 180 });
  }, [selected, progress, reducedMotion]);

  const fillStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.94 + progress.value * 0.06 }],
  }));

  return (
    <Pressable onPress={onPress} style={styles.wrap}>
      <View style={[styles.chip, { borderColor: selected ? fill : colors.textPrimary }]}>
        <Animated.View style={[StyleSheet.absoluteFill, fillStyle, { backgroundColor: fill }]} />
        <Text style={[styles.label, { color: selected ? '#FFFFFF' : colors.textPrimary }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginRight: 8,
  },
  chip: {
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  label: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
  },
});
