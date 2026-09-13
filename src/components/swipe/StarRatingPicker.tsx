import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StarIcon } from 'phosphor-react-native';

import { Track } from '../../api/types';
import { ThemeColors } from '../../theme/colors';
import { readableOn } from '../../theme/contrast';
import { radii } from '../../theme/radii';
import { fonts } from '../../theme/typography';
import { getVibeColor } from '../../theme/vibeColors';
import { VIBES, VibeKey } from '../../lib/vibes';
import { StarRating } from '../../state/postStore';

interface StarRatingPickerProps {
  colors: ThemeColors;
  track: Track;
  onRate: (rating: StarRating) => void;
  /** Voto de vibra para ESTE track. Opcional para quien llama, opcional para el usuario. */
  onVoteVibe: (vibe: VibeKey) => void;
  onDismiss: () => void;
}

const RATINGS: StarRating[] = [1, 2, 3, 4, 5];

/**
 * "Selector rápido, no modal de texto": un toque sobre una estrella califica -- nada de
 * formulario, para no romper el ritmo del swipe. La reseña de texto (opcional) se agrega
 * después, desde el post ya creado en Feed.
 *
 * 2026-09-12: se agrega un SEGUNDO paso para votar la vibra de la canción.
 *
 * Por qué aquí y no en otro lado: hasta ahora votar vibra solo se podía desde el Feed, sobre
 * canciones ya posteadas, y la simulación de tráfico demostró que así ninguna canción llegaba
 * nunca al umbral de votos -- la dimensión entera quedaba muerta (ver la nota de 2026-09-12 en
 * schema.sql). Este es el único momento del deck en que alguien ya declaró que CONOCE la
 * canción ("ya la escuché" + estrellas), que es exactamente cuando su opinión sobre el ánimo
 * vale algo.
 *
 * Por qué un segundo paso y no todo junto: la calificación sigue siendo UN toque y se registra
 * de inmediato al tocar la estrella. La vibra se pide después, ya con el rating guardado, y se
 * puede saltar. Así el flujo rápido de siempre no paga nada por la pregunta nueva -- quien
 * quiera seguir swipeando toca "Saltar" o el fondo y listo.
 */
export function StarRatingPicker({ colors, track, onRate, onVoteVibe, onDismiss }: StarRatingPickerProps) {
  const [step, setStep] = useState<'rating' | 'vibe'>('rating');

  const handleRate = (value: StarRating) => {
    // El rating se registra YA, no al final del flujo: si la persona cierra en el paso de
    // vibra, su calificación no se pierde.
    onRate(value);
    setStep('vibe');
  };

  return (
    <View style={styles.backdrop}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.textPrimary }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {track.title}
        </Text>

        {step === 'rating' ? (
          <>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
              ¿Cómo te fue con esta canción?
            </Text>
            <View style={styles.stars}>
              {RATINGS.map((value) => (
                <Pressable key={value} onPress={() => handleRate(value)} hitSlop={6} style={styles.starButton}>
                  <StarIcon weight="fill" size={34} color={colors.brandText} />
                </Pressable>
              ))}
            </View>
            <Pressable onPress={onDismiss} hitSlop={8}>
              <Text style={[styles.dismiss, { color: colors.textSecondary }]}>Cancelar</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>¿Qué vibra tiene?</Text>
            {/* Scroll horizontal y no la rejilla por categorías de CategorizedChipPicker: son 18
                vibras y esto es un sheet chico encima del deck, no una pantalla de onboarding.
                Cada chip lleva SU color (theme/vibeColors.ts) para que la fila se lea de un
                vistazo en vez de como una lista de texto. */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.vibeRow}
              style={styles.vibeScroll}
            >
              {VIBES.map((v) => {
                const color = getVibeColor(v.key, colors.brand);
                return (
                  <Pressable
                    key={v.key}
                    onPress={() => onVoteVibe(v.key)}
                    style={[styles.vibeChip, { backgroundColor: color }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Votar la vibra ${v.label} para ${track.title}`}
                  >
                    <Text style={[styles.vibeLabel, { color: readableOn(color) }]}>
                      {v.emoji} {v.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable onPress={onDismiss} hitSlop={8}>
              <Text style={[styles.dismiss, { color: colors.textSecondary }]}>Saltar</Text>
            </Pressable>
          </>
        )}
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
    borderRadius: radii.card,
    paddingVertical: 24,
    paddingHorizontal: 28,
    alignItems: 'center',
    gap: 4,
    width: '86%',
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
  /** Margen negativo para que la fila de chips pueda sangrar hasta el borde del sheet y se
   *  vea que hay más contenido hacia la derecha, en vez de cortarse dentro del padding. */
  vibeScroll: {
    marginHorizontal: -28,
    maxHeight: 44,
  },
  vibeRow: {
    paddingHorizontal: 28,
    gap: 8,
    alignItems: 'center',
  },
  vibeChip: {
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  vibeLabel: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
  },
  dismiss: {
    marginTop: 18,
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
  },
});
