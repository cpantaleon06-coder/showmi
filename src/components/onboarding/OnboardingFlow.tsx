import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemeColors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import { FLOATING_TAB_BAR_CLEARANCE } from '../../theme/layout';
import { CANONICAL_GENRES, CanonicalGenre, GENRE_CATEGORY_ORDER } from '../../lib/genres';
import { VIBES, VIBE_CATEGORY_ORDER, VibeKey } from '../../lib/vibes';
import { artistsForGenre, curatedAnchorsByGenre } from '../../api/curatedSeeds';
import { searchItunesTracks } from '../../api/itunes';
import { Track } from '../../api/types';
import { DeckAnchor } from '../../hooks/useDeck';
import { useSwipeStore } from '../../state/swipeStore';
import { GradientChip } from '../ui/GradientChip';
import { CategorizedChipPicker } from '../ui/CategorizedChipPicker';
import { SwipeDeck } from '../swipe/SwipeDeck';

const ONBOARDING_SWIPE_TARGET = 8;

type Step = 'genres' | 'artists' | 'vibe' | 'anchor' | 'swipes';

export interface OnboardingResult {
  favoriteGenres: CanonicalGenre[];
  referenceArtists: string[];
  preferredVibe: VibeKey | null;
  anchorArtist: string | null;
  anchorTitle: string | null;
}

interface OnboardingFlowProps {
  colors: ThemeColors;
  onComplete: (result: OnboardingResult) => void;
  /** Precarga el formulario con respuestas ya guardadas -- ver EditOnboardingScreen
   *  (app/edit-onboarding.tsx). Ausente = onboarding normal de primera vez. */
  initialAnswers?: OnboardingResult;
  /** true al reabrir desde "Editar preferencias" en Perfil -- decisión confirmada
   *  2026-08-30 (sección 1): "botón dedicado que reabre las mismas pantallas en modo
   *  edición". Se salta el paso de swipes semilla (`ONBOARDING_SWIPE_TARGET` es solo
   *  para el cold-start inicial, no tiene sentido re-sembrar 8 swipes cada vez que
   *  alguien ajusta un género) -- el flujo termina justo después de "anchor" con
   *  "Guardar cambios" en vez de saltar a la pila de swipes. */
  editMode?: boolean;
}

/**
 * Cuestionario rápido tipo Tinder + 8-10 swipes iniciales, antes de que el
 * usuario vea el deck normal por primera vez. A diferencia del selector de
 * sesión (efímero), esto siembra taste_profile de forma PERMANENTE -- ver
 * onComplete, que dispara submitOnboarding + seedFromOnboardingAnswers.
 *
 * El mismo componente sirve para el modo edición (`editMode`+`initialAnswers`):
 * son las MISMAS pantallas, no una segunda implementación, tal como se confirmó.
 */
