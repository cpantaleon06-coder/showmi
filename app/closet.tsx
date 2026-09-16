import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CrownIcon, LockSimpleIcon } from 'phosphor-react-native';

import { useThemeStore } from '../src/theme/useThemeStore';
import { fonts } from '../src/theme/typography';
import { useSubscriptionStore } from '../src/state/subscriptionStore';
import { useCamerinoStore, visibleEquipped } from '../src/state/camerinoStore';
import {
  COSMETICS,
  COSMETIC_SLOTS,
  CosmeticItem,
  GENRE_CATEGORY_ORDER,
  LEVEL_THRESHOLDS,
  MAX_LEVEL,
  levelForRatings,
  progressToNextLevel,
} from '../src/lib/cosmetics';
import { MascotShape, Mascot } from '../src/components/camerino/Mascot';
import { BackButton } from '../src/components/ui/BackButton';
import { PageTransition } from '../src/components/ui/PageTransition';
import { ThemeColors } from '../src/theme/colors';
import { radii } from '../src/theme/radii';
import { readableOn } from '../src/theme/contrast';

/** Nombres de cara al usuario. Descriptivos y no inventados ("Bloopy", "Triangulin"): son
 *  tres formas, y nombrarlas por lo que son evita que alguien tenga que tocarlas para
 *  entender cuál es cuál. */
const SHAPE_OPTIONS: { shape: MascotShape; label: string }[] = [
  { shape: 'circulo', label: 'Redonda' },
  { shape: 'triangulo', label: 'Triangular' },
  { shape: 'rombo', label: 'Rombo' },
  { shape: 'estrella', label: 'Estrella' },
];

function ProgressRow({ colors, label, ratings }: { colors: ThemeColors; label: string; ratings: number }) {
  const level = levelForRatings(ratings);
  const pct = progressToNextLevel(ratings);
  const atMax = level >= MAX_LEVEL;
  const next = atMax ? null : LEVEL_THRESHOLDS[level + 1];

  return (
    <View style={styles.progressRow}>
      <View style={styles.progressHeader}>
        <Text style={[styles.progressLabel, { color: colors.textPrimary }]}>{label}</Text>
        <Text style={[styles.progressMeta, { color: colors.textSecondary }]}>
          {atMax ? `Nivel ${level} · máximo` : `Nivel ${level} · ${ratings}/${next}`}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.surface }]}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: colors.brand }]} />
      </View>
    </View>
  );
}

/**
 * Una de las tres criaturas para elegir. La miniatura es la MASCOTA DE VERDAD, no un ícono ni
 * una silueta: es lo único que deja ver de antemano cómo te va a quedar, y ya existe como
 * componente, así que dibujar un sustituto sería más trabajo para decir menos.
 *
 * Se muestra SIN los cosméticos equipados a propósito -- acá se elige la forma, y una corona
 * puesta en las tres miniaturas taparía justo lo que hay que comparar.
 */
