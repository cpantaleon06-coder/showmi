import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  CaretRightIcon,
  CrownIcon,
  MoonIcon,
  PencilSimpleIcon,
  SignOutIcon,
  SunIcon,
  TShirtIcon,
  UserPlusIcon,
} from 'phosphor-react-native';
import { useQuery } from '@tanstack/react-query';

import { useThemeStore } from '../src/theme/useThemeStore';
import { fonts } from '../src/theme/typography';
import { radii } from '../src/theme/radii';
import { wordmark } from '../src/theme/wordmark';
import { readableOn } from '../src/theme/contrast';
import { useAuthStore } from '../src/state/authStore';
import { useLibraryStore } from '../src/state/libraryStore';
import { useSubscriptionStore } from '../src/state/subscriptionStore';
import { signOut } from '../src/api/authClient';
import { fetchTopSets } from '../src/api/tasteEngineClient';
import { VIBES } from '../src/lib/vibes';
import { CANONICAL_GENRES } from '../src/lib/genres';
import { ProfileCrest } from '../src/components/profile/ProfileCrest';
import { BackButton } from '../src/components/ui/BackButton';
import { PageTransition } from '../src/components/ui/PageTransition';
import { ThemeColors } from '../src/theme/colors';

/**
 * Perfil.
 *
 * 2026-09-13, rediseño a partir de tres referencias del usuario (LUSH Club, LEX, tarjetas de
 * perfil). Lo que se tomó de cada una y por qué, en vez de copiar una sola:
 *
 *  - LUSH: telón de color con borde curvo, avatar montándolo, y dos cifras flanqueándolo.
 *    También la tira de damero del pie, que cierra la pantalla en vez de dejarla desvanecerse.
 *  - LEX: la fila de cifras bajo el nombre, y la tarjeta ancha del tier de pago con su propio
 *    tratamiento de color -- lo único de la pantalla que no es del sistema neutro.
 *  - Tarjetas de perfil: el aro claro que despega el avatar del fondo de color.
 *
 * Lo que NO se copió: las tres referencias tienen foto de perfil. Showmi no tiene fotos y no
 * va a fingir que las tiene -- el avatar es la mascota con lo que esté equipado en el
 * Camerino, que además le da una razón de ser al Camerino desde acá.
 *
 * La versión anterior era una columna de filas con borde, todas del mismo peso: la que lleva
 * al paywall se veía igual que la que cambia el tema. Ahora hay jerarquía real -- una tarjeta
 * destacada, dos secundarias en rejilla, y lo administrativo al pie.
 */

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatChip({ colors, label, count }: { colors: ThemeColors; label: string; count: number }) {
  return (
    <View style={[chipStyles.chip, { borderColor: colors.border }]}>
      <Text style={[chipStyles.label, { color: colors.textPrimary }]}>{label}</Text>
      <Text style={[chipStyles.count, { color: colors.textSecondary }]}>{count}</Text>
    </View>
  );
}

function StatSection({ colors, title, children }: { colors: ThemeColors; title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
      {/* style={{flexGrow:0}}: react-native-web pone flexGrow:1 por default en <ScrollView>
          sin `style` propio -- mismo bug real que sí se manifestó en feed.tsx (ver noGrow ahí). */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.noGrow} contentContainerStyle={chipStyles.row}>
        {children}
      </ScrollView>
    </View>
  );
}

/** Una cifra de la fila bajo el nombre. El número manda y la etiqueta lo explica -- al revés
 *  (etiqueta grande, número chico) la fila deja de escanearse de un vistazo. */
