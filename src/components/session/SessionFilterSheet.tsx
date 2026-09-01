import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemeColors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import { CANONICAL_GENRES, CanonicalGenre } from '../../lib/genres';
import { VIBES, VibeKey } from '../../lib/vibes';
import { pickSessionGreeting } from '../../lib/greetings';
import { suggestNextSessionSelection } from '../../lib/sessionTree';
import { fetchSessionTreeProfile } from '../../api/tasteEngineClient';
import { VIBE_COLORS, getVibeColor } from '../../theme/vibeColors';
import { GradientChip } from '../ui/GradientChip';

interface SessionFilterSheetProps {
  colors: ThemeColors;
  onDone: (genre: CanonicalGenre | null, vibe: VibeKey | null) => void;
}

/**
 * Pantalla ligera antes de cargar el deck, una vez por apertura de app (ver
 * sessionFilterStore.resolvedThisSession). La elección es funcional -- se
 * pasa tal cual a useDeck (género ancla el deck, vibra alimenta
 * sessionMultipliers sobre la dimensión real vibra:x) -- no es decorativa
 * como el encabezado rotativo.
 */
export function SessionFilterSheet({ colors, onDone }: SessionFilterSheetProps) {
  const [genre, setGenre] = useState<CanonicalGenre | null>(null);
  const [vibe, setVibe] = useState<VibeKey | null>(null);
  const [greeting, setGreeting] = useState('¿Qué buscas hoy?');

  useEffect(() => {
    pickSessionGreeting().then(setGreeting);
  }, []);

  // Sugerencia basada en el árbol consolidado de sesiones previas -- si el usuario ya
  // tocó un chip a mano cuando esto resuelve, no lo pisamos (ver guards abajo).
  useEffect(() => {
    fetchSessionTreeProfile().then((profile) => {
      if (Object.keys(profile).length === 0) return;
      const suggestion = suggestNextSessionSelection(profile);
      setGenre((current) => {
        if (current !== null) return current;
        const suggested = suggestion.genero ? CANONICAL_GENRES.find((g) => g.key === suggestion.genero) : undefined;
        return suggested ? suggested.key : current;
      });
      setVibe((current) => {
        if (current !== null) return current;
        const suggestedKey = suggestion.vibras?.[0];
        const suggested = suggestedKey ? VIBES.find((v) => v.key === suggestedKey) : undefined;
        return suggested ? suggested.key : current;
      });
    });
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{greeting}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Elige vibra y/o género para esta sesión -- puedes omitirlo.
        </Text>

        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Vibra</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {VIBES.map((v) => (
            <GradientChip
              key={v.key}
              colors={colors}
              label={`${v.emoji} ${v.label}`}
              selected={vibe === v.key}
              onPress={() => setVibe(vibe === v.key ? null : v.key)}
              fillColor={VIBE_COLORS[v.key]}
            />
          ))}
        </ScrollView>

        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Género</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {CANONICAL_GENRES.map((g) => (
            <GradientChip
              key={g.key}
              colors={colors}
              label={`${g.emoji} ${g.label}`}
              selected={genre === g.key}
              onPress={() => setGenre(genre === g.key ? null : g.key)}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={() => onDone(genre, vibe)}
          style={[styles.primaryButton, { backgroundColor: getVibeColor(vibe, colors.brand) }]}
          hitSlop={8}
        >
          <Text style={styles.primaryButtonText}>{genre || vibe ? 'Empezar' : 'Deck mixto de siempre'}</Text>
        </Pressable>
        {(genre || vibe) && (
          <Pressable onPress={() => onDone(null, null)} hitSlop={8} style={styles.skip}>
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>Omitir</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: fonts.display,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 6,
    marginBottom: 28,
    fontFamily: fonts.bodyRegular,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  chipRow: {
    gap: 8,
    paddingBottom: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 12,
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
  skip: {
    alignItems: 'center',
  },
  skipText: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
  },
});