function ShapeCard({
  colors,
  shape,
  label,
  selected,
  onPress,
}: {
  colors: ThemeColors;
  shape: MascotShape;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`Criatura ${label}`}
      style={[
        styles.shapeCard,
        {
          // Seleccion por RELLENO, no por borde: la elegida se pinta con el color de marca
          // y las otras quedan en superficie. Misma gramatica que los chips.
          backgroundColor: selected ? colors.brand : colors.surface,
        },
      ]}
    >
      <Mascot equipped={{}} size={72} shape={shape} />
      <Text style={[styles.shapeLabel, { color: selected ? readableOn(colors.brand) : colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

function CosmeticCard({
  colors,
  item,
  unlocked,
  equipped,
  onPress,
}: {
  colors: ThemeColors;
  item: CosmeticItem;
  unlocked: boolean;
  equipped: boolean;
  onPress: () => void;
}) {
  const isMore = item.source.kind === 'more';
  // El estado ya no lo dice un borde: 'puesto' se pinta de marca y el resto queda en
  // superficie. La corona de More y el candado siguen estando arriba de la tarjeta.
  const fondo = equipped ? colors.brand : colors.surface;

  return (
    <Pressable
      onPress={onPress}
      disabled={!unlocked}
      style={[styles.card, { backgroundColor: fondo, opacity: unlocked ? 1 : 0.45 }]}
      hitSlop={4}
    >
      <View style={styles.cardTop}>
        <View style={[styles.swatch, { backgroundColor: item.color }]} />
        {!unlocked && <LockSimpleIcon weight="fill" size={14} color={colors.textSecondary} />}
        {isMore && <CrownIcon weight="fill" size={14} color={colors.premiumAccent} />}
      </View>
      <Text
        style={[styles.cardName, { color: equipped ? readableOn(colors.brand) : colors.textPrimary }]}
        numberOfLines={2}
      >
        {item.name}
      </Text>
      <Text
        style={[styles.cardHint, { color: equipped ? readableOn(colors.brand) : colors.textSecondary }]}
        numberOfLines={2}
      >
        {equipped
          ? 'Puesto'
          : item.source.kind === 'more'
            ? unlocked
              ? 'Incluido en More'
              : 'Con Showmi More'
            : unlocked
              ? 'Desbloqueado'
              : `${item.source.category} nivel ${item.source.level}`}
      </Text>
    </Pressable>
  );
}

export default function ClosetScreen() {
  const colors = useThemeStore((s) => s.colors);
  const router = useRouter();
  const isPremium = useSubscriptionStore((s) => s.isPremium);
  const ratingsByCategory = useCamerinoStore((s) => s.ratingsByCategory);
  const equipped = useCamerinoStore((s) => s.equipped);
  const toggleEquip = useCamerinoStore((s) => s.toggleEquip);
  const isUnlocked = useCamerinoStore((s) => s.isUnlocked);
  const shape = useCamerinoStore((s) => s.shape);
  const setShape = useCamerinoStore((s) => s.setShape);

  const shown = visibleEquipped(equipped, isPremium);
  const totalRatings = Object.values(ratingsByCategory).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <PageTransition>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        {/* Hermano directo del SafeAreaView, no anidado dentro del ScrollView con padding --
            mismo patrón que profile.tsx/premium.tsx, para que top:16/left:16 (ver BackButton.tsx)
            quede pegado al borde real de la pantalla en las 3 pantallas por igual. Anidarlo
            dentro de `stage` (como estaba antes) lo desplazaba ~20px extra por el padding del
            ScrollView, un blanco de toque en un lugar distinto al que las otras pantallas
            enseñan a esperar. */}
        <BackButton colors={colors} />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.stage, { backgroundColor: colors.surface }]}>
            <Mascot equipped={shown} size={180} shape={shape} />
          </View>

          <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Camerino</Text>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>TU CRIATURA</Text>
            <View style={styles.shapeRow}>
              {SHAPE_OPTIONS.map((opt) => (
                <ShapeCard
                  key={opt.shape}
                  colors={colors}
                  shape={opt.shape}
                  label={opt.label}
                  selected={shape === opt.shape}
                  onPress={() => setShape(opt.shape)}
                />
              ))}
            </View>
          </View>

          {totalRatings === 0 && (
            <Text style={[styles.note, { color: colors.textSecondary }]}>
              Califica canciones con estrellas (swipe hacia arriba) para subir de nivel y desbloquear piezas.
            </Text>
          )}

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PROGRESO POR GÉNERO</Text>
            {GENRE_CATEGORY_ORDER.map((category) => (
              <ProgressRow key={category} colors={colors} label={category} ratings={ratingsByCategory[category] ?? 0} />
            ))}
          </View>

          {COSMETIC_SLOTS.map((slot) => {
            const items = COSMETICS.filter((c) => c.slot === slot.key);
            return (
              <View key={slot.key} style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{slot.label.toUpperCase()}</Text>
                <View style={styles.grid}>
                  {items.map((item) => (
                    <CosmeticCard
                      key={item.id}
                      colors={colors}
                      item={item}
                      unlocked={isUnlocked(item.id, isPremium)}
                      equipped={shown[slot.key] === item.id}
                      onPress={() => toggleEquip(item.id)}
                    />
                  ))}
                </View>
              </View>
            );
          })}

          {!isPremium && (
            <Pressable
              onPress={() => router.push('/premium')}
              style={[styles.moreCta, { backgroundColor: colors.premiumAccent }]}
              hitSlop={8}
            >
              <CrownIcon weight="fill" size={18} color={readableOn(colors.premiumAccent)} />
              <Text style={[styles.moreCtaText, { color: readableOn(colors.premiumAccent) }]}>
                Desbloquea las piezas exclusivas con Showmi More
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  shapeRow: { flexDirection: 'row', gap: 10 },
  shapeCard: {
    flex: 1,
    borderRadius: radii.card,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
  },
  shapeLabel: { fontSize: 12, fontFamily: fonts.bodyBold },
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 20 },
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    borderRadius: radii.card,
    marginTop: 8,
  },
  screenTitle: { fontSize: 22, fontFamily: fonts.display },
  note: { fontSize: 13, fontFamily: fonts.bodyRegular, lineHeight: 19 },
  section: { gap: 10 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    letterSpacing: 0.4,
  },
  progressRow: { gap: 5 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: 13, fontFamily: fonts.bodySemiBold },
  progressMeta: { fontSize: 11, fontFamily: fonts.bodyRegular },
  track: { height: 10, borderRadius: 6, overflow: 'hidden' },
  fill: { height: '100%' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '31%',
    borderRadius: radii.card,
    padding: 9,
    gap: 5,
    minHeight: 96,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 18, height: 18, borderRadius: 5 },
  cardName: { fontSize: 12, fontFamily: fonts.bodySemiBold },
  cardHint: { fontSize: 10, fontFamily: fonts.bodyRegular, lineHeight: 13 },
  moreCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  moreCtaText: { fontSize: 13, fontFamily: fonts.bodyBold, flexShrink: 1 },
});
