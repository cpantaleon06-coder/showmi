import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Extrapolation,
} from 'react-native-reanimated';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { HeartIcon, XIcon } from 'phosphor-react-native';

import { Track } from '../../api/types';
import { VibeKey } from '../../lib/vibes';
import { ThemeColors } from '../../theme/colors';
import { radii } from '../../theme/radii';
import { resortes } from '../../theme/motion';
import { cardGlowColor, cardGlowShadow } from '../../theme/glow';
import { fonts } from '../../theme/typography';
import { SwipeDirection } from '../../state/swipeStore';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_X_THRESHOLD = SCREEN_WIDTH * 0.28;
const SWIPE_UP_THRESHOLD = 120;

interface SwipeCardProps {
  track: Track;
  colors: ThemeColors;
  /** Color reactivo de vibra de sesión (ver SwipeDeck.tsx / theme/vibeColors.ts) -- reemplaza
   *  colors.brand como acento de esta tarjeta (edgeLight, stamp "YA LA ESCUCHÉ", tag de género). */
  accentColor: string;
  /** Vibra elegida en el selector de sesión. Se usa SOLO como respaldo del halo cuando la
   *  canción todavía no tiene vibra canónica propia -- ver el comentario de glowColor abajo. */
  sessionVibe?: VibeKey | null;
  isActive: boolean;
  onSwiped: (direction: SwipeDirection) => void;
}

/** Expuesto para que ActionButtons (Pasar/Guardar/Ya la escuché) dispare la MISMA animación
 *  de lanzamiento que el gesto de arrastre, en vez de saltarla -- así el audio se detiene
 *  en el mismo lugar (el propio `throwCard`, síncrono) sin importar por cuál de los dos
 *  caminos llegó el swipe. */
export interface SwipeCardHandle {
  throwCard: (direction: SwipeDirection) => void;
}

