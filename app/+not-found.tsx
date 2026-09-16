import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';

import { useThemeStore } from '../src/theme/useThemeStore';
import { fonts } from '../src/theme/typography';
import { radii } from '../src/theme/radii';
import { readableOn } from '../src/theme/contrast';
import { PageTransition } from '../src/components/ui/PageTransition';

/**
 * Pantalla para una ruta que no existe (2026-09-16).
 *
 * Sin este archivo, expo-router enseña su propia pantalla de "Unmatched Route": fondo negro,
 * un icono de documento roto, la URL cruda y enlaces a "Sitemap". Es una herramienta de
 * desarrollo -- está bien mientras se programa y es pésima en manos de alguien que solo tocó un
 * enlace viejo, porque parece que la app se rompió.
 *
 * Hasta ahora no había forma realista de llegar: todas las rutas de la app existían. Se volvió
 * alcanzable al eliminarse el Camerino, porque `showmi://closet` pasó a no resolver -- y un
 * enlace guardado, un acceso directo o una notificación vieja siguen apuntando ahí.
 *
 * No dice "404" ni "ruta no encontrada": un código de estado HTTP no significa nada para quien
 * abre una app de música. Dice lo que pasó y ofrece la única salida útil.
 */
export default function NotFoundScreen() {
  const colors = useThemeStore((s) => s.colors);
  const router = useRouter();

  return (
    <>
      {/* Sin cabecera: el resto de las pantallas empujadas sobre el stack tampoco la tienen, y
          una barra con el título "+not-found" es justo el detalle que delata el andamio. */}
      <Stack.Screen options={{ headerShown: false }} />
      <PageTransition>
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={styles.centro}>
            <Text style={[styles.titulo, { color: colors.textPrimary }]}>Por aquí no hay nada</Text>
            <Text style={[styles.texto, { color: colors.textSecondary }]}>
              El enlace que abriste apunta a una pantalla que ya no existe.
            </Text>

            {/* `replace` y no `push`: se llega acá desde fuera de la app, así que no hay pila a
                la que volver, y apilar el inicio encima de una ruta rota dejaría el gesto de
                "atrás" devolviendo a esta misma pantalla. */}
            <Pressable
              onPress={() => router.replace('/(tabs)')}
              style={[styles.boton, { backgroundColor: colors.brand }]}
            >
              <Text style={[styles.botonTexto, { color: readableOn(colors.brand) }]}>
                Ir al inicio
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </PageTransition>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 },
  titulo: { fontSize: 26, fontFamily: fonts.display, letterSpacing: -0.6, textAlign: 'center' },
  texto: { fontSize: 15, fontFamily: fonts.bodyRegular, textAlign: 'center', lineHeight: 21 },
  boton: {
    marginTop: 18,
    paddingHorizontal: 26,
    paddingVertical: 14,
    borderRadius: radii.pill,
  },
  botonTexto: { fontSize: 15, fontFamily: fonts.bodyBold },
});
