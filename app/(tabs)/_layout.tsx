import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { CardsIcon, DiscIcon, NewspaperIcon } from 'phosphor-react-native';

import { useThemeStore } from '../../src/theme/useThemeStore';
import { floatingTabBarStyle } from '../../src/theme/layout';
import { ShowmiTabBar } from '../../src/components/ui/ShowmiTabBar';

// Naranja del wordmark (letra "O"), elegido por ser el que menos se confunde
// con el verde/coral del swipe y el ámbar de marca -- exclusivo del ícono de
// pestaña activa, no reutilizado en ningún otro lado de la UI.
const ACTIVE_TAB_COLOR = '#F97316';

// react-navigation types tabBarIcon's color as ColorValue (which allows
// platform OpaqueColorValue), but every color we ever pass here is a plain
// hex string -- Phosphor's icons only accept string, hence the cast.
//
// 2026-08-31: VinylRecord/Newspaper (weight fill) se veían recargados a
// 24px, se cambiaron a Disc/RssSimple.
//
// 2026-09-01: weight "fill" -> "regular" (solo línea, sin relleno) y se
// quitó la etiqueta de texto bajo cada ícono -- referencia mandada por el
// usuario (barra tipo Reels: 3-5 íconos de línea simple, sin texto). Tamaño
// subido de 24 a 26 para compensar que ya no hay texto debajo sosteniendo
// el peso visual de la barra.
//
// Mismo día: RssSimple volvió a Newspaper -- el usuario pidió específicamente
// algo con forma de periódico para Feed. Con weight "regular" (línea, no
// relleno) ya no tiene el problema original de verse recargado -- ese
// problema era del weight "fill", no del ícono en sí.
function LibraryTabIcon({ color }: { color: ColorValue }) {
  return <DiscIcon weight="regular" size={24} color={color as string} />;
}
function SwipeTabIcon({ color }: { color: ColorValue }) {
  return <CardsIcon weight="regular" size={24} color={color as string} />;
}
function FeedTabIcon({ color }: { color: ColorValue }) {
  return <NewspaperIcon weight="regular" size={24} color={color as string} />;
}

export default function TabsLayout() {
  const colors = useThemeStore((s) => s.colors);

  return (
    <Tabs
      // Barra propia: la muesca cóncava sobre la pestaña activa no se puede hacer con
      // borderRadius, hay que recortar la silueta (ver ShowmiTabBar). `tabBarStyle` se sigue
      // pasando porque app/(tabs)/index.tsx lo usa para OCULTAR la barra durante el onboarding,
      // y ShowmiTabBar lo lee para eso.
      tabBar={(props) => <ShowmiTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_TAB_COLOR,
        tabBarInactiveTintColor: colors.textSecondary,
        // 2026-09-01: "isla flotante" -- position absolute + separada de los 3 bordes
        // (antes iba pegada, de borde a borde, con una línea dura arriba). Sombra suave
        // en vez de borderTopColor para separarla del contenido: es lo que se pidió
        // como "bordes menos marcados y agresivos". El fondo sigue siendo colors.surface
        // (ya es un color propio de la paleta de la app, no uno ajeno) para que se lea
        // como una tarjeta flotando sobre colors.background, no como un color aparte.
        // Altura y margen bajados (64->52, 24->16) -- la primera versión ocupaba más
        // espacio del necesario para 3 íconos solos, sin texto (feedback del usuario).
        tabBarStyle: floatingTabBarStyle(colors.surface),
      }}
    >
      <Tabs.Screen name="library" options={{ title: 'Biblioteca', tabBarIcon: LibraryTabIcon }} />
      <Tabs.Screen name="index" options={{ title: 'Swipe', tabBarIcon: SwipeTabIcon }} />
      <Tabs.Screen name="feed" options={{ title: 'Feed', tabBarIcon: FeedTabIcon }} />
    </Tabs>
  );
}
