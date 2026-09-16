import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import { ArchivoBlack_400Regular } from '@expo-google-fonts/archivo-black/400Regular';
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';

import { useEffect } from 'react';

import { asyncStoragePersister, queryClient } from '../src/lib/queryClient';
import { useThemeStore } from '../src/theme/useThemeStore';
import { useAuthBootstrap } from '../src/hooks/useAuthBootstrap';
import { useRevenueCatSync } from '../src/hooks/useRevenueCatSync';
import { useAuthStore } from '../src/state/authStore';
import { initializeAds } from '../src/lib/ads';
import { configurarAudio } from '../src/lib/audioSession';

export default function RootLayout() {
  const mode = useThemeStore((s) => s.mode);
  const [fontsLoaded] = useFonts({
    ArchivoBlack_400Regular,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  useAuthBootstrap();
  const authReady = useAuthStore((s) => s.isReady);
  const userId = useAuthStore((s) => s.session?.user.id);
  useRevenueCatSync(userId);
  // No-op en web (ver areAdsSupportedOnThisPlatform en lib/ads.ts) -- seguro llamarlo siempre.
  useEffect(() => {
    initializeAds();
  }, []);

  // La sesión de audio se configura UNA vez, al arrancar. Hasta 2026-09-16 no se configuraba
  // nunca, así que corría con los defaults de expo-audio -- ver src/lib/audioSession.ts para
  // qué implicaba eso y por qué importa.
  useEffect(() => {
    configurarAudio();
  }, []);

  // Nada de texto visible con la fuente del sistema, ni siquiera un parpadeo
  // inicial -- se espera a que carguen antes de montar cualquier pantalla.
  // authReady también bloquea el primer render: sin sesión (ni siquiera
  // anónima) no tiene caso mostrar nada que dependa de auth.uid().
  if (!fontsLoaded || !authReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: asyncStoragePersister, maxAge: 1000 * 60 * 60 * 24 }}
      >
        {/*
          2026-09-07: transiciones nativas explícitas -- antes no se declaraba `animation` en
          ningún lado, así que cada pantalla heredaba el default de la plataforma (razonable
          en iOS, pero inconsistente entre sí y con Android). Perfil/Camerino/editar-onboarding
          se quedan con el push default (ya se leen como "una pantalla más" del flujo, con su
          propio BackButton) -- lo que se agrega es un slide-desde-abajo tipo hoja para auth y
          premium, que son interrupciones puntuales (login, paywall) y no continuaciones del
          flujo, un patrón estándar en apps con paywalls/login modales.

          OJO al probar en el preview web (Browser pane): react-native-screens resuelve su
          ScreenStack a un <View> plano en web (sin animación alguna, confirmado leyendo
          ScreenStack.web.js) -- esto solo se ve en un build nativo real (iOS/Android), no en
          localhost:8081.
        */}
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="auth" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="premium" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        </Stack>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}
