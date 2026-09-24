import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { ThemeColors } from '../../theme/colors';
import { readableOn } from '../../theme/contrast';
import { fonts } from '../../theme/typography';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { conResorte, resortes } from '../../theme/motion';

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
  /**
   * Color del CONTORNO cuando el chip NO está seleccionado. Por defecto `colors.textPrimary`
   * (el contorno de tinta de siempre).
   *
   * Nace con el rediseño maximalista de Biblioteca (2026-09-12): ahí cada colección tiene su
   * propio color y un chip apagado con borde de tinta rompía la fila de pills de colores que
   * pedía la referencia. Es opcional y con el default de antes a propósito -- los chips de
   * género y vibra (SessionFilterSheet, onboarding) viven en pantallas donde el contorno de
   * tinta es el que corresponde, y no debían cambiar de aspecto por este pedido.
   */
  outlineColor?: string;
}

/**
 * 2026-08-31: reemplaza el fill de degradado Nagai por un bloque de color
 * sólido (ver comentario de pivote en theme/colors.ts) -- coherente con el
 * resto del sistema maximalista de bloques planos (SwipeCard/ActionButtons),
 * un degradado de 3 paradas en un chip chico competía visualmente en vez de
 * leerse como señal clara de selección. Mantiene el spring-in (`progress`).
 *
 * 2026-09-08: bordes angulares -> pill completo (radius 18, antes 10) --
 * pedido explícito de "botones más redondos y amigables", mismo giro que
 * `brand` calmándose y la mascota volviéndose más chibi. Ya no aplica la
 * nota vieja de este comentario que decía "angular a propósito, no pill".
 */
export function GradientChip({ colors, label, selected, onPress, fillColor, outlineColor }: GradientChipProps) {
  const progress = useSharedValue(selected ? 1 : 0);
  const reducedMotion = useReducedMotion();
  const fill = fillColor ?? colors.brand;
  const outline = outlineColor ?? colors.textPrimary;

  useEffect(() => {
    // `resortes.ui`: seleccionar un chip es UI funcional, no un momento de gracia. Antes
    // usaba damping 15 / stiffness 180, que se pasaba de largo y volvía -- un rebote chico
    // pero suficiente para que el chip siguiera moviéndose cuando el ojo ya quería leerlo.
    progress.value = conResorte(selected ? 1 : 0, reducedMotion, resortes.ui);
  }, [selected, progress, reducedMotion]);

  const fillStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.94 + progress.value * 0.06 }],
  }));

  return (
    <Pressable
      onPress={onPress}
      style={styles.wrap}
      // El chip mide unos 32px de alto, por debajo del minimo tactil de 44. Era el unico
      // componente interactivo de la app sin hitSlop: el area util se amplia sin mover un pixel
      // del diseno.
      hitSlop={8}
      accessibilityRole="button"
      // `selected` ya pintaba el relleno, pero no llegaba a accesibilidad: un lector de pantalla
      // anunciaba igual un chip elegido que uno sin elegir.
      accessibilityState={{ selected }}
    >
      {/* backgroundColor opaco (no transparente) desde 2026-09-08: sobre las pantallas
          con fondo de patrón (ver components/backgrounds/), un chip transparente dejaba
          pasar las franjas por DETRÁS de su propia etiqueta. Se usa `background`, no
          `surface`, justamente para que en las pantallas sin patrón el chip siga
          viéndose idéntico a antes -- es del mismo color que la página. */}
      {/* Sin contorno (2026-09-16): el chip apagado se sostiene con RELLENO de `surface`, que
          contrasta con `background` en los dos temas. Antes era del color de la pagina mas un
          borde; quitandole el borde sin darle relleno habria desaparecido. */}
      <View style={[styles.chip, { backgroundColor: colors.surface }]}>
        <Animated.View style={[StyleSheet.absoluteFill, fillStyle, { backgroundColor: fill }]} />
        {/* El color del texto encendido se MIDE contra el relleno (ver theme/contrast.ts), no
            es blanco fijo: desde que cada colección de Biblioteca trae su propio color del
            wordmark, blanco sobre el amarillo `#F9EB06` daba 1.07:1 -- invisible. */}
        <Text style={[styles.label, { color: selected ? readableOn(fill) : colors.textPrimary }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginRight: 8,
  },
  chip: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  label: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
  },
});
