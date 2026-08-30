import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';

import { Track } from '../../api/types';
import { resolveSpotifyTrackLink } from '../../api/spotify';
import { ThemeColors } from '../../theme/colors';
import { fonts } from '../../theme/typography';

interface TrackRowProps {
  track: Track;
  colors: ThemeColors;
  onRemove: () => void;
}

export function TrackRow({ track, colors, onRemove }: TrackRowProps) {
  const [isOpening, setIsOpening] = useState(false);

  const openInSpotify = async () => {
    setIsOpening(true);
    try {
      const link = await resolveSpotifyTrackLink(track.artist, track.title);
      // Try the app deep link first, fall back to the web page if Spotify
      // isn't installed (or there's no confident match, in which case
      // webUrl is already a search page rather than an exact track).
      if (link.appUri) {
        try {
          await Linking.openURL(link.appUri);
          return;
        } catch {
          // no Spotify app installed to handle spotify:track:... -- fall through
        }
      }
      await Linking.openURL(link.webUrl);
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Image source={{ uri: track.artworkUrl }} style={styles.artwork} contentFit="cover" />
      <View style={styles.info}>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={[styles.artist, { color: colors.textSecondary }]} numberOfLines={1}>
          {track.artist}
        </Text>
      </View>

      <Pressable onPress={openInSpotify} disabled={isOpening} hitSlop={8} style={styles.action}>
        {isOpening ? (
          <ActivityIndicator color={colors.brand} size="small" />
        ) : (
          <Text style={[styles.spotify, { color: colors.brand }]}>Abrir en Spotify</Text>
        )}
      </Pressable>

      <Pressable onPress={onRemove} hitSlop={8} style={styles.action}>
        <Text style={[styles.remove, { color: colors.textSecondary }]}>Quitar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  artwork: {
    width: 48,
    height: 48,
    borderRadius: 6,
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontFamily: fonts.bodySemiBold,
  },
  artist: {
    fontSize: 13,
    marginTop: 2,
    fontFamily: fonts.bodyRegular,
  },
  action: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
  spotify: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
  },
  remove: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
  },
});
