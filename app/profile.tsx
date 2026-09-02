import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CrownIcon, PencilSimpleIcon, SignOutIcon, TShirtIcon, UserPlusIcon } from 'phosphor-react-native';
import { useQuery } from '@tanstack/react-query';

import { useThemeStore } from '../src/theme/useThemeStore';
import { fonts } from '../src/theme/typography';
import { useAuthStore } from '../src/state/authStore';
import { useSubscriptionStore } from '../src/state/subscriptionStore';
import { signOut } from '../src/api/authClient';
import { fetchTopSets } from '../src/api/tasteEngineClient';
import { VIBES } from '../src/lib/vibes';
import { NagaiHeader } from '../src/components/ui/NagaiHeader';
import { BackButton } from '../src/components/ui/BackButton';
import { ThemeColors } from '../src/theme/colors';

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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={chipStyles.row}>
        {children}
      </ScrollView>
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
  const router = useRouter();

  const genresQuery = useQuery({
    queryKey: ['top-genres', userId],
    queryFn: () => fetchTopSets('genero'),
    enabled: !!userId,
  });
  const artistsQuery = useQuery({
    queryKey: ['top-artists', userId],
    queryFn: () => fetchTopSets('artista'),
    enabled: !!userId,
  });
  const vibesQuery = useQuery({
    queryKey: ['top-vibes', userId],
    queryFn: () => fetchTopSets('vibra'),
    enabled: !!userId,
  });

  const hasAnyStats = (genresQuery.data?.length ?? 0) + (artistsQuery.data?.length ?? 0) + (vibesQuery.data?.length ?? 0) > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <NagaiHeader colors={colors} title="Perfil" />
      <BackButton colors={colors} />

      <ScrollView contentContainerStyle={styles.content}>
        {hasAnyStats ? (
          <>
            {(genresQuery.data?.length ?? 0) > 0 && (
              <StatSection colors={colors} title="Géneros favoritos">
                {genresQuery.data!.map((g) => (
                  <StatChip key={g.dimKey} colors={colors} label={g.dimKey.replace('genero:', '')} count={g.likedCount} />
                ))}
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

        <Pressable onPress={() => router.push('/premium')} style={[styles.row, { borderColor: colors.premiumAccent }]} hitSlop={8}>
          <CrownIcon weight="fill" size={20} color={colors.premiumAccent} />
          <Text style={[styles.rowText, { color: colors.premiumAccent }]}>
            {isPremium ? 'Showmi More ✓' : 'Hazte Showmi More'}
          </Text>
        </Pressable>

        <Pressable onPress={() => router.push('/closet')} style={[styles.row, { borderColor: colors.border }]} hitSlop={8}>
          <TShirtIcon weight="fill" size={20} color={colors.textPrimary} />
          <Text style={[styles.rowText, { color: colors.textPrimary }]}>Camerino</Text>
        </Pressable>

        <Pressable onPress={() => router.push('/edit-onboarding')} style={[styles.row, { borderColor: colors.border }]} hitSlop={8}>
          <PencilSimpleIcon weight="fill" size={20} color={colors.textPrimary} />
          <Text style={[styles.rowText, { color: colors.textPrimary }]}>Editar preferencias</Text>
        </Pressable>

        {isAnonymous ? (
          <Pressable onPress={() => router.push('/auth')} style={[styles.row, { borderColor: colors.brand }]} hitSlop={8}>
            <UserPlusIcon weight="fill" size={20} color={colors.brand} />
            <Text style={[styles.rowText, { color: colors.brand }]}>Guarda tu progreso</Text>
          </Pressable>
        ) : (
          <>
            {email && <Text style={[styles.accountEmail, { color: colors.textSecondary }]}>{email}</Text>}
            <Pressable
              onPress={() => signOut().catch(() => {})}
              style={[styles.row, { borderColor: colors.border }]}
              hitSlop={8}
            >
              <SignOutIcon weight="fill" size={20} color={colors.textPrimary} />
              <Text style={[styles.rowText, { color: colors.textPrimary }]}>Cerrar sesión</Text>
            </Pressable>
          </>
        )}

        <Pressable onPress={toggleMode} style={[styles.toggle, { borderColor: colors.brand }]} hitSlop={8}>
          <Text style={[styles.toggleText, { color: colors.brand }]}>
            Modo {mode === 'dark' ? 'oscuro' : 'claro'} — cambiar a {mode === 'dark' ? 'claro' : 'oscuro'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    gap: 20,
  },
  note: {
    fontSize: 14,
    textAlign: 'center',
    fontFamily: fonts.bodyRegular,
  },
  section: {
    width: '100%',
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 2,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    width: '100%',
    justifyContent: 'center',
  },
  rowText: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
  },
  accountEmail: {
    fontSize: 13,
    fontFamily: fonts.bodyRegular,
  },
  toggle: {
    borderWidth: 2,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  toggleText: {
    fontSize: 14,
    fontFamily: fonts.bodyBold,
  },
});

const chipStyles = StyleSheet.create({
  row: {
    gap: 8,
    paddingHorizontal: 8,
  },
  chip: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
  },
  count: {
    fontSize: 11,
    fontFamily: fonts.bodyRegular,
    marginTop: 2,
  },
});
