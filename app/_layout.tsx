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

import { asyncStoragePersister, queryClient } from '../src/lib/queryClient';
import { useThemeStore } from '../src/theme/useThemeStore';
import { useAuthBootstrap } from '../src/hooks/useAuthBootstrap';
import { useRevenueCatSync } from '../src/hooks/useRevenueCatSync';
import { useAuthStore } from '../src/state/authStore';

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
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}
