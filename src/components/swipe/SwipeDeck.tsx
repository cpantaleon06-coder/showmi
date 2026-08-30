import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Track } from '../../api/types';
import { useThemeStore } from '../../theme/useThemeStore';
import { fonts } from '../../theme/typography';
import { useDeck } from '../../hooks/useDeck';
import { SwipeDirection, useSwipeStore } from '../../state/swipeStore';
import { useLibraryStore } from '../../state/libraryStore';
import { StarRating, usePostStore } from '../../state/postStore';
import { VibeKey } from '../../lib/vibes';
import { SwipeCard } from './SwipeCard';
import { ActionButtons } from './ActionButtons';
import { StarRatingPicker } from './StarRatingPicker';

const VISIBLE_STACK_SIZE = 3;

interface SwipeDeckProps {
  /** Vibra elegida en el selector de sesión (o null) -- ver app/(tabs)/index.tsx. */
  vibe?: VibeKey | null;
}

export function SwipeDeck({ vibe }: SwipeDeckProps) {
  const colors = useThemeStore((s) => s.colors);
  const anchor = useSwipeStore((s) => s.anchor);
  const currentIndex = useSwipeStore((s) => s.currentIndex);
  const advance = useSwipeStore((s) => s.advance);
  const addToCollection = useLibraryStore((s) => s.addToCollection);
  const rateTrack = usePostStore((s) => s.rateTrack);

  const { data: deck, isLoading, isError, refetch } = useDeck(anchor, vibe);
  const [pendingRating, setPendingRating] = useState<Track | null>(null);

  const handleSwiped = useCallback(
    (track: Track, direction: SwipeDirection) => {
      advance(track, direction);
      // TODO: once Supabase is wired up, persist this swipe to the `swipes`
      // table too (user_id, track_id, isrc, direction, timestamp).
      if (direction === 'right') {
        addToCollection('para_escuchar', track);
      } else if (direction === 'up') {
        addToCollection('escuchadas', track);
        // El deck sigue avanzando de inmediato (no bloquea el ritmo del
        // swipe); el selector de estrellas aparece encima como una capa
        // aparte y se resuelve con un solo toque.
        setPendingRating(track);
      }
    },
    [advance, addToCollection]
  );

  const handleRate = useCallback(
    (rating: StarRating) => {
      if (pendingRating) rateTrack(pendingRating, rating);
      setPendingRating(null);
    },
    [pendingRating, rateTrack]
  );

  let content: ReactNode;

  if (isLoading) {
    content = (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.brand} size="large" />
        <Text style={[styles.stateText, { color: colors.textSecondary }]}>Buscando sonidos para ti…</Text>
      </View>
    );
  } else if (isError) {
    content = (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.stateTitle, { color: colors.textPrimary }]}>Sin conexión</Text>
        <Text style={[styles.stateText, { color: colors.textSecondary }]}>
          No pudimos cargar tu deck. Revisa tu conexión e intenta de nuevo.
        </Text>
        <Text style={[styles.retry, { color: colors.brand }]} onPress={() => refetch()}>
          Reintentar
        </Text>
      </View>
    );
  } else {
    const remaining = (deck ?? []).slice(currentIndex, currentIndex + VISIBLE_STACK_SIZE);

    if (remaining.length === 0) {
      content = (
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <Text style={[styles.stateTitle, { color: colors.textPrimary }]}>Se acabaron las tarjetas</Text>
          <Text style={[styles.stateText, { color: colors.textSecondary }]}>
            Vuelve más tarde o busca "dame más como esta" desde tu Biblioteca.
          </Text>
          <Text style={[styles.retry, { color: colors.brand }]} onPress={() => refetch()}>
            Buscar más
          </Text>
        </View>
      );
    } else {
      const topTrack = remaining[0];
      content = (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={styles.stack}>
            {remaining
              .slice()
              .reverse()
              .map((track, reversedIndex) => {
                const stackPosition = remaining.length - 1 - reversedIndex;
                const isActive = stackPosition === 0;
                return (
                  <View
                    key={track.id}
                    style={[
                      StyleSheet.absoluteFill,
                      styles.cardSlot,
                      { transform: [{ scale: 1 - stackPosition * 0.03 }, { translateY: stackPosition * 10 }] },
                      { pointerEvents: isActive ? 'auto' : 'none' },
                    ]}
                  >
                    <SwipeCard
                      track={track}
                      colors={colors}
                      isActive={isActive}
                      onSwiped={(direction) => handleSwiped(track, direction)}
                    />
                  </View>
                );
              })}
          </View>

          <ActionButtons
            colors={colors}
            onPass={() => handleSwiped(topTrack, 'left')}
            onLike={() => handleSwiped(topTrack, 'right')}
            onHeard={() => handleSwiped(topTrack, 'up')}
          />
        </View>
      );
    }
  }

  return (
    <View style={styles.container}>
      {content}
      {pendingRating && (
        <StarRatingPicker
          colors={colors}
          track={pendingRating}
          onRate={handleRate}
          onDismiss={() => setPendingRating(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stack: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 16,
  },
  cardSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  stateTitle: {
    fontSize: 20,
    fontFamily: fonts.display,
  },
  stateText: {
    fontSize: 15,
    textAlign: 'center',
    fontFamily: fonts.bodyRegular,
  },
  retry: {
    marginTop: 12,
    fontSize: 15,
    fontFamily: fonts.bodyBold,
  },
});
