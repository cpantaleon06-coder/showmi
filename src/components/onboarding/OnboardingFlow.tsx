import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaretLeftIcon } from 'phosphor-react-native';
import { useQuery } from '@tanstack/react-query';

import { ThemeColors } from '../../theme/colors';
import { useThemeStore } from '../../theme/useThemeStore';
import { HalftoneWaveBackground } from '../backgrounds/HalftoneWaveBackground';
import { fonts } from '../../theme/typography';
import { FLOATING_TAB_BAR_CLEARANCE } from '../../theme/layout';
import { CANONICAL_GENRES, CanonicalGenre, GENRE_CATEGORY_ORDER } from '../../lib/genres';
import { VIBES, VIBE_CATEGORY_ORDER, VibeKey } from '../../lib/vibes';
import { artistsForGenre, curatedAnchorsByGenre } from '../../api/curatedSeeds';
import { fetchArtistSuggestions } from '../../api/artistSuggestions';
import { searchItunesTracks } from '../../api/itunes';
import { Track } from '../../api/types';
import { DeckAnchor } from '../../hooks/useDeck';
import { useSwipeStore } from '../../state/swipeStore';
import { GradientChip } from '../ui/GradientChip';
import { CategorizedChipPicker } from '../ui/CategorizedChipPicker';
import { SwipeDeck } from '../swipe/SwipeDeck';

const ONBOARDING_SWIPE_TARGET = 8;

type Step = 'genres' | 'artists' | 'vibe' | 'anchor' | 'swipes';

/** Orden real de los 4 pasos con formulario -- 'swipes' vive fuera de esta lista a propósito:
 *  es una pantalla aparte (con su propio overlay de "Listo"), retroceder desde ahí implicaría
 *  deshacer swipes ya hechos contra swipeStore, un problema distinto al que se está resolviendo
 *  acá (poder corregir una respuesta antes de llegar a los swipes). */