export function OnboardingFlow({ colors, onComplete, initialAnswers, editMode = false }: OnboardingFlowProps) {
  const [step, setStep] = useState<Step>('genres');
  const [genres, setGenres] = useState<CanonicalGenre[]>(initialAnswers?.favoriteGenres ?? []);
  const [artists, setArtists] = useState<string[]>(initialAnswers?.referenceArtists ?? []);
  const [vibe, setVibe] = useState<VibeKey | null>(initialAnswers?.preferredVibe ?? null);
  const [anchorQuery, setAnchorQuery] = useState('');
  const [anchorResults, setAnchorResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [anchor, setAnchor] = useState<Track | null>(null);

  const reanchor = useSwipeStore((s) => s.reanchor);
  const swipeCount = useSwipeStore((s) => s.currentIndex);

  const toggleGenre = (g: CanonicalGenre) =>
    setGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));

  const toggleArtist = (a: string) =>
    setArtists((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const runSearch = async () => {
    if (!anchorQuery.trim()) return;
    setSearching(true);
    try {
      const results = await searchItunesTracks(anchorQuery.trim(), 5);
      setAnchorResults(results);
    } finally {
      setSearching(false);
    }
  };

  const startSwipes = () => {
    const deckAnchor: DeckAnchor = anchor
      ? { artist: anchor.artist, title: anchor.title }
      : curatedAnchorsByGenre[genres[0] ?? 'indie_lofi'];
    reanchor(deckAnchor);
    setStep('swipes');
  };

  const finish = () => {
    // Sin ancla nueva elegida: conserva la que ya tenía (edición) en vez de borrarla --
    // buscar una canción nueva es opcional en los dos modos, no confirmarla no debería
    // vaciar lo que la persona ya tenía guardado.
    onComplete({
      favoriteGenres: genres,
      referenceArtists: artists,
      preferredVibe: vibe,
      anchorArtist: anchor?.artist ?? initialAnswers?.anchorArtist ?? null,
      anchorTitle: anchor?.title ?? initialAnswers?.anchorTitle ?? null,
    });
  };

  const candidateArtists = Array.from(new Set(genres.flatMap(artistsForGenre)));

  if (step === 'swipes') {
    const done = swipeCount >= ONBOARDING_SWIPE_TARGET;
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SafeAreaView style={styles.swipeHeader} edges={['top']}>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            {Math.min(swipeCount, ONBOARDING_SWIPE_TARGET)}/{ONBOARDING_SWIPE_TARGET} swipes iniciales
          </Text>
        </SafeAreaView>
        <View style={styles.swipeDeckWrap}>
          <SwipeDeck />
        </View>
        {done && (
          <View style={styles.doneOverlay}>
            <Pressable onPress={finish} style={[styles.primaryButton, { backgroundColor: colors.brand }]} hitSlop={8}>
              <Text style={styles.primaryButtonText}>Listo, vamos a Showmi</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {step === 'genres' && (
          <>
            <Text style={[styles.title, { color: colors.textPrimary }]}>¿Qué géneros te laten?</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Elige los que quieras -- al menos uno.</Text>
            <CategorizedChipPicker
              colors={colors}
              items={CANONICAL_GENRES}
              categoryOrder={GENRE_CATEGORY_ORDER}
              isSelected={(key) => genres.includes(key)}
              onSelect={toggleGenre}
            />
          </>
        )}

        {step === 'artists' && (
          <>
            <Text style={[styles.title, { color: colors.textPrimary }]}>¿Algún artista de referencia?</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Opcional -- según los géneros que ya elegiste.</Text>
            <View style={styles.chipWrap}>
              {candidateArtists.map((a) => (
                <GradientChip key={a} colors={colors} label={a} selected={artists.includes(a)} onPress={() => toggleArtist(a)} />
              ))}
            </View>
          </>
        )}

        {step === 'vibe' && (
          <>
            <Text style={[styles.title, { color: colors.textPrimary }]}>¿Con qué ánimo vienes casi siempre?</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Opcional -- puedes cambiarlo por sesión más adelante.</Text>
            <CategorizedChipPicker
              colors={colors}
              items={VIBES}
              categoryOrder={VIBE_CATEGORY_ORDER}
              isSelected={(key) => vibe === key}
              onSelect={(key) => setVibe(vibe === key ? null : key)}
            />
          </>
        )}

        {step === 'anchor' && (
          <>
            <Text style={[styles.title, { color: colors.textPrimary }]}>¿Una canción que ya sabes que te gusta?</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Opcional -- la usamos para armar tu primer deck ("dame más como esta").
            </Text>
            {editMode && !anchor && initialAnswers?.anchorArtist && (
              <Text style={[styles.currentAnchor, { color: colors.textSecondary, borderColor: colors.textPrimary }]}>
                Ancla actual: {initialAnswers.anchorTitle} — {initialAnswers.anchorArtist}
              </Text>
            )}
            <View style={styles.searchRow}>
              <TextInput
                value={anchorQuery}
                onChangeText={setAnchorQuery}
                onSubmitEditing={runSearch}
                placeholder="Artista o canción…"
                placeholderTextColor={colors.textSecondary}
                style={[styles.searchInput, { color: colors.textPrimary, borderColor: colors.border }]}
              />
              <Pressable onPress={runSearch} style={[styles.searchButton, { borderColor: colors.brand }]} hitSlop={8}>
                {searching ? <ActivityIndicator color={colors.brand} size="small" /> : <Text style={[styles.searchButtonText, { color: colors.brand }]}>Buscar</Text>}
              </Pressable>
            </View>
            {anchorResults.map((track) => (
              <Pressable
                key={track.id}
                onPress={() => setAnchor(anchor?.id === track.id ? null : track)}
                style={[
                  styles.resultRow,
                  { borderColor: anchor?.id === track.id ? colors.brand : colors.border },
                ]}
              >
                <Image source={{ uri: track.artworkUrl }} style={styles.resultArtwork} contentFit="cover" />
                <View style={styles.resultText}>
                  <Text style={[styles.resultTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {track.title}
                  </Text>
                  <Text style={[styles.resultArtist, { color: colors.textSecondary }]} numberOfLines={1}>
                    {track.artist}
                  </Text>
                </View>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={() => {
            if (step === 'genres') setStep('artists');
            else if (step === 'artists') setStep('vibe');
            else if (step === 'vibe') setStep('anchor');
            else if (step === 'anchor') {
              if (editMode) finish();
              else startSwipes();
            }
          }}
          disabled={step === 'genres' && genres.length === 0}
          style={[
            styles.primaryButton,
            { backgroundColor: colors.brand, opacity: step === 'genres' && genres.length === 0 ? 0.5 : 1 },
          ]}
          hitSlop={8}
        >
          <Text style={styles.primaryButtonText}>
            {step === 'anchor' ? (editMode ? 'Guardar cambios' : 'Empezar a swipear') : 'Continuar'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  title: {
    fontSize: 22,
    fontFamily: fonts.display,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 6,
    marginBottom: 24,
    fontFamily: fonts.bodyRegular,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  footer: {
    paddingHorizontal: 24,
    // Colchón para la isla flotante de pestañas -- ver theme/layout.ts.
    paddingBottom: FLOATING_TAB_BAR_CLEARANCE,
    paddingTop: 12,
  },
  primaryButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: fonts.bodyBold,
  },
  currentAnchor: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
  },
  searchButton: {
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  searchButtonText: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 2,
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
  },
  resultArtwork: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  resultText: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
  },
  resultArtist: {
    fontSize: 12,
    marginTop: 1,
    fontFamily: fonts.bodyRegular,
  },
  swipeHeader: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  progressText: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
  },
  swipeDeckWrap: {
    flex: 1,
  },
  doneOverlay: {
    position: 'absolute',
    left: 24,
    right: 24,
    // Colchón para la isla flotante de pestañas -- ver theme/layout.ts.
    bottom: FLOATING_TAB_BAR_CLEARANCE,
    pointerEvents: 'box-none',
  },
});