function CountStat({ colors, value, label }: { colors: ThemeColors; value: number; label: string }) {
  return (
    <View style={styles.countStat}>
      <Text style={[styles.countValue, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.countLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

/** Una de las dos tarjetas secundarias de la rejilla. */
function GridCard({
  colors,
  icon,
  title,
  caption,
  accent,
  onPress,
}: {
  colors: ThemeColors;
  icon: ReactNode;
  title: string;
  caption: string;
  accent: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.gridCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.gridIcon, { borderColor: accent }]}>{icon}</View>
      <Text style={[styles.gridTitle, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.gridCaption, { color: colors.textSecondary }]} numberOfLines={2}>
        {caption}
      </Text>
    </Pressable>
  );
}

/**
 * Degradado de la tarjeta destacada, FIJO en los dos temas.
 *
 * No usa `colors.premiumAccent` porque ese token cambia con el tema (#C9A227 oscuro /
 * #8A6B14 claro) y aquí el oro es RELLENO, no primer plano -- la variante oscurecida existe
 * para que el dorado se lea como TEXTO sobre el ivory, problema que esta tarjeta no tiene.
 *
 * Usarlo igual rompía el contraste, medido: con el oro claro, el degradado iba de un naranja
 * claro a un oro oscuro, y ningún color de texto servía en los dos extremos a la vez --
 * blanco daba 2.60:1 en el naranja y tinta 3.68:1 en el oro. Con los dos extremos claros y
 * fijos, la tinta da 7.09:1 y 7.62:1.
 */
const HERO_GRADIENT: [string, string] = [wordmark.o.corner, '#C9A227'];
/** Tinta por medición, no por gusto: ver el cálculo de arriba. */
const HERO_INK = readableOn(HERO_GRADIENT[1]);

/** Fila administrativa del pie: mismo peso visual para todas, porque todas valen lo mismo. */
function QuietRow({
  colors,
  icon,
  label,
  onPress,
  tint,
}: {
  colors: ThemeColors;
  icon: ReactNode;
  label: string;
  onPress: () => void;
  tint?: string;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.quietRow, { borderColor: colors.border }]} hitSlop={6}>
      {icon}
      <Text style={[styles.quietRowText, { color: tint ?? colors.textPrimary }]}>{label}</Text>
      <CaretRightIcon weight="bold" size={15} color={colors.textSecondary} />
    </Pressable>
  );
}

/**
 * Tira de damero del pie (referencia LUSH). Cierra la pantalla con un borde duro en vez de
 * dejar que el contenido se desvanezca contra el fondo. Se dibuja con Views y no con SVG: son
 * dos filas de cuadrados planos, y un SVG acá sería más código para el mismo resultado.
 */