const STEP_ORDER: Step[] = ['genres', 'artists', 'vibe', 'anchor'];

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
  /**
   * Se dispara en cuanto las respuestas están completas y ANTES de cualquier swipe, para
   * sembrar el taste_profile local. Separado de `onComplete` a propósito (ver startSwipes):
   * onComplete corre al final de los 8 swipes iniciales, que es demasiado tarde para que el
   * primer deck se beneficie de lo que la persona acaba de responder.
   */
  onAnswersReady: (result: OnboardingResult) => void;
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
export function OnboardingFlow({
  colors,
  onComplete,
  onAnswersReady,
  initialAnswers,
  editMode = false,
}: OnboardingFlowProps) {
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

  // `colors` llega por prop (este componente se monta desde dos lugares distintos,
  // ver editMode), pero el modo no -- y los fondos de patrón lo necesitan para
  // elegir su opacidad. Se lee del store directo, mismo patrón que el resto de la
  // app; no se agrega a las props para no tocar los dos call sites por un detalle
  // puramente visual.
  const mode = useThemeStore((s) => s.mode);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const toggleGenre = (g: CanonicalGenre) =>
    setGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));

  const toggleArtist = (a: string) =>
    setArtists((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  /** Retrocede un paso sin perder nada ya elegido -- genres/artists/vibe/anchor viven en
   *  useState propio de este componente, no se limpian al cambiar `step`, así que volver
   *  adelante después de retroceder conserva las respuestas tal como quedaron. */
  const goBack = () => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) setStep(STEP_ORDER[idx - 1]);
  };

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

  /** Sin ancla nueva elegida: conserva la que ya tenía (edición) en vez de borrarla --
   *  buscar una canción nueva es opcional en los dos modos, no confirmarla no debería
   *  vaciar lo que la persona ya tenía guardado. */
  const buildAnswers = (): OnboardingResult => ({
    favoriteGenres: genres,
    referenceArtists: artists,
    preferredVibe: vibe,
    anchorArtist: anchor?.artist ?? initialAnswers?.anchorArtist ?? null,
    anchorTitle: anchor?.title ?? initialAnswers?.anchorTitle ?? null,
  });

  const startSwipes = () => {
    // Sembrar ANTES de los swipes iniciales, y antes del reanchor que dispara el fetch del
    // deck. Hasta 2026-09-01 el sembrado vivía solo en onComplete -- que corre al TERMINAR
    // los 8 swipes -- así que el primer deck que veía la persona (justo el de su propio
    // onboarding) se rankeaba con un UserState vacío, ignorando los géneros/artistas/vibra
    // que acababa de elegir. Era exactamente el arranque en frío que este cuestionario
    // existe para evitar.
    onAnswersReady(buildAnswers());

    const deckAnchor: DeckAnchor = anchor
      ? { artist: anchor.artist, title: anchor.title }
      : curatedAnchorsByGenre[genres[0] ?? 'indie_lofi'];
    reanchor(deckAnchor);
    setStep('swipes');
  };

  const finish = () => {
    // En modo edición no hay swipes intermedios (ver `editMode`), así que este es el único
    // momento posible para resembrar. En el flujo normal NO se resiembra acá a propósito:
    // ya se sembró en startSwipes, y los 8 swipes iniciales modificaron esas mismas claves
    // -- volver a sembrarlas ahora borraría justo lo que esos swipes acaban de enseñar.
    if (editMode) onAnswersReady(buildAnswers());
    onComplete(buildAnswers());
  };

  // Los curados salen al instante (sin red) y la consulta los reemplaza por la lista larga
  // en cuanto Last.fm responde -- así el paso nunca aparece vacío ni con un spinner, solo se
  // enriquece. `genres.join()` en la key: el array cambia de identidad en cada render, usarlo
  // crudo re-dispararía la consulta sin parar.
  const curatedArtists = Array.from(new Set(genres.flatMap(artistsForGenre)));
  const suggestionsQuery = useQuery({
    queryKey: ['artist-suggestions', genres.join('|')],
    queryFn: () => fetchArtistSuggestions(genres),
    enabled: genres.length > 0,
    staleTime: 1000 * 60 * 30,
  });
  const candidateArtists = suggestionsQuery.data ?? curatedArtists;

  if (step === 'swipes') {
    const done = swipeCount >= ONBOARDING_SWIPE_TARGET;
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* 2026-09-08: este paso era un callejón sin salida real. Se ve IGUAL que el deck
            normal (mismo SwipeDeck), pero como sigue siendo parte del onboarding la isla de
            pestañas está oculta (ver showingGate en app/(tabs)/index.tsx) -- así que quien
            llegaba acá no tenía forma de ir a Biblioteca/Feed/Perfil hasta completar los 8
            swipes, sin ninguna pista de por qué. El deck REAL nunca tuvo el problema
            (verificado: su barra inferior navega bien); el atasco era exclusivamente este.

            La salida es saltar, no retroceder: volver implicaría deshacer swipes ya
            registrados contra swipeStore/el ledger remoto (por eso 'swipes' nunca estuvo en
            STEP_ORDER). Y saltar es seguro porque el sembrado del motor YA ocurrió en
            startSwipes -> onAnswersReady; estos 8 swipes solo lo refinan. */}
        <SafeAreaView style={styles.swipeHeader} edges={['top']}>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            {Math.min(swipeCount, ONBOARDING_SWIPE_TARGET)}/{ONBOARDING_SWIPE_TARGET} swipes iniciales
          </Text>
          {!done && (
            <Pressable onPress={finish} hitSlop={10}>
              <Text style={[styles.skipText, { color: colors.brandText }]}>Saltar por ahora</Text>
            </Pressable>
          )}
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
      {/* Fondo de patrón detrás del contenido real, nunca reemplazándolo. pointerEvents="none"
          es obligatorio acá: sin eso el SVG a pantalla completa se traga los toques que deben
          llegar a los chips y al input de búsqueda. Solo cubre los 4 pasos de formulario -- el
          paso 'swipes' retorna antes (arriba) y se queda con el fondo plano, porque ahí la
          pantalla ya la ocupa el deck. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <HalftoneWaveBackground width={screenWidth} height={screenHeight} mode={mode} />
      </View>

      {/* Altura fija siempre reservada (en vez de no renderizar la fila en 'genres') para que
          el contenido no salte de posición al cambiar de paso -- el botón en sí solo se ve
          (opacity) y responde a toques (pointerEvents) desde 'artists' en adelante; en
          'genres' no hay paso previo al que volver. */}
      <View style={styles.stepHeader} pointerEvents="box-none">
        <Pressable
          onPress={goBack}
          hitSlop={10}
          disabled={step === 'genres'}
          style={[styles.backButton, { opacity: step === 'genres' ? 0 : 1 }]}
        >
          <CaretLeftIcon weight="light" size={24} color={colors.textPrimary} />
        </Pressable>
      </View>

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
              <Text
                style={[
                  styles.currentAnchor,
                  { backgroundColor: colors.background, color: colors.textSecondary, borderColor: colors.textPrimary },
                ]}
              >
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
                style={[
                  styles.searchInput,
                  { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border },
                ]}
              />
              <Pressable onPress={runSearch} style={[styles.searchButton, { borderColor: colors.brand }]} hitSlop={8}>
                {searching ? <ActivityIndicator color={colors.brandText} size="small" /> : <Text style={[styles.searchButtonText, { color: colors.brandText }]}>Buscar</Text>}
              </Pressable>
            </View>
            {anchorResults.map((track) => (
              <Pressable
                key={track.id}
                onPress={() => setAnchor(anchor?.id === track.id ? null : track)}
                style={[
                  styles.resultRow,
                  {
                    backgroundColor: colors.background,
                    borderColor: anchor?.id === track.id ? colors.brand : colors.border,
                  },
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
        {/* Placa opaca bajo el botón: cuando está deshabilitado baja a opacity 0.5, y sobre
            el fondo de patrón eso dejaba ver las franjas ATRAVESANDO el botón -- se leía como
            un glitch de render, no como "deshabilitado". Con esta placa del color de la
            página debajo, el 0.5 mezcla contra un campo plano y el botón simplemente se
            apaga, que es lo que la opacidad quería comunicar. */}
        <View style={[styles.primaryButtonBacking, { backgroundColor: colors.background }]}>
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stepHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 4,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
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
  /** Mismo radio que primaryButton -- si uno cambia, el otro también, o la placa asoma
   *  por las esquinas del botón. */
  primaryButtonBacking: {
    borderRadius: 20,
  },
  primaryButton: {
    borderRadius: 20,
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
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: fonts.bodyRegular,
  },
  searchButton: {
    borderWidth: 2,
    borderRadius: 16,
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
    borderRadius: 14,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
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
