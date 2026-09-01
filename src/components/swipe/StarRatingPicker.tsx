import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StarIcon } from 'phosphor-react-native';

import { Track } from '../../api/types';
import { ThemeColors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import { StarRating } from '../../state/postStore';

interface StarRatingPickerProps {
  colors: ThemeColors;
  track: Track;
  onRate: (rating: StarRating) => void;
  onDismiss: () => void;
}

const RATINGS: StarRating[] = [1, 2, 3, 4, 5];

/**
 * "Selector rápido, no modal de texto": un toque sobre una estrella califica y cierra --
 * nada de formulario, para no romper el ritmo del swipe. La reseña de texto (opcional) se
 * agrega después, desde el post ya creado en Feed.
 */
export function StarRatingPicker({ colors, track, onRate, onDismiss }: StarRatingPickerProps) {
  return (
    <View style={styles.backdrop}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.textPrimary }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
          ¿Cómo te fue con esta canción?
        </Text>

        <View style={styles.stars}>
          {RATINGS.map((value) => (
            <Pressable key={value} onPress={() => onRate(value)} hitSlop={6} style={styles.starButton}>
              <StarIcon weight="fill" size={34} color={colors.brand} />
            </Pressable>
          ))}
        </View>

        <Pressable onPress={onDismiss} hitSlop={8}>
          <Text style={[styles.dismiss, { color: colors.textSecondary }]}>Cancelar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    pointerEvents: 'box-none',
  },
  card: {
    borderWidth: 3,
    borderRadius: 10,
    paddingVertical: 24,
    paddingHorizontal: 28,
    alignItems: 'center',
    gap: 4,
    width: '82%',
  },
  title: {
    fontSize: 16,
    fontFamily: fonts.display,
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 16,
    fontFamily: fonts.bodyRegular,
  },
  stars: {
    flexDirection: 'row',
    gap: 10,
  },
  starButton: {
    padding: 4,
  },
  dismiss: {
    marginTop: 18,
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
  },
});
