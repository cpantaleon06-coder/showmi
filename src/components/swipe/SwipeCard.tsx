import { useEffect, useState } from 'react';
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
import { ThemeColors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import { SwipeDirection } from '../../state/swipeStore';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_X_THRESHOLD = SCREEN_WIDTH * 0.28;
const SWIPE_UP_THRESHOLD = 120;

interface SwipeCardProps {
  track: Track;
  colors: ThemeColors;
  isActive: boolean;
  onSwiped: (direction: SwipeDirection) => void;
}

export function SwipeCard({ track, colors, isActive, onSwiped }: SwipeCardProps) {
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

  const finishSwipe = (direction: SwipeDirection) => {
    onSwiped(direction);
  };

  const replay = () => {
    if (!track.previewUrl) return;
    setFinished(false);
    player.seekTo(0);
    player.play();
  };

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

      const throwSpring = { damping: 15, stiffness: 180 };
      // Movimiento reducido: nada de spring, solo un salto casi instantáneo
      // (duración 1ms, no 0, para que el callback de finalización siempre
      // dispare de forma confiable).
      if (wentRight) {
        translateX.value = reducedMotion
          ? withTiming(SCREEN_WIDTH * 1.5, { duration: 1 }, () => runOnJS(finishSwipe)('right'))
          : withSpring(SCREEN_WIDTH * 1.5, throwSpring, () => runOnJS(finishSwipe)('right'));
      } else if (wentLeft) {
        translateX.value = reducedMotion
          ? withTiming(-SCREEN_WIDTH * 1.5, { duration: 1 }, () => runOnJS(finishSwipe)('left'))
          : withSpring(-SCREEN_WIDTH * 1.5, throwSpring, () => runOnJS(finishSwipe)('left'));
      } else if (wentUp) {
        translateY.value = reducedMotion
          ? withTiming(-SCREEN_WIDTH * 1.5, { duration: 1 }, () => runOnJS(finishSwipe)('up'))
          : withSpring(-SCREEN_WIDTH * 1.5, throwSpring, () => runOnJS(finishSwipe)('up'));
      } else if (reducedMotion) {
        translateX.value = withTiming(0, { duration: 1 });
        translateY.value = withTiming(0, { duration: 1 });
      } else {
        translateX.value = withSpring(0, { damping: 18 });
        translateY.value = withSpring(0, { damping: 18 });
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

  const cardContent = (
    <Animated.View style={[styles.card, { backgroundColor: colors.surface }, isActive && cardStyle]}>
      <LinearGradient
        colors={[colors.brand, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.edgeLight}
      />
      <Image source={{ uri: track.artworkUrl }} style={styles.artwork} contentFit="cover" transition={150} />

      {isActive && (
        <>
          <Animated.View style={[styles.badge, styles.likeBadge, { borderColor: colors.like }, likeOpacity]}>
            <HeartIcon weight="fill" size={28} color={colors.like} />
          </Animated.View>
          <Animated.View style={[styles.badge, styles.passBadge, { borderColor: colors.pass }, passOpacity]}>
            <XIcon weight="fill" size={28} color={colors.pass} />
          </Animated.View>
          <Animated.View style={[styles.badge, styles.heardBadge, { borderColor: colors.brand }, heardOpacity]}>
            <Text style={[styles.badgeText, { color: colors.brand }]}>YA LA ESCUCHÉ</Text>
          </Animated.View>
        </>
      )}

      {isActive && finished && (
        <View style={styles.replayHint} pointerEvents="none">
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
        {track.genre && <Text style={[styles.genre, { borderColor: 'rgba(255,255,255,0.4)' }]}>{track.genre}</Text>}
      </LinearGradient>
    </Animated.View>
  );

  if (!isActive) {
    return cardContent;
  }

  return <GestureDetector gesture={cardGesture}>{cardContent}</GestureDetector>;
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: SCREEN_WIDTH - 40,
    height: '100%',
    borderRadius: 18,
    overflow: 'hidden',
  },
  edgeLight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
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
  genre: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 12,
    fontFamily: fonts.bodyRegular,
    color: 'rgba(255,255,255,0.85)',
  },
  badge: {
    position: 'absolute',
    top: 32,
    borderWidth: 3,
    borderRadius: 12,
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