export const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(function SwipeCard(
  { track, colors, accentColor, sessionVibe, isActive, onSwiped },
  ref
) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const reducedMotion = useReducedMotion();

  // Each SwipeCard instance is keyed to one fixed track, so the source never
  // changes across its lifetime — only play/pause toggles with isActive.
  // (useAudioPlayer does NOT reload on a changed source prop, only on mount,
  // so this must NOT be made conditional on isActive.)
  const player = useAudioPlayer(track.previewUrl ?? null);
  const status = useAudioPlayerStatus(player);
  // No loop: the 30s clip plays once and stops. didJustFinish flips this to
  // true so the "toca para escuchar de nuevo" hint can show — tapping the
  // card (see the tap gesture below) replays regardless of this flag.
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!track.previewUrl) return;
    if (isActive) {
      setFinished(false);
      player.seekTo(0);
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, track.previewUrl, player]);

  useEffect(() => {
    if (status.didJustFinish) setFinished(true);
  }, [status.didJustFinish]);

  useEffect(() => {
    return () => {
      player.pause();
    };
  }, [player]);

  const replay = () => {
    if (!track.previewUrl) return;
    setFinished(false);
    player.seekTo(0);
    player.play();
  };

  /** Duración fija del lanzamiento -- NO un spring. Un spring (damping:15/stiffness:180,
   *  subamortiguado) tarda ~500-700ms en asentarse lo suficiente para que su callback
   *  de finalización dispare, y ESE era el bug real reportado ("sigue sonando y tarda en
   *  sonar la otra"): tanto el pause() como el avance del deck (que activa el audio de
   *  la siguiente tarjeta) esperaban a ese asentamiento. Con duración fija sabemos
   *  exactamente cuándo termina, sin importar la física del rebote. */
  const THROW_DURATION_MS = 220;

  /** Animación de lanzamiento compartida por el gesto de arrastre y por ActionButtons
   *  (vía el ref imperativo). El pausado de audio es SÍNCRONO acá mismo, antes de
   *  arrancar cualquier animación -- no depende de que termine ninguna, así que no
   *  puede quedar sonando por más que dure el lanzamiento visual. El avance del deck
   *  (`onSwiped`, que activa la tarjeta siguiente y con ella SU audio) sigue esperando
   *  a que la animación termine para que se alcance a ver la tarjeta salir, pero ahora
   *  con un tope fijo de THROW_DURATION_MS en vez de un asentamiento impredecible. */
  const throwCard = (direction: SwipeDirection) => {
    player.pause();
    const finishSwipe = () => onSwiped(direction);

    if (direction === 'right') {
      translateX.value = reducedMotion
        ? withTiming(SCREEN_WIDTH * 1.5, { duration: 1 }, () => runOnJS(finishSwipe)())
        : withTiming(SCREEN_WIDTH * 1.5, { duration: THROW_DURATION_MS }, () => runOnJS(finishSwipe)());
    } else if (direction === 'left') {
      translateX.value = reducedMotion
        ? withTiming(-SCREEN_WIDTH * 1.5, { duration: 1 }, () => runOnJS(finishSwipe)())
        : withTiming(-SCREEN_WIDTH * 1.5, { duration: THROW_DURATION_MS }, () => runOnJS(finishSwipe)());
    } else {
      translateY.value = reducedMotion
        ? withTiming(-SCREEN_WIDTH * 1.5, { duration: 1 }, () => runOnJS(finishSwipe)())
        : withTiming(-SCREEN_WIDTH * 1.5, { duration: THROW_DURATION_MS }, () => runOnJS(finishSwipe)());
    }
  };

  useImperativeHandle(ref, () => ({ throwCard }), [reducedMotion]);

  const pan = Gesture.Pan()
    .enabled(isActive)
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      const wentRight = translateX.value > SWIPE_X_THRESHOLD;
      const wentLeft = translateX.value < -SWIPE_X_THRESHOLD;
      const wentUp = translateY.value < -SWIPE_UP_THRESHOLD && Math.abs(translateX.value) < SWIPE_X_THRESHOLD;

      // Movimiento reducido: nada de spring, solo un salto casi instantáneo
      // (duración 1ms, no 0, para que el callback de finalización siempre
      // dispare de forma confiable).
      if (wentRight) {
        runOnJS(throwCard)('right');
      } else if (wentLeft) {
        runOnJS(throwCard)('left');
      } else if (wentUp) {
        runOnJS(throwCard)('up');
      } else if (reducedMotion) {
        translateX.value = withTiming(0, { duration: 1 });
        translateY.value = withTiming(0, { duration: 1 });
      } else {
        // Vuelta a su sitio cuando el gesto no alcanzo el umbral. Resorte compartido: es el
        // mismo "responde y para" que el resto de la UI. Los throw de arriba NO se migran --
        // llevan callback y su 1ms esta puesto a proposito (ver el comentario de arriba).
        translateX.value = withSpring(0, resortes.ui);
        translateY.value = withSpring(0, resortes.ui);
      }
    });

  // Tap-to-replay, raced against the drag: a plain tap (no meaningful
  // movement) resolves as Tap and replays the clip; anything that moves
  // resolves as Pan instead. Needed because GestureDetector wraps the whole
  // card, so a nested Pressable's onPress would never fire on its own.
  const tap = Gesture.Tap()
    .enabled(isActive)
    .maxDuration(250)
    .onEnd(() => {
      runOnJS(replay)();
    });

  const cardGesture = Gesture.Race(pan, tap);

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      [-12, 0, 12],
      Extrapolation.CLAMP
    );
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const likeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_X_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));
  const passOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_X_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));
  const heardOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [-SWIPE_UP_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));

  // Halo reactivo: color derivado del género Y la vibra de ESTA canción (ver theme/glow.ts),
  // no del acento de sesión -- por eso cambia carta a carta al swipear, en vez de quedarse
  // fijo toda la sesión como `accentColor`.
  //
  // `track.vibe ?? sessionVibe`: la vibra canónica de una canción sale de
  // `track_canonical_vibe`, que exige >=3 votos de la comunidad -- o sea que en un proyecto
  // sin tráfico real todavía es null para CASI TODAS, y la mitad "vibra" del halo nunca se
  // veía. La vibra de sesión es una declaración explícita de la persona ("hoy vengo con esta
  // vibra"), así que es un respaldo honesto y no un invento: si la canción ya tiene vibra
  // votada gana esa, y si no, se usa la que la persona eligió. Sin ninguna de las dos, el
  // halo es solo de género.
  const glowColor = cardGlowColor(track.genre, track.vibe ?? sessionVibe, accentColor);

  const cardContent = (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          boxShadow: cardGlowShadow(glowColor, isActive),
        },
        isActive && cardStyle,
      ]}
    >
      <LinearGradient
        colors={[accentColor, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.edgeLight}
      />
      <Image source={{ uri: track.artworkUrl }} style={styles.artwork} contentFit="cover" transition={150} />

      {isActive && (
        <>
          <Animated.View style={[styles.badge, styles.likeBadge, { backgroundColor: colors.like }, likeOpacity]}>
            <HeartIcon weight="fill" size={26} color="#FFFFFF" />
          </Animated.View>
          <Animated.View style={[styles.badge, styles.passBadge, { backgroundColor: colors.pass }, passOpacity]}>
            <XIcon weight="fill" size={26} color="#FFFFFF" />
          </Animated.View>
          <Animated.View
            style={[styles.badge, styles.heardBadge, { backgroundColor: accentColor }, heardOpacity]}
          >
            <Text style={[styles.badgeText, { color: '#FFFFFF' }]}>YA LA ESCUCHÉ</Text>
          </Animated.View>
        </>
      )}

      {isActive && finished && (
        <View style={[styles.replayHint, { pointerEvents: 'none' }]}>
          <Text style={styles.replayHintText}>Toca la tarjeta para escuchar de nuevo</Text>
        </View>
      )}

      {/* Taller gradient fade, not a flat scrim: a flat rgba(0,0,0,0.45) wasn't
          dark enough at its own top edge to keep title/artist legible over
          busy or light album art -- fading from transparent to near-opaque
          gives the text a guaranteed-dark landing zone regardless of the
          artwork underneath. */}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} locations={[0, 0.65]} style={styles.info}>
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {track.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {track.artist}
        </Text>
        {track.genre && (
          <View style={[styles.genreTag, { backgroundColor: accentColor }]}>
            <Text style={styles.genreTagText}>{track.genre.toUpperCase()}</Text>
          </View>
        )}
      </LinearGradient>
    </Animated.View>
  );

  if (!isActive) {
    return cardContent;
  }

  return <GestureDetector gesture={cardGesture}>{cardContent}</GestureDetector>;
});

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: SCREEN_WIDTH - 40,
    height: '100%',
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  edgeLight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    zIndex: 2,
  },
  artwork: {
    width: '100%',
    height: '100%',
  },
  info: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  replayHint: {
    position: 'absolute',
    alignSelf: 'center',
    top: '46%',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 2,
  },
  replayHintText: {
    color: '#F5F5F5',
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
  },
  // Fixed light colors, not theme tokens: this text sits on a dark photo
  // gradient regardless of app theme, so colors.textPrimary would go
  // dark-on-dark (near-invisible) in light mode -- a real bug this
  // typography pass surfaced, not a stylistic choice.
  title: {
    fontSize: 20,
    fontFamily: fonts.display,
    color: '#FFFFFF',
  },
  artist: {
    fontSize: 16,
    marginTop: 2,
    fontFamily: fonts.bodyRegular,
    color: 'rgba(255,255,255,0.85)',
  },
  genreTag: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  genreTagText: {
    fontSize: 11,
    letterSpacing: 0.6,
    fontFamily: fonts.bodyExtraBold,
    color: '#FFFFFF',
  },
  badge: {
    position: 'absolute',
    top: 32,
    borderRadius: 10,
    padding: 10,
    zIndex: 3,
  },
  likeBadge: {
    left: 24,
    transform: [{ rotate: '-14deg' }],
  },
  passBadge: {
    right: 24,
    transform: [{ rotate: '14deg' }],
  },
  heardBadge: {
    alignSelf: 'center',
    top: 32,
  },
  badgeText: {
    fontSize: 16,
    fontFamily: fonts.bodyExtraBold,
    letterSpacing: 1,
  },
});
