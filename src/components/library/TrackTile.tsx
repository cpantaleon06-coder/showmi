import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { XIcon } from 'phosphor-react-native';

import { Track } from '../../api/types';
import { resolveSpotifyTrackLink } from '../../api/spotify';
import { ThemeColors } from '../../theme/colors';
import { TILE_SURFACE, TILE_TEXT_MUTED } from '../../theme/collectionColors';
import { radii } from '../../theme/radii';
import { conResorte, resortes } from '../../theme/motion';
import { fonts } from '../../theme/typography';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export type TileVariant = 'wide' | 'small' | 'tall';

interface TrackTileProps {
  track: Track;
  colors: ThemeColors;
  variant: TileVariant;
  /** Contorno de la teja -- color del género, o del wordmark por posición (ver
   *  getTileAccent en theme/collectionColors.ts). */
  accent: string;
  onRemove: () => void;
}

/**
 * Módulo del mosaico de Biblioteca.
 *
 * 2026-09-12, rediseño maximalista (referencias mandadas por el usuario: app de museo con
 * tarjetas negras sobre UI clara, y app de música con mosaico de contornos de color). Tres
 * cosas cambian respecto de la versión anterior, que era una teja gris con el título debajo:
 *
 *  1. La teja es NEGRA en los dos temas (TILE_SURFACE) y no `colors.surface`. Es lo que hace
 *     que el contorno de color y la portada saturada tengan contra qué recortarse -- sobre el
 *     ivory del tema claro, el amarillo y el verde del wordmark se lavaban hasta desaparecer.
 *  2. El contorno lleva el color del GÉNERO, así que el mosaico dice algo cierto sobre lo que
 *     guardaste en vez de repetir el mismo borde 40 veces.
 *  3. El título va ENCIMA de la portada, en una banda negra al pie, tipografía display, no en
 *     un bloque de metadatos debajo. Eso convierte cada teja en un cartel, que es lo que pedía
 *     la referencia, y de paso le devuelve a la portada el alto que le comía el pie.
 *
 * Tres tamaños (antes dos): `wide` abre cada bloque ocupando la fila entera, y `tall`/`small`
 * se emparejan en una fila desigual (ver buildTileRows en library.tsx). El par desigual es lo
 * que evita que la mitad inferior de la pantalla vuelva a ser una cuadrícula regular.
 */
