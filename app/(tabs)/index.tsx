import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { SwipeDeck } from '../../src/components/swipe/SwipeDeck';
import { StaticClearingBackground } from '../../src/components/backgrounds/StaticClearingBackground';
import { SessionFilterSheet } from '../../src/components/session/SessionFilterSheet';
import { OnboardingFlow, OnboardingResult } from '../../src/components/onboarding/OnboardingFlow';
import { useThemeStore } from '../../src/theme/useThemeStore';
import { useSwipeStore } from '../../src/state/swipeStore';
import { useSessionFilterStore } from '../../src/state/sessionFilterStore';
import { useAuthStore } from '../../src/state/authStore';
import { useTasteStateStore } from '../../src/state/tasteStateStore';
import { CANONICAL_GENRES } from '../../src/lib/genres';
import { VIBES } from '../../src/lib/vibes';
import { curatedAnchorsByGenre } from '../../src/api/curatedSeeds';
import { hasCompletedOnboarding, submitOnboarding } from '../../src/api/onboardingClient';
import { ProfileButton } from '../../src/components/ui/ProfileButton';
import { fonts } from '../../src/theme/typography';
import { floatingTabBarStyle } from '../../src/theme/layout';
import { useSessionTreeConsolidation } from '../../src/hooks/useSessionTreeConsolidation';

export default function SwipeScreen() {
  useSessionTreeConsolidation();
  const colors = useThemeStore((s) => s.colors);
  const mode = useThemeStore((s) => s.mode);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const navigation = useNavigation();
  const userId = useAuthStore((s) => s.session?.user.id);
  const resolvedThisSession = useSessionFilterStore((s) => s.resolvedThisSession);
  const genre = useSessionFilterStore((s) => s.genre);
  const vibe = useSessionFilterStore((s) => s.vibe);
  const setGenre = useSessionFilterStore((s) => s.setGenre);
  const setVibe = useSessionFilterStore((s) => s.setVibe);
  const resolveSession = useSessionFilterStore((s) => s.resolveSession);
  const reanchor = useSwipeStore((s) => s.reanchor);
  const clearAnchor = useSwipeStore((s) => s.clearAnchor);
  const seedFromOnboardingAnswers = useTasteStateStore((s) => s.seedFromOnboardingAnswers);
  const queryClient = useQueryClient();

  const onboardingQuery = useQuery({
    queryKey: ['onboarding-complete', userId],
    queryFn: () => hasCompletedOnboarding(userId!),
    enabled: !!userId,
    staleTime: Infinity,
  });

  // Antes de este fix (2026-09-06), la isla flotante de pestañas seguía visible durante el
  // onboarding y el selector de sesión -- ninguno de los dos es saltable, así que mostrar
  // navegación a otras pestañas ahí no tiene sentido de producto, tocable o no. Hook antes de
  // cualquier return temprano (regla de hooks), por eso vive acá y no más abajo.
  const showingGate = (!!userId && (onboardingQuery.isLoading || onboardingQuery.data === false)) || !resolvedThisSession;
  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: showingGate ? { display: 'none' } : floatingTabBarStyle(colors.surface),
    });
  }, [showingGate, colors.surface, navigation]);

  // Sin userId (falló el sign-in anónimo, sin red) no hay nada mejor que
  // dejar pasar directo al deck normal -- bloquear la app entera por esto
  // sería peor que perderse el onboarding.
  if (userId && onboardingQuery.isLoading) {
    // Misma estática que la carga del deck (ver SwipeDeck): esta pantalla es literalmente lo
    // primero que se ve al abrir la app, y era un spinner pelado sobre fondo plano. Un loader
    // genérico acá y una estática de marca dos segundos después se sentían como dos apps
    // distintas.
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
          <StaticClearingBackground width={screenWidth} height={screenHeight} mode={mode} />
        </View>
      </View>
    );
  }

  if (userId && onboardingQuery.data === false) {
    return (
      <OnboardingFlow
        colors={colors}
        // Siembra el motor apenas hay respuestas, ANTES de los 8 swipes iniciales -- así el
        // primer deck ya refleja lo que la persona eligió (ver startSwipes en OnboardingFlow).
        onAnswersReady={(result: OnboardingResult) =>
          seedFromOnboardingAnswers(result.referenceArtists, result.favoriteGenres, result.preferredVibe)
        }
        onComplete={(result: OnboardingResult) => {
          submitOnboarding(userId, result).catch(() => {});
          queryClient.setQueryData(['onboarding-complete', userId], true);
          clearAnchor();
        }}
      />
    );
  }

  if (!resolvedThisSession) {
    return (
      <SessionFilterSheet
        colors={colors}
        onDone={(pickedGenre, pickedVibe) => {
          resolveSession(pickedGenre, pickedVibe);
          if (pickedGenre) {
            reanchor(curatedAnchorsByGenre[pickedGenre]);
          } else {
            clearAnchor();
          }
        }}
      />
    );
  }

  const genreDef = genre ? CANONICAL_GENRES.find((g) => g.key === genre) : null;
  const vibeDef = vibe ? VIBES.find((v) => v.key === vibe) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerSide} />
        {/* Placeholder de texto -- reemplazar por el isotipo real de Showmi en cuanto
         *  exista el archivo (ver conversación, pendiente de que el usuario lo mande
         *  como archivo -- no se puede extraer de una imagen pegada en el chat). */}
        <Text style={[styles.wordmark, { color: colors.textPrimary }]}>SHOWMI</Text>
        <View style={[styles.headerSide, styles.headerSideRight]}>
          <ProfileButton colors={colors} />
        </View>
      </View>

      {(genreDef || vibeDef) && (
        <View style={styles.filterRow}>
          {genreDef && (
            <Pressable
              onPress={() => {
                setGenre(null);
                clearAnchor();
              }}
              style={[styles.filterChip, { backgroundColor: colors.surface }]}
              hitSlop={6}
            >
              <Text style={[styles.filterChipText, { color: colors.textPrimary }]}>
                {genreDef.emoji} {genreDef.label} ✕
              </Text>
            </Pressable>
          )}
          {vibeDef && (
            <Pressable onPress={() => setVibe(null)} style={[styles.filterChip, { backgroundColor: colors.surface }]} hitSlop={6}>
              <Text style={[styles.filterChipText, { color: colors.textPrimary }]}>
                {vibeDef.emoji} {vibeDef.label} ✕
              </Text>
            </Pressable>
          )}
        </View>
      )}

      <SwipeDeck vibe={vibe} genre={genre} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 2026-09-01: reemplaza el ProfileButton absoluto de antes, que flotaba ENCIMA de la
  // tarjeta activa -- justo lo que se pidió corregir ("los botones superiores no
  // interceden con las tarjetas"). Ahora es una fila normal, con su propio espacio,
  // así el mazo de abajo arranca recién después de que termina el header.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerSide: {
    width: 32,
  },
  headerSideRight: {
    alignItems: 'flex-end',
  },
  wordmark: {
    fontSize: 18,
    fontFamily: fonts.display,
    letterSpacing: 1,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  filterChip: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipText: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
  },
});
