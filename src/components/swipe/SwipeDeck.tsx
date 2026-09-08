import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { CrownIcon } from 'phosphor-react-native';

import { Track } from '../../api/types';
import { useThemeStore } from '../../theme/useThemeStore';
import { getVibeColor } from '../../theme/vibeColors';
import { fonts } from '../../theme/typography';
import { useDeck } from '../../hooks/useDeck';
import { SwipeDirection, useSwipeStore } from '../../state/swipeStore';
import { useLibraryStore } from '../../state/libraryStore';
import { StarRating, usePostStore } from '../../state/postStore';
import { useSubscriptionStore } from '../../state/subscriptionStore';
import { areAdsSupportedOnThisPlatform } from '../../lib/ads';
import { CanonicalGenre } from '../../lib/genres';
import { VibeKey } from '../../lib/vibes';
import { SwipeCard, SwipeCardHandle } from './SwipeCard';
import { ActionButtons } from './ActionButtons';
import { StarRatingPicker } from './StarRatingPicker';
import { SponsoredCard } from '../ads/SponsoredCard';
import { StaticClearingBackground } from '../backgrounds/StaticClearingBackground';

const VISIBLE_STACK_SIZE = 3;

/**
 * Cada cuántos swipes reales se intercala una tarjeta patrocinada -- "RevenueCat Ads" pedido
 * explícitamente por el usuario (2026-09-06), aclarado en la conversación: RevenueCat no sirve
 * anuncios, solo los trackea (Purchases.adTracker) encima de una red real -- ver lib/ads.ts.
 * 10 se alinea con el mismo ritmo que ya usa el resto del producto (DAILY_FREE_SWIPE_LIMIT=50,
 * LOAD_MORE_WHEN_REMAINING=20 en useDeck.ts) -- ni tan seguido que se sienta invasivo, ni tan
 * espaciado que nunca aparezca en una sesión típica.
 */
const AD_INTERVAL = 10;

interface SwipeDeckProps {
  /** Vibra elegida en el selector de sesión (o null) -- ver app/(tabs)/index.tsx. */
  vibe?: VibeKey | null;
  /** Género elegido en el selector de sesión (o null) -- mismo origen que vibe. */
  genre?: CanonicalGenre | null;
}

