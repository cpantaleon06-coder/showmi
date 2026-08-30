import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { ThemeColors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface GradientChipProps {
  colors: ThemeColors;
  label: string;
  selected: boolean;
  onPress: () => void;
}

/**
 * The other reserved spot for the Nagai gradient: a chip's *selected* state
 * (active Biblioteca collection today; chosen Camerino genre / vibe chip
 * once those screens exist) gets the gradient fill instead of a flat brand
 * color, with a spring-in transition rather than an instant swap.
 */
export function GradientChip({ colors, label, selected, onPress }: GradientChipProps) {
  const progress = useSharedValue(selected ? 1 : 0);
  const reducedMotion = useReducedMotion();

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
      <View style={[styles.chip, { borderColor: selected ? 'transparent' : colors.border }]}>
        <Animated.View style={[StyleSheet.absoluteFill, fillStyle]}>
          <LinearGradient colors={colors.nagaiGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          {/* Flat dark scrim, not a shadow: keeps white text readable across
              every stop of the gradient (amber alone fails contrast with
              white ~2.3:1) without relying on a single flat brand color. */}
          <View style={[StyleSheet.absoluteFill, styles.scrim]} />
        </Animated.View>
        <Text style={[styles.label, { color: selected ? '#FFFFFF' : colors.textSecondary }]}>{label}</Text>
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
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  label: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
  },
  scrim: {
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
});
