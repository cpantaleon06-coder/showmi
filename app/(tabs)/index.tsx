import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { SwipeDeck } from '../../src/components/swipe/SwipeDeck';
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

export default function SwipeScreen() {
  const colors = useThemeStore((s) => s.colors);
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

  // Sin userId (falló el sign-in anónimo, sin red) no hay nada mejor que
  // dejar pasar directo al deck normal -- bloquear la app entera por esto
  // sería peor que perderse el onboarding.
  if (userId && onboardingQuery.isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  }

  if (userId && onboardingQuery.data === false) {
    return (
      <OnboardingFlow
        colors={colors}
        onComplete={(result: OnboardingResult) => {
          seedFromOnboardingAnswers(result.referenceArtists, result.favoriteGenres);
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
      {(genreDef || vibeDef) && (
        <View style={styles.filterRow}>
          {genreDef && (
            <Pressable
              onPress={() => {
                setGenre(null);
                clearAnchor();
              }}
              style={[styles.filterChip, { borderColor: colors.border }]}
              hitSlop={6}
            >
              <Text style={[styles.filterChipText, { color: colors.textPrimary }]}>
                {genreDef.emoji} {genreDef.label} ✕
              </Text>
            </Pressable>
          )}
          {vibeDef && (
            <Pressable onPress={() => setVibe(null)} style={[styles.filterChip, { borderColor: colors.border }]} hitSlop={6}>
              <Text style={[styles.filterChipText, { color: colors.textPrimary }]}>
                {vibeDef.emoji} {vibeDef.label} ✕
              </Text>
            </Pressable>
          )}
        </View>
      )}

      <SwipeDeck vibe={vibe} />
      <ProfileButton colors={colors} style={styles.floating} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floating: {
    position: 'absolute',
    top: 12,
    right: 20,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  filterChip: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipText: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
  },
});
