import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { CardsIcon, NewspaperIcon, VinylRecordIcon } from 'phosphor-react-native';

import { useThemeStore } from '../../src/theme/useThemeStore';
import { fonts } from '../../src/theme/typography';

// Naranja del wordmark (letra "O"), elegido por ser el que menos se confunde
// con el verde/coral del swipe y el ámbar de marca -- exclusivo del ícono de
// pestaña activa, no reutilizado en ningún otro lado de la UI.
const ACTIVE_TAB_COLOR = '#F97316';

// react-navigation types tabBarIcon's color as ColorValue (which allows
// platform OpaqueColorValue), but every color we ever pass here is a plain
// hex string -- Phosphor's icons only accept string, hence the cast.
function LibraryTabIcon({ color }: { color: ColorValue }) {
  return <VinylRecordIcon weight="fill" size={24} color={color as string} />;
}
function SwipeTabIcon({ color }: { color: ColorValue }) {
  return <CardsIcon weight="fill" size={24} color={color as string} />;
}
function FeedTabIcon({ color }: { color: ColorValue }) {
  return <NewspaperIcon weight="fill" size={24} color={color as string} />;
}

export default function TabsLayout() {
  const colors = useThemeStore((s) => s.colors);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_TAB_COLOR,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontSize: 12, fontFamily: fonts.bodySemiBold },
      }}
    >
      <Tabs.Screen name="library" options={{ title: 'Biblioteca', tabBarIcon: LibraryTabIcon }} />
      <Tabs.Screen name="index" options={{ title: 'Swipe', tabBarIcon: SwipeTabIcon }} />
      <Tabs.Screen name="feed" options={{ title: 'Feed', tabBarIcon: FeedTabIcon }} />
    </Tabs>
  );
}