export function TrackTile({ track, colors, variant, accent, onRemove }: TrackTileProps) {
  const [isOpening, setIsOpening] = useState(false);
  const reducedMotion = useReducedMotion();
  const pressed = useSharedValue(0);
  const isWide = variant === 'wide';

  const openInSpotify = async () => {
    setIsOpening(true);
    try {
      const link = await resolveSpotifyTrackLink(track.artist, track.title);
      // Se intenta primero el deep link de la app y se cae a la página web si Spotify no
      // está instalado (o si no hubo match confiable, en cuyo caso webUrl ya es una
      // búsqueda y no un track exacto).
      if (link.appUri) {
        try {
          await Linking.openURL(link.appUri);
          return;
        } catch {
          // sin app de Spotify que atienda spotify:track:... -- sigue al fallback web
        }
      }
      await Linking.openURL(link.webUrl);
    } finally {
      setIsOpening(false);
    }
  };

  // Hundido al tocar. En un mosaico sin sombras ni relieve, el único acuse de recibo posible
  // es que la teja se mueva -- sin esto, tocar y esperar a que Spotify resuelva el link se
  // siente como que la app se colgó.
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.03 }],
  }));

  const setPressed = (value: number) => {
    pressed.value = conResorte(value, reducedMotion, resortes.ui);
  };

  return (
    // El contenedor es un View y NO un Pressable, y el botón de quitar es HERMANO del
    // pressable de la teja, no hijo: anidarlo dentro daba un <button> dentro de otro
    // <button> en web (react-native-web renderiza Pressable como <button>), que es HTML
    // inválido -- salió como error real en consola al probarlo.
    <Animated.View
      style={[
        styles.tile,
        variant === 'wide' ? styles.tileWide : variant === 'tall' ? styles.tileTall : styles.tileSmall,
        { backgroundColor: TILE_SURFACE },
        pressStyle,
      ]}
    >
      <Pressable
        onPress={openInSpotify}
        onPressIn={() => setPressed(1)}
        onPressOut={() => setPressed(0)}
        disabled={isOpening}
        accessibilityRole="button"
        accessibilityLabel={`Abrir ${track.title} de ${track.artist} en Spotify`}
      >
        <View style={[styles.artworkWrap, isWide ? styles.artworkWide : styles.artworkSquare]}>
          <Image source={{ uri: track.artworkUrl }} style={styles.artwork} contentFit="cover" transition={150} />
          {isOpening && (
            <View style={styles.artworkOverlay}>
              <ActivityIndicator color="#FFFFFF" size="small" />
            </View>
          )}
        </View>

        {/* Banda al pie, encima de la portada. Negra opaca y no semitransparente: la portada
            de abajo puede ser de cualquier color y un velo dejaría títulos ilegibles sobre las
            claras. */}
        <View style={styles.caption}>
          <Text style={[styles.title, isWide && styles.titleWide]} numberOfLines={isWide ? 2 : 1}>
            {track.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {track.artist}
          </Text>
        </View>
      </Pressable>

      {/* Quitar: círculo NEGRO con el borde y el aspa del color de la teja, no relleno de
          color. Se probó relleno sólido primero y en una pantalla con quince tejas eran quince
          círculos saturados peleándole el ojo a las portadas -- justo el ruido que separa
          "maximalista" de "cargado". En negro sigue viéndose sobre cualquier portada (es el
          mismo negro de la teja, así que lee como un recorte) sin encabezar la composición. */}
      <Pressable
        onPress={onRemove}
        hitSlop={10}
        style={[styles.removeButton, { backgroundColor: TILE_SURFACE }]}
        accessibilityRole="button"
        accessibilityLabel={`Quitar ${track.title} de esta colección`}
      >
        <XIcon weight="bold" size={11} color={accent} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    // 2.5 y no 2: el contorno de color es un elemento del diseño acá, no una línea de
    // separación -- tiene que leerse como el marco de un cartel.
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  /** Ocupa la fila completa por sí solo. */
  tileWide: {
    width: '100%',
  },
  /**
   * La teja SIEMPRE llena el ancho que le dan; el reparto desigual de la pareja (1.35 contra
   * 1) lo decide el wrapper de la fila, no ella.
   *
   * Esto estuvo mal en la primera pasada y se vio en vivo: el `flex` vivía acá adentro, pero
   * el hijo directo de la fila es el wrapper de la animación de entrada, así que la fila
   * repartía el ancho entre DOS wrappers iguales y el flex interno solo estiraba la teja
   * dentro de su mitad. Las parejas salían simétricas y el mosaico volvía a ser cuadrícula.
   */
  tileTall: {
    width: '100%',
  },
  tileSmall: {
    width: '100%',
  },
  artworkWrap: {
    width: '100%',
  },
  artworkWide: {
    aspectRatio: 16 / 9,
  },
  artworkSquare: {
    aspectRatio: 1,
  },
  artwork: {
    width: '100%',
    height: '100%',
  },
  artworkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    backgroundColor: TILE_SURFACE,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 1,
  },
  title: {
    fontSize: 13,
    color: '#FFFFFF',
    fontFamily: fonts.display,
    letterSpacing: -0.3,
  },
  titleWide: {
    fontSize: 19,
    letterSpacing: -0.6,
  },
  artist: {
    fontSize: 11,
    color: TILE_TEXT_MUTED,
    fontFamily: fonts.bodySemiBold,
  },
});