function CheckerStrip({ colors }: { colors: ThemeColors }) {
  const CELLS = 14;
  return (
    <View style={styles.checker} pointerEvents="none">
      {[0, 1].map((row) => (
        <View key={row} style={styles.checkerRow}>
          {Array.from({ length: CELLS }, (_, i) => (
            <View
              key={i}
              style={[
                styles.checkerCell,
                { backgroundColor: (i + row) % 2 === 0 ? colors.brand : 'transparent' },
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export default function ProfileScreen() {
  const colors = useThemeStore((s) => s.colors);
  const mode = useThemeStore((s) => s.mode);
  const toggleMode = useThemeStore((s) => s.toggleMode);
  const userId = useAuthStore((s) => s.session?.user.id);
  const isAnonymous = useAuthStore((s) => s.session?.user.is_anonymous ?? true);
  const email = useAuthStore((s) => s.session?.user.email);
  const isPremium = useSubscriptionStore((s) => s.isPremium);
  const items = useLibraryStore((s) => s.items);
  const router = useRouter();

  const genresQuery = useQuery({ queryKey: ['top-genres', userId], queryFn: () => fetchTopSets('genero'), enabled: !!userId });
  const artistsQuery = useQuery({ queryKey: ['top-artists', userId], queryFn: () => fetchTopSets('artista'), enabled: !!userId });
  const vibesQuery = useQuery({ queryKey: ['top-vibes', userId], queryFn: () => fetchTopSets('vibra'), enabled: !!userId });

  const hasAnyStats =
    (genresQuery.data?.length ?? 0) + (artistsQuery.data?.length ?? 0) + (vibesQuery.data?.length ?? 0) > 0;

  const savedCount = Object.values(items).reduce((sum, list) => sum + list.length, 0);

  /** Sin cuenta real no hay nombre que mostrar. "Invitado" es honesto y además hace que el
   *  botón de crear cuenta de abajo tenga un motivo visible; inventar un apodo lo escondería. */
  const displayName = isAnonymous ? 'Invitado' : (email?.split('@')[0] ?? 'Tu perfil');

  return (
    <PageTransition>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <BackButton colors={colors} />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ProfileCrest colors={colors} displayName={displayName} />

          <View style={styles.countsRow}>
            <CountStat colors={colors} value={savedCount} label="Guardadas" />
            <CountStat colors={colors} value={genresQuery.data?.length ?? 0} label="Géneros" />
            <CountStat colors={colors} value={artistsQuery.data?.length ?? 0} label="Artistas" />
            <CountStat colors={colors} value={vibesQuery.data?.length ?? 0} label="Vibras" />
          </View>

          {/* Tarjeta destacada. Es lo único de la pantalla con degradado propio: en la versión
              anterior el enlace al paywall era una fila más, idéntica a la de cambiar el tema. */}
          <Pressable onPress={() => router.push('/premium')} style={styles.heroWrap}>
            <LinearGradient
              colors={HERO_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.hero}
            >
              <View style={styles.heroIcon}>
                <CrownIcon weight="fill" size={22} color={HERO_INK} />
              </View>
              <View style={styles.heroText}>
                <Text style={[styles.heroTitle, { color: HERO_INK }]}>
                  {isPremium ? 'Showmi More activo' : 'Showmi More'}
                </Text>
                <Text style={[styles.heroCaption, { color: HERO_INK }]}>
                  {isPremium ? 'Gracias por tu apoyo' : 'Swipes ilimitados y cosméticos'}
                </Text>
              </View>
              <CaretRightIcon weight="bold" size={18} color={HERO_INK} />
            </LinearGradient>
          </Pressable>

          <View style={styles.grid}>
            <GridCard
              colors={colors}
              accent={wordmark.w.corner}
              icon={<TShirtIcon weight="fill" size={19} color={wordmark.w.corner} />}
              title="Camerino"
              caption="Viste a tu mascota"
              onPress={() => router.push('/closet')}
            />
            <GridCard
              colors={colors}
              accent={wordmark.h.corner}
              icon={<PencilSimpleIcon weight="fill" size={19} color={wordmark.h.corner} />}
              title="Preferencias"
              caption="Géneros, artistas y vibra"
              onPress={() => router.push('/edit-onboarding')}
            />
          </View>

          {hasAnyStats ? (
            <>
              {(genresQuery.data?.length ?? 0) > 0 && (
                <StatSection colors={colors} title="Géneros favoritos">
                  {genresQuery.data!.map((g) => {
                    // La clave canónica cruda ("reggaeton", "hip_hop_rap") es un identificador
                    // interno, no una etiqueta: se mostraba tal cual, en minúsculas, sin acento
                    // y con guiones bajos, mientras el MISMO género sale como "🎧 Reggaetón" en
                    // el onboarding y en el selector de sesión. Se resuelve contra la taxonomía
                    // igual que la fila de vibras justo abajo.
                    const key = g.dimKey.replace('genero:', '');
                    const def = CANONICAL_GENRES.find((x) => x.key === key);
                    return (
                      <StatChip
                        key={g.dimKey}
                        colors={colors}
                        label={def ? `${def.emoji} ${def.label}` : key}
                        count={g.likedCount}
                      />
                    );
                  })}
                </StatSection>
              )}
              {(artistsQuery.data?.length ?? 0) > 0 && (
                <StatSection colors={colors} title="Artistas recurrentes">
                  {artistsQuery.data!.map((a) => (
                    <StatChip key={a.dimKey} colors={colors} label={titleCase(a.dimKey.replace('artista:', ''))} count={a.likedCount} />
                  ))}
                </StatSection>
              )}
              {(vibesQuery.data?.length ?? 0) > 0 && (
                <StatSection colors={colors} title="Vibras predominantes">
                  {vibesQuery.data!.map((v) => {
                    const key = v.dimKey.replace('vibra:', '');
                    const def = VIBES.find((x) => x.key === key);
                    return <StatChip key={v.dimKey} colors={colors} label={def ? `${def.emoji} ${def.label}` : key} count={v.likedCount} />;
                  })}
                </StatSection>
              )}
            </>
          ) : (
            <Text style={[styles.note, { color: colors.textSecondary }]}>
              Tus estadísticas aparecen aquí en cuanto empieces a dar like y calificar canciones.
            </Text>
          )}

          <View style={styles.quietBlock}>
            {isAnonymous ? (
              <QuietRow
                colors={colors}
                tint={colors.brandText}
                icon={<UserPlusIcon weight="fill" size={18} color={colors.brandText} />}
                label="Guarda tu progreso"
                onPress={() => router.push('/auth')}
              />
            ) : (
              <>
                {!!email && <Text style={[styles.accountEmail, { color: colors.textSecondary }]}>{email}</Text>}
                <QuietRow
                  colors={colors}
                  icon={<SignOutIcon weight="fill" size={18} color={colors.textPrimary} />}
                  label="Cerrar sesión"
                  onPress={() => signOut().catch(() => {})}
                />
              </>
            )}

            <QuietRow
              colors={colors}
              icon={
                mode === 'dark' ? (
                  <SunIcon weight="fill" size={18} color={colors.textPrimary} />
                ) : (
                  <MoonIcon weight="fill" size={18} color={colors.textPrimary} />
                )
              }
              label={`Cambiar a modo ${mode === 'dark' ? 'claro' : 'oscuro'}`}
              onPress={toggleMode}
            />
          </View>

          <CheckerStrip colors={colors} />
        </ScrollView>
      </SafeAreaView>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 0 },

  countsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginTop: 22,
    marginBottom: 24,
  },
  countStat: { flex: 1, alignItems: 'center', gap: 1 },
  countValue: { fontSize: 21, fontFamily: fonts.display, letterSpacing: -0.4 },
  countLabel: { fontSize: 11, fontFamily: fonts.bodySemiBold },

  heroWrap: { paddingHorizontal: 22, marginBottom: 12 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: radii.card,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  heroIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,20,20,0.16)',
  },
  heroText: { flex: 1 },
  heroTitle: { fontSize: 17, fontFamily: fonts.display, letterSpacing: -0.3 },
  heroCaption: { fontSize: 12.5, fontFamily: fonts.bodySemiBold, opacity: 0.82, marginTop: 1 },

  grid: { flexDirection: 'row', gap: 12, paddingHorizontal: 22, marginBottom: 26 },
  gridCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: radii.card,
    padding: 14,
    gap: 7,
  },
  gridIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridTitle: { fontSize: 15, fontFamily: fonts.display, letterSpacing: -0.2 },
  gridCaption: { fontSize: 12, lineHeight: 16, fontFamily: fonts.bodyRegular },

  section: { width: '100%', marginBottom: 18 },
  noGrow: { flexGrow: 0 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 9,
    paddingHorizontal: 24,
  },
  note: {
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
    fontFamily: fonts.bodyRegular,
    paddingHorizontal: 34,
    marginBottom: 22,
  },

  quietBlock: { paddingHorizontal: 22, gap: 9, marginTop: 6, marginBottom: 26 },
  quietRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1.5,
    borderRadius: radii.pill,
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  quietRowText: { flex: 1, fontSize: 14, fontFamily: fonts.bodyBold },
  accountEmail: { fontSize: 12.5, fontFamily: fonts.bodyRegular, textAlign: 'center', marginBottom: 2 },

  checker: { marginTop: 4 },
  checkerRow: { flexDirection: 'row' },
  checkerCell: { flex: 1, aspectRatio: 1 },
});

const chipStyles = StyleSheet.create({
  row: { gap: 8, paddingHorizontal: 24 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1.5,
    borderRadius: radii.pill,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  label: { fontSize: 13, fontFamily: fonts.bodyBold },
  count: { fontSize: 12, fontFamily: fonts.bodySemiBold },
});
