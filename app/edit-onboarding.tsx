import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useThemeStore } from '../src/theme/useThemeStore';
import { fonts } from '../src/theme/typography';
import { useAuthStore } from '../src/state/authStore';
import { useTasteStateStore } from '../src/state/tasteStateStore';
import { fetchOnboardingAnswers, submitOnboarding } from '../src/api/onboardingClient';
import { OnboardingFlow, OnboardingResult } from '../src/components/onboarding/OnboardingFlow';
import { goBackOrHome } from '../src/lib/navigation';
import { PageTransition } from '../src/components/ui/PageTransition';

/**
 * Ruta dedicada para el mecanismo de edición confirmado en la sección 1
 * ("botón dedicado que reabre las mismas pantallas en modo edición"):
 * empujada desde el botón "Editar preferencias" en Perfil (app/profile.tsx).
 * Reusa OnboardingFlow tal cual -- son las MISMAS pantallas que el
 * onboarding inicial, no un formulario de edición aparte -- con
 * `editMode`/`initialAnswers` precargando lo que ya tenía guardado.
 */
export default function EditOnboardingScreen() {
  const colors = useThemeStore((s) => s.colors);
  const userId = useAuthStore((s) => s.session?.user.id);
  const seedFromOnboardingAnswers = useTasteStateStore((s) => s.seedFromOnboardingAnswers);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [initialAnswers, setInitialAnswers] = useState<OnboardingResult | undefined>(undefined);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    fetchOnboardingAnswers(userId).then((answers) => {
      if (answers) setInitialAnswers(answers);
      setLoading(false);
    });
  }, [userId]);

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.brandText} size="large" />
      </View>
    );
  }

  return (
    <PageTransition>
      <View style={styles.container}>
        <OnboardingFlow
          colors={colors}
          editMode
          initialAnswers={initialAnswers}
          // En modo edición no hay swipes intermedios, así que OnboardingFlow dispara esto en
          // el mismo "Guardar cambios" -- resiembra el estado local con las respuestas nuevas.
          onAnswersReady={(result: OnboardingResult) =>
            seedFromOnboardingAnswers(result.referenceArtists, result.favoriteGenres, result.preferredVibe)
          }
          onComplete={(result: OnboardingResult) => {
            // Persiste la fila remota (upsert, no bloqueante) -- el sembrado local ya ocurrió
            // en onAnswersReady, ver app/(tabs)/index.tsx para el mismo par de efectos.
            if (userId) submitOnboarding(userId, result).catch(() => {});
            goBackOrHome(router);
          }}
        />
        <SafeAreaView style={styles.cancelWrap} edges={['top']} pointerEvents="box-none">
          <Pressable onPress={() => goBackOrHome(router)} hitSlop={10} style={styles.cancelButton}>
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancelar</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  cancelButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  cancelText: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
  },
});
