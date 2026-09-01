import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Track } from '../../api/types';
import { useThemeStore } from '../../theme/useThemeStore';
import { getVibeColor } from '../../theme/vibeColors';
import { fonts } from '../../theme/typography';
import { useDeck } from '../../hooks/useDeck';
import { SwipeDirection, useSwipeStore } from '../../state/swipeStore';
import { useLibraryStore } from '../../state/libraryStore';
import { StarRating, usePostStore } from '../../state/postStore';
import { CanonicalGenre } from '../../lib/genres';
import { VibeKey } from '../../lib/vibes';
import { SwipeCard, SwipeCardHandle } from './SwipeCard';
import { ActionButtons } from './ActionButtons';
import { StarRatingPicker } from './StarRatingPicker';

const VISIBLE_STACK_SIZE = 3;

interface SwipeDeckProps {
  /** Vibra elegida en el selector de sesión (o null) -- ver app/(tabs)/index.tsx. */
  vibe?: VibeKey | null;
  /** Género elegido en el selector de sesión (o null) -- mismo origen que vibe. */
  genre?: CanonicalGenre | null;
}

export function SwipeDeck({ vibe, genre }: SwipeDeckProps) {
  const colors = useThemeStore((s) => s.colors);
  const anchor = useSwipeStore((s) => s.anchor);
  const currentIndex = useSwipeStore((s) => s.currentIndex);
  const advance = useSwipeStore((s) => s.advance);
  const setResolvedAnchor = useSwipeStore((s) => s.setResolvedAnchor);
  const resetIndex = useSwipeStore((s) => s.resetIndex);
  const addToCollection = useLibraryStore((s) => s.addToCollection);
  const rateTrack = usePostStore((s) => s.rateTrack);

  const { data: deck, isLoading, isError, refetch, resolvedAnchor } = useDeck(anchor, vibe, genre, currentIndex);
  const [pendingRating, setPendingRating] = useState<Track | null>(null);
  const activeCardRef = useRef<SwipeCardHandle>(null);

  // Sistema reactivo de color por vibra (ver theme/vibeColors.ts, paso 1 de la identidad
  // visual): reacciona a la vibra elegida en el selector de SESIÓN, no a la vibra canónica
  // por track -- esta última existe (track_canonical_vibe) pero no sobrevive el mapeo
  // candidate->Track en useDeck.ts, y cambiar de acento carta a carta sería más ruido visual
  // que señal. Sin vibra de sesión, cae al rojo constructivista de marca.
  const accentColor = getVibeColor(vibe, colors.brand);

  // Sin género de sesión, `anchor` queda null y useDeck resuelve uno al azar internamente
  // (resolvedAnchor) -- lo sincronizamos de vuelta acá para que swipeStore.anchor sea siempre
  // el ancla REAL que se está viendo, no solo la elegida explícitamente (ver setResolvedAnchor
  // en swipeStore.ts, y buildSessionSelection en sessionTreeStore.ts que depende de esto).
  useEffect(() => {
    if (!anchor) setResolvedAnchor(resolvedAnchor);
  }, [anchor, resolvedAnchor, setResolvedAnchor]);

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

  /** Botones de acción: pasan por la MISMA animación de lanzamiento que el gesto de
   *  arrastre (vía el ref imperativo de la tarjeta activa), en vez de saltarla -- así el
   *  audio se detiene en el mismo lugar sin importar cuál de los dos caminos se usó (ver
   *  SwipeCard.throwCard). Fallback directo a handleSwiped si el ref no está listo por
   *  algún motivo, para que el botón nunca quede sin hacer nada. */
  const triggerSwipe = useCallback(
    (track: Track, direction: SwipeDirection) => {
      if (activeCardRef.current) {
        activeCardRef.current.throwCard(direction);
      } else {
        handleSwiped(track, direction);
      }
    },
    [handleSwiped]
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
        <Text
          style={[styles.retry, { color: colors.brand }]}
          onPress={() => {
            resetIndex();
            refetch();
          }}
        >
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
          <Text
            style={[styles.retry, { color: colors.brand }]}
            onPress={() => {
              // Bug real de debugging: sin esto, refetch() volvía a traer un pool y
              // `remaining` seguía vacío (currentIndex se quedaba apuntando más allá del
              // deck agotado) -- "Buscar más" no hacía nada visible. Ver comentario en
              // swipeStore.ts (resetIndex).
              resetIndex();
              refetch();
            }}
          >
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
                      ref={isActive ? activeCardRef : undefined}
                      track={track}
                      colors={colors}
                      accentColor={accentColor}
                      isActive={isActive}
                      onSwiped={(direction) => handleSwiped(track, direction)}
                    />
                  </View>
                );
              })}
          </View>

          <ActionButtons
            colors={colors}
            accentColor={accentColor}
            onPass={() => triggerSwipe(topTrack, 'left')}
            onLike={() => triggerSwipe(topTrack, 'right')}
            onHeard={() => triggerSwipe(topTrack, 'up')}
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
  // paddingVertical (no solo paddingBottom) a propósito -- la tarjeta usa
  // StyleSheet.absoluteFill dentro de este contenedor, así que este padding
  // es lo que le da el margen arriba/abajo visto en la referencia en vez de
  // ocupar el 100% del alto disponible de borde a borde.
  stack: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    paddingBottom: 20,
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
