import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { CardsIcon, DiscIcon, RssSimpleIcon } from 'phosphor-react-native';

import { useThemeStore } from '../../src/theme/useThemeStore';

// Naranja del wordmark (letra "O"), elegido por ser el que menos se confunde
// con el verde/coral del swipe y el ámbar de marca -- exclusivo del ícono de
// pestaña activa, no reutilizado en ningún otro lado de la UI.
const ACTIVE_TAB_COLOR = '#F97316';

// react-navigation types tabBarIcon's color as ColorValue (which allows
// platform OpaqueColorValue), but every color we ever pass here is a plain
// hex string -- Phosphor's icons only accept string, hence the cast.
//
// 2026-08-31: cambiados por versiones más simples (menos trazos internos) --
// VinylRecord (surcos) y Newspaper (líneas de texto/pliegue) se veían
// recargados a 24px junto al resto del sistema visual ya simplificado a
// bloques planos; Disc y RssSimple leen igual de claro con mucho menos
// detalle. Cards ya era simple, se mantiene.
//
// 2026-09-01: weight "fill" -> "regular" (solo línea, sin relleno) y se
// quitó la etiqueta de texto bajo cada ícono -- referencia mandada por el
// usuario (barra tipo Reels: 3-5 íconos de línea simple, sin texto). Tamaño
// subido de 24 a 26 para compensar que ya no hay texto debajo sosteniendo
// el peso visual de la barra.
function LibraryTabIcon({ color }: { color: ColorValue }) {
  return <DiscIcon weight="regular" size={26} color={color as string} />;
}
function SwipeTabIcon({ color }: { color: ColorValue }) {
  return <CardsIcon weight="regular" size={26} color={color as string} />;
}
function FeedTabIcon({ color }: { color: ColorValue }) {
  return <RssSimpleIcon weight="regular" size={26} color={color as string} />;
}

export default function TabsLayout() {
  const colors = useThemeStore((s) => s.colors);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: ACTIVE_TAB_COLOR,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen name="library" options={{ title: 'Biblioteca', tabBarIcon: LibraryTabIcon }} />
      <Tabs.Screen name="index" options={{ title: 'Swipe', tabBarIcon: SwipeTabIcon }} />
      <Tabs.Screen name="feed" options={{ title: 'Feed', tabBarIcon: FeedTabIcon }} />
    </Tabs>
  );
}