export function SwipeDeck({ vibe, genre }: SwipeDeckProps) {
  const colors = useThemeStore((s) => s.colors);
  const mode = useThemeStore((s) => s.mode);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const anchor = useSwipeStore((s) => s.anchor);
  const currentIndex = useSwipeStore((s) => s.currentIndex);
  const advance = useSwipeStore((s) => s.advance);
  const setResolvedAnchor = useSwipeStore((s) => s.setResolvedAnchor);
  const resetIndex = useSwipeStore((s) => s.resetIndex);
  const addToCollection = useLibraryStore((s) => s.addToCollection);
  const rateTrack = usePostStore((s) => s.rateTrack);
  const canSwipe = useSubscriptionStore((s) => s.hasFreeSwipesLeft());
  const consumeFreeSwipe = useSubscriptionStore((s) => s.consumeFreeSwipe);
  const isPremium = useSubscriptionStore((s) => s.isPremium);
  const router = useRouter();

  const { data: deck, isLoading, isError, refetch, resolvedAnchor } = useDeck(anchor, vibe, genre, currentIndex);
  const [pendingRating, setPendingRating] = useState<Track | null>(null);
  const activeCardRef = useRef<SwipeCardHandle>(null);

  // Showmi More = sin anuncios (decisión confirmada con el usuario, completa el perk que
  // quedó pendiente en premium.tsx). `adDismissedAtIndex` evita que el mismo slot reaparezca
  // en cada re-render mientras currentIndex no cambia -- se "gasta" al tocar "Seguir viendo
  // música" (ver SponsoredCard.tsx), no en cuanto se muestra.
  const [adDismissedAtIndex, setAdDismissedAtIndex] = useState<number | null>(null);
  const showAdSlot =
    !isPremium &&
    areAdsSupportedOnThisPlatform() &&
    currentIndex > 0 &&
    currentIndex % AD_INTERVAL === 0 &&
    adDismissedAtIndex !== currentIndex;

  // Sistema reactivo de color por vibra (ver theme/vibeColors.ts, paso 1 de la identidad
  // visual): reacciona a la vibra elegida en el selector de SESIÓN, no a la vibra canónica
  // por track -- cambiar ESTE acento carta a carta sería ruido visual (tiñe el edgeLight, el
  // sello "YA LA ESCUCHÉ" y el tag de género), así que se mantiene estable toda la sesión.
  // Lo que sí reacciona por carta es el halo de la tarjeta, que es un canal aparte y más
  // silencioso (ver cardGlowColor en SwipeCard.tsx). Sin vibra de sesión, cae al rojo de marca.
  //
  // (Corrección 2026-09-08: este comentario decía que la vibra canónica por track "no
  // sobrevive el mapeo candidate->Track en useDeck.ts". Sí sobrevive desde que rankPool la
  // adjunta a Track.vibe; la razón para no usarla acá es de diseño, no técnica.)
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
      consumeFreeSwipe();
      // (El ledger remoto ya no es un pendiente: `advance` dispara registerSwipeRemote sin
      // bloquear, ver swipeStore.ts. El TODO que vivía acá quedó obsoleto desde la Fase 4.)
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
    [advance, addToCollection, consumeFreeSwipe]
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

  if (!canSwipe) {
    // Fricción tipo Tinder Free (ver subscriptionStore.ts) -- se revisa antes que
    // isLoading/isError a propósito: si ya se agotó el cupo gratis de hoy, no tiene caso
    // esperar a que useDeck traiga un pool nuevo, la respuesta correcta es siempre esta.
    content = (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <CrownIcon weight="fill" size={40} color={colors.premiumAccent} />
        <Text style={[styles.stateTitle, { color: colors.textPrimary }]}>Se acabaron tus swipes de hoy</Text>
        <Text style={[styles.stateText, { color: colors.textSecondary }]}>
          Con Showmi More tienes swipes ilimitados, todos los días.
        </Text>
        <Text style={[styles.retry, { color: colors.premiumAccent }]} onPress={() => router.push('/premium')}>
          Ver Showmi More
        </Text>
      </View>
    );
  } else if (isLoading) {
    // El addendum pedía este fondo detrás de la recarga en segundo plano (la que dispara
    // LOAD_MORE_WHEN_REMAINING en useDeck.ts). No encaja ahí por dos razones: useDeck no expone
    // `isPending` de esa mutación, y sobre todo esa recarga está DISEÑADA para ser invisible --
    // ocurre con la pila de tarjetas llena y el usuario swipeando, así que un fondo quedaría
    // tapado y un overlay interrumpiría la sesión justo a mitad de racha. La carga INICIAL sí
    // es un momento real de espera con la pantalla vacía, que es donde "la estática se despeja"
    // se lee como lo que el eslogan dice.
    content = (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <StaticClearingBackground width={screenWidth} height={screenHeight} mode={mode} />
        </View>
        <ActivityIndicator color={colors.brandText} size="large" />
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
          style={[styles.retry, { color: colors.brandText }]}
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
            style={[styles.retry, { color: colors.brandText }]}
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
    } else if (showAdSlot) {
      // Reemplaza la pila normal por completo en vez de intercalarse ENTRE tarjetas -- SwipeCard
      // no sabe nada de anuncios (gestos de arrastre, audio) y no debería tener que saberlo;
      // esto mantiene el ad fuera de ese sistema por completo. No consume un índice real del
      // deck (currentIndex no avanza) -- solo se "pasa" con el botón propio de SponsoredCard.
      content = (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={styles.stack}>
            <SponsoredCard
              colors={colors}
              placement="swipe_deck"
              onContinue={() => setAdDismissedAtIndex(currentIndex)}
            />
          </View>
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
                      sessionVibe={vibe}
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
