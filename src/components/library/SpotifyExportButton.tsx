import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ArrowSquareOutIcon,
  CheckCircleIcon,
  SpotifyLogoIcon,
  WarningIcon,
} from 'phosphor-react-native';

import { Track } from '../../api/types';
import { useSpotifyExport } from '../../hooks/useSpotifyExport';
import { ThemeColors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import { radii } from '../../theme/radii';

/** Verde de Spotify. Color de marca ajeno, fijo en los dos temas -- es su identidad, no la nuestra. */
const SPOTIFY_GREEN = '#1DB954';

interface SpotifyExportButtonProps {
  colors: ThemeColors;
  collectionName: string;
  tracks: Track[];
}

/**
 * Botón "Exportar a Spotify" + su modal de progreso. Toda la lógica (OAuth PKCE, resolución de
 * canciones, creación de la playlist) vive en useSpotifyExport; acá solo se traduce la máquina
 * de estados a algo que se mira.
 *
 * No se renderiza si la función no está disponible (falta EXPO_PUBLIC_SPOTIFY_CLIENT_ID en la
 * build) o si la colección está vacía -- exportar cero canciones no tiene sentido.
 */
export function SpotifyExportButton({ colors, collectionName, tracks }: SpotifyExportButtonProps) {
  const { available, ready, status, result, error, start, reset } = useSpotifyExport();

  if (!available || tracks.length === 0) return null;

  const enProgreso =
    status === 'authorizing' || status === 'resolviendo' || status === 'creando' || status === 'agregando';
  const modalVisible = enProgreso || status === 'done' || status === 'error' || status === 'nomatches';

  const onPress = () => {
    start(
      `Showmi · ${collectionName}`,
      'Exportada desde Showmi',
      tracks.map((t) => ({ artist: t.artist, title: t.title })),
    );
  };

  return (
    <>
      <Pressable
        onPress={onPress}
        disabled={!ready || enProgreso}
        style={[styles.button, { backgroundColor: SPOTIFY_GREEN, opacity: !ready ? 0.5 : 1 }]}
        hitSlop={6}
      >
        <SpotifyLogoIcon weight="fill" size={18} color="#FFFFFF" />
        <Text style={styles.buttonText}>Exportar a Spotify</Text>
      </Pressable>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={reset}>
        <View style={styles.backdrop}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {enProgreso && (
              <>
                <ActivityIndicator color={SPOTIFY_GREEN} size="large" />
                <Text style={[styles.title, { color: colors.textPrimary }]}>{PROGRESS_COPY[status]}</Text>
                <Text style={[styles.sub, { color: colors.textSecondary }]}>No cierres la app</Text>
              </>
            )}

            {status === 'done' && result && (
              <>
                <CheckCircleIcon weight="fill" size={44} color={SPOTIFY_GREEN} />
                <Text style={[styles.title, { color: colors.textPrimary }]}>Playlist creada</Text>
                <Text style={[styles.sub, { color: colors.textSecondary }]}>
                  {result.matched === result.total
                    ? `Las ${result.total} canciones se agregaron.`
                    : `${result.matched} de ${result.total} se encontraron en Spotify.`}
                </Text>
                <Pressable
                  onPress={() => Linking.openURL(result.playlistUrl)}
                  style={[styles.primary, { backgroundColor: SPOTIFY_GREEN }]}
                >
                  <ArrowSquareOutIcon weight="bold" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryText}>Abrir en Spotify</Text>
                </Pressable>
                <Pressable onPress={reset} hitSlop={8}>
                  <Text style={[styles.dismiss, { color: colors.textSecondary }]}>Cerrar</Text>
                </Pressable>
              </>
            )}

            {status === 'nomatches' && (
              <>
                <WarningIcon weight="fill" size={44} color={colors.textSecondary} />
                <Text style={[styles.title, { color: colors.textPrimary }]}>Nada que exportar</Text>
                <Text style={[styles.sub, { color: colors.textSecondary }]}>
                  Ninguna de estas canciones se encontró en Spotify.
                </Text>
                <Pressable onPress={reset} hitSlop={8}>
                  <Text style={[styles.dismiss, { color: colors.textSecondary }]}>Cerrar</Text>
                </Pressable>
              </>
            )}

            {status === 'error' && (
              <>
                <WarningIcon weight="fill" size={44} color={colors.like} />
                <Text style={[styles.title, { color: colors.textPrimary }]}>No se pudo exportar</Text>
                <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={3}>
                  {error ?? 'Intenta de nuevo.'}
                </Text>
                <Pressable onPress={reset} hitSlop={8}>
                  <Text style={[styles.dismiss, { color: colors.textSecondary }]}>Cerrar</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const PROGRESS_COPY: Record<string, string> = {
  authorizing: 'Conectando con Spotify…',
  resolviendo: 'Buscando tus canciones…',
  creando: 'Creando la playlist…',
  agregando: 'Agregando canciones…',
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontFamily: fonts.bodyBold },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radii.card,
    borderWidth: 1,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 12,
  },
  title: { fontSize: 18, fontFamily: fonts.display, textAlign: 'center' },
  sub: { fontSize: 13, fontFamily: fonts.bodyRegular, textAlign: 'center', lineHeight: 19 },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 12,
    marginTop: 6,
  },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontFamily: fonts.bodyBold },
  dismiss: { fontSize: 13, fontFamily: fonts.bodySemiBold, marginTop: 2 },
});
