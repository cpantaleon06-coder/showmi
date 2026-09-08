import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { XIcon } from 'phosphor-react-native';

import { Track } from '../../api/types';
import { resolveSpotifyTrackLink } from '../../api/spotify';
import { ThemeColors } from '../../theme/colors';
import { radii } from '../../theme/radii';
import { fonts } from '../../theme/typography';

export type TileVariant = 'wide' | 'small';

interface TrackTileProps {
  track: Track;
  colors: ThemeColors;
  variant: TileVariant;
  onRemove: () => void;
}

/**
 * Módulo de la rejilla de Biblioteca -- reemplaza a TrackRow (la fila de lista que había
 * antes, eliminada: esta pantalla era su único consumidor).
 *
 * Dos tamaños, no uno: es lo que hace que la rejilla sea MODULAR y no una galería
 * uniforme. El `wide` abre cada bloque de cinco con la portada en 16:9 y el `small` va
 * en pares cuadrados -- ver buildTileRows en library.tsx para el ritmo.
 *
 * Interacción: la teja entera abre en Spotify (en una rejilla, la portada es el blanco
 * obvio) y quitar vive en un botón chico sobre la esquina. En la fila anterior las dos
 * acciones eran texto ("Abrir en Spotify" / "Quitar"), que en una teja de media pantalla
 * no cabe sin romperse en dos líneas.
 */
export function TrackTile({ track, colors, variant, onRemove }: TrackTileProps) {
  const [isOpening, setIsOpening] = useState(false);
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

  return (
    // El contenedor es un View y NO un Pressable, y el botón de quitar es HERMANO del
    // pressable de la teja, no hijo: anidarlo dentro daba un <button> dentro de otro
    // <button> en web (react-native-web renderiza Pressable como <button>), que es HTML
    // inválido -- salió como error real en consola al probarlo.
    <View
      style={[
        styles.tile,
        isWide ? styles.tileWide : styles.tileSmall,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Pressable
        onPress={openInSpotify}
        disabled={isOpening}
        accessibilityRole="button"
        accessibilityLabel={`Abrir ${track.title} de ${track.artist} en Spotify`}
      >
        <View style={[styles.artworkWrap, isWide ? styles.artworkWide : styles.artworkSmall]}>
          <Image source={{ uri: track.artworkUrl }} style={styles.artwork} contentFit="cover" transition={150} />
          {isOpening && (
            <View style={styles.artworkOverlay}>
              <ActivityIndicator color="#FFFFFF" size="small" />
            </View>
          )}
        </View>

        <View style={styles.meta}>
          <Text
            style={[styles.title, isWide && styles.titleWide, { color: colors.textPrimary }]}
            numberOfLines={isWide ? 2 : 1}
          >
            {track.title}
          </Text>
          <Text style={[styles.artist, { color: colors.textSecondary }]} numberOfLines={1}>
            {track.artist}
          </Text>
        </View>
      </Pressable>

      <Pressable
        onPress={onRemove}
        hitSlop={10}
        style={[styles.removeButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
        accessibilityRole="button"
        accessibilityLabel={`Quitar ${track.title} de esta colección`}
      >
        <XIcon weight="bold" size={12} color={colors.textPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderWidth: 2,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  /** Ocupa la fila completa por sí solo. */
  tileWide: {
    width: '100%',
  },
  /** flex:1 y no un ancho fijo: los dos de la pareja se reparten la fila y el `gap` del
   *  contenedor sale del ancho solo, sin que esta teja tenga que saber cuánto mide la
   *  pantalla ni el padding de la lista. */
  tileSmall: {
    flex: 1,
  },
  artworkWrap: {
    width: '100%',
  },
  artworkWide: {
    aspectRatio: 16 / 9,
  },
  artworkSmall: {
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
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  title: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
  },
  titleWide: {
    fontSize: 16,
    fontFamily: fonts.display,
  },
  artist: {
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
  },
});
