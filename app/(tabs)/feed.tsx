import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CrownIcon, StarIcon, TrophyIcon } from 'phosphor-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useThemeStore } from '../../src/theme/useThemeStore';
import { fonts } from '../../src/theme/typography';
import { useAuthStore } from '../../src/state/authStore';
import { useSubscriptionStore } from '../../src/state/subscriptionStore';
import { areAdsSupportedOnThisPlatform } from '../../src/lib/ads';
import { CANONICAL_GENRES } from '../../src/lib/genres';
import { VIBES } from '../../src/lib/vibes';
import { resolveStoredTrackId } from '../../src/api/itunes';
import { fetchTopSets, registerVibeVoteRemote } from '../../src/api/tasteEngineClient';
import {
  CommunityPick,
  RemotePost,
  fetchActiveGenreTags,
  fetchCommunityPicks,
  fetchFeedPosts,
  updatePostText,
} from '../../src/api/postsClient';
import { ProfileButton } from '../../src/components/ui/ProfileButton';
import { GradientChip } from '../../src/components/ui/GradientChip';
import { SponsoredPost } from '../../src/components/ads/SponsoredPost';
import { DotGridBackground } from '../../src/components/backgrounds/DotGridBackground';
import { ThemeColors } from '../../src/theme/colors';
import { radii } from '../../src/theme/radii';
import { FLOATING_TAB_BAR_CLEARANCE } from '../../src/theme/layout';

const FOR_YOU = '__for_you__';

/** Cada cuántos posts se intercala uno patrocinado -- ver AD_INTERVAL en SwipeDeck.tsx para
 *  el contexto de "RevenueCat Ads" (RevenueCat solo trackea, el anuncio real es de AdMob, ver
 *  lib/ads.ts). Más seguido que en el deck (10) porque desplazarse por el Feed es más rápido
 *  que swipear una canción entera -- con el mismo ritmo, un ad ahí casi nunca se alcanzaría a
 *  ver en una sesión típica. */
const FEED_AD_INTERVAL = 6;

type FeedListItem = { kind: 'post'; post: RemotePost } | { kind: 'ad'; id: string };

/** Intercala un slot de anuncio cada FEED_AD_INTERVAL posts -- nunca como el primer item (se
 *  vería como que el Feed ES un anuncio) y nunca si hay muy pocos posts para que valga la pena
 *  (un ad entre 2 posts reales se siente invasivo, no "orgánico"). */
function buildFeedItems(posts: RemotePost[], showAds: boolean): FeedListItem[] {
  const items: FeedListItem[] = posts.map((post) => ({ kind: 'post', post }));
  if (!showAds || posts.length < FEED_AD_INTERVAL) return items;

  const withAds: FeedListItem[] = [];
  let adCount = 0;
  items.forEach((item, i) => {
    withAds.push(item);
    if ((i + 1) % FEED_AD_INTERVAL === 0 && i !== items.length - 1) {
      adCount += 1;
      withAds.push({ kind: 'ad', id: `ad-${adCount}` });
    }
  });
  return withAds;
}

function useResolvedTrack(trackId: string | null) {
  return useQuery({
    queryKey: ['resolved-track', trackId],
    queryFn: () => resolveStoredTrackId(trackId!),
    enabled: !!trackId,
    staleTime: 1000 * 60 * 60,
  });
}

function CommunityPickCard({ pick, colors }: { pick: CommunityPick; colors: ThemeColors }) {
  const { data: track } = useResolvedTrack(pick.trackId);
  if (!track) return null;
  return (
    <View style={[styles.pickCard, { backgroundColor: colors.surface, borderColor: colors.brand }]}>
      <Image source={{ uri: track.artworkUrl }} style={styles.artwork} contentFit="cover" />
      <View style={styles.headerText}>
        <Text style={[styles.pickBadge, { color: colors.brandText }]}>#{pick.position} DE LA SEMANA</Text>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={[styles.artist, { color: colors.textSecondary }]} numberOfLines={1}>
          {track.artist}
        </Text>
      </View>
    </View>
  );
}

function PostCard({ post, colors, isMine }: { post: RemotePost; colors: ThemeColors; isMine: boolean }) {
  const { data: track, isLoading } = useResolvedTrack(post.trackId);
  const [reviewText, setReviewTextLocal] = useState(post.text ?? '');
  const [inputFocused, setInputFocused] = useState(false);

  if (isLoading) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'center' }]}>
        <ActivityIndicator color={colors.brandText} size="small" />
      </View>
    );
  }
  if (!track) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Image source={{ uri: track.artworkUrl }} style={styles.artwork} contentFit="cover" />
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
            {track.title}
          </Text>
          <Text style={[styles.artist, { color: colors.textSecondary }]} numberOfLines={1}>
            {track.artist}
          </Text>
        </View>
        {post.isOfficial && (
          <View style={[styles.officialBadge, { backgroundColor: colors.brand }]}>
            <Text style={styles.officialBadgeText}>SHOWMI OFICIAL</Text>
          </View>
        )}
        {post.isPremium && !post.isOfficial && (
          <View style={[styles.premiumBadge, { borderColor: colors.premiumAccent }]}>
            <CrownIcon weight="fill" size={12} color={colors.premiumAccent} />
          </View>
        )}
      </View>

      {post.rating != null ? (
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((n) => (
            <StarIcon key={n} weight="fill" size={18} color={n <= post.rating! ? colors.brand : colors.textSecondary} />
          ))}
        </View>
      ) : (
        <Text style={[styles.recommended, { color: colors.textSecondary }]}>Recomendado</Text>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.noGrow} contentContainerStyle={styles.vibeRow}>
        {VIBES.map((v) => (
          <GradientChip
            key={v.key}
            colors={colors}
            label={`${v.emoji} ${v.label}`}
            selected={false}
            onPress={() => registerVibeVoteRemote(track.id, v.key).catch(() => {})}
          />
        ))}
      </ScrollView>

      {isMine ? (
        <TextInput
          value={reviewText}
          onChangeText={setReviewTextLocal}
          onFocus={() => setInputFocused(true)}
          onBlur={() => {
            setInputFocused(false);
            updatePostText(post.postId, reviewText).catch(() => {});
          }}
          placeholder="Agrega una reseña (opcional)…"
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.reviewInput,
            { color: colors.textPrimary, borderColor: inputFocused ? colors.brand : colors.border },
            inputFocused && styles.reviewInputFocused,
          ]}
          multiline
        />
      ) : (
        post.text && <Text style={[styles.reviewReadOnly, { color: colors.textPrimary }]}>{post.text}</Text>
      )}
    </View>
  );
}

/**
 * El canal viene de `posts.genre_tag`. Desde 2026-09-14 eso es la clave canónica
 * ("reggaeton"), así que se muestra con su etiqueta y su emoji, igual que en el onboarding y
 * en el Perfil.
 *
 * Los posts ANTERIORES a ese cambio guardaron el string crudo de iTunes ("Urbano latino",
 * "Música tropical") y no se pueden reescribir desde el cliente -- RLS solo deja tocar los
 * posts propios. Esos caen al `?? tag` y se siguen viendo tal cual: un canal de menos que se
 * ve raro es mejor que uno que desaparece de la barra y deja sus posts inalcanzables.
 */
function channelLabel(tag: string): string {
  const def = CANONICAL_GENRES.find((g) => g.key === tag);
  return def ? `${def.emoji} ${def.label}` : tag;
}

export default function FeedScreen() {
  const colors = useThemeStore((s) => s.colors);
  const mode = useThemeStore((s) => s.mode);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const userId = useAuthStore((s) => s.session?.user.id);
  const [channel, setChannel] = useState<string>(FOR_YOU);
  const queryClient = useQueryClient();

  const channelsQuery = useQuery({
    queryKey: ['feed-channels'],
    queryFn: () => fetchActiveGenreTags(),
    staleTime: 1000 * 60 * 10,
  });

  const topGenresQuery = useQuery({
    queryKey: ['top-genres', userId],
    queryFn: () => fetchTopSets('genero'),
    enabled: !!userId,
    staleTime: 1000 * 60 * 10,
  });

  const communityPicksQuery = useQuery({
    queryKey: ['community-picks'],
    queryFn: fetchCommunityPicks,
    staleTime: 1000 * 60 * 30,
  });

  // "Para ti" (nunca vacío): géneros del taste_profile del usuario, o el
  // Feed completo si todavía no tiene ninguno (usuario nuevo, sin swipes).
  const forYouGenres = (topGenresQuery.data ?? []).map((g) => g.dimKey.replace('genero:', ''));
  const activeGenreTags = channel === FOR_YOU ? (forYouGenres.length > 0 ? forYouGenres : null) : [channel];

  const postsQuery = useQuery({
    queryKey: ['feed-posts', activeGenreTags],
    queryFn: () => fetchFeedPosts(activeGenreTags),
    staleTime: 1000 * 30,
  });

  // Nunca vacío aunque el canal elegido no tenga nada todavía: cae al global.
  const fallbackQuery = useQuery({
    queryKey: ['feed-posts', null],
    queryFn: () => fetchFeedPosts(null),
    enabled: postsQuery.isSuccess && postsQuery.data.length === 0,
    staleTime: 1000 * 30,
  });

  const posts = postsQuery.data && postsQuery.data.length > 0 ? postsQuery.data : fallbackQuery.data ?? [];
  const isPremium = useSubscriptionStore((s) => s.isPremium);
  const showAds = !isPremium && areAdsSupportedOnThisPlatform();
  const feedItems = useMemo(() => buildFeedItems(posts, showAds), [posts, showAds]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.headerRow}>
        <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Feed</Text>
        <ProfileButton colors={colors} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.noGrow} contentContainerStyle={styles.channelRow}>
        <GradientChip colors={colors} label="Para ti" selected={channel === FOR_YOU} onPress={() => setChannel(FOR_YOU)} />
        {(channelsQuery.data ?? []).map((c) => (
          <GradientChip
            key={c.genreTag}
            colors={colors}
            label={channelLabel(c.genreTag)}
            selected={channel === c.genreTag}
            onPress={() => setChannel(c.genreTag)}
          />
        ))}
      </ScrollView>

      {/* Igual que en Biblioteca: la retícula solo existe mientras no hay posts que mostrar.
          Se excluye el estado de carga a propósito -- ahí ya hay un spinner, y montar el fondo
          para quitarlo medio segundo después sería un parpadeo, no una transición. */}
      <View style={styles.listArea}>
        {feedItems.length === 0 && !postsQuery.isLoading && (
          <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
            <DotGridBackground width={screenWidth} height={screenHeight} mode={mode} />
          </View>
        )}
        <FlatList
          data={feedItems}
          keyExtractor={(item) => (item.kind === 'post' ? item.post.postId : item.id)}
          contentContainerStyle={styles.listContent}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['feed-posts'] })}
          refreshing={postsQuery.isFetching}
          ListHeaderComponent={
            channel === FOR_YOU && (communityPicksQuery.data?.length ?? 0) > 0 ? (
              <View style={styles.picksSection}>
                <View style={styles.picksHeader}>
                  <TrophyIcon weight="fill" size={16} color={colors.brandText} />
                  <Text style={[styles.picksTitle, { color: colors.textPrimary }]}>Community Picks de esta semana</Text>
                </View>
                {communityPicksQuery.data!.slice(0, 5).map((pick) => (
                  <CommunityPickCard key={pick.trackId} pick={pick} colors={colors} />
                ))}
              </View>
            ) : null
          }
          renderItem={({ item }) =>
            item.kind === 'ad' ? (
              <SponsoredPost colors={colors} placement="feed" />
            ) : (
              <PostCard post={item.post} colors={colors} isMine={item.post.userId === userId} />
            )
          }
          ListEmptyComponent={
            postsQuery.isLoading ? (
              <ActivityIndicator color={colors.brandText} size="large" style={styles.loading} />
            ) : (
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Cuando califiques una canción con estrellas (swipe hacia arriba en Swipe), aparece aquí.
                </Text>
              </View>
            )
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listArea: {
    flex: 1,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  screenTitle: {
    fontSize: 22,
    fontFamily: fonts.display,
  },
  // react-native-web pone flexGrow:1 por default en <ScrollView> sin `style` propio -- sin
  // esto, esta fila horizontal (hermana del FlatList de posts, ambos hijos directos de un
  // contenedor flex-column sin alto fijo) se estira para repartirse el espacio libre con el
  // FlatList, dejando ~260px de fila vacía en vez de los ~40px reales del contenido. Bug real
  // encontrado en una pasada de pulido -- mismo fix aplicado también a vibeRow (dentro de cada
  // post) y a profile.tsx (sin efecto visible ahí hoy, pero mismo riesgo si el layout cambia).
  noGrow: {
    flexGrow: 0,
  },
  channelRow: {
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  listContent: {
    paddingHorizontal: 20,
    // Colchón para la isla flotante de pestañas -- ver theme/layout.ts.
    paddingBottom: FLOATING_TAB_BAR_CLEARANCE,
    gap: 12,
  },
  picksSection: {
    marginBottom: 16,
    gap: 8,
  },
  picksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  picksTitle: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
  },
  pickCard: {
    borderWidth: 2,
    borderRadius: radii.card,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  pickBadge: {
    fontSize: 10,
    fontFamily: fonts.bodyExtraBold,
    letterSpacing: 0.4,
  },
  card: {
    borderWidth: 2,
    borderRadius: radii.card,
    padding: 14,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  artwork: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontFamily: fonts.bodySemiBold,
  },
  artist: {
    fontSize: 13,
    marginTop: 2,
    fontFamily: fonts.bodyRegular,
  },
  officialBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  officialBadgeText: {
    fontSize: 10,
    letterSpacing: 0.4,
    fontFamily: fonts.bodyExtraBold,
    color: '#FFFFFF',
  },
  premiumBadge: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 5,
  },
  stars: {
    flexDirection: 'row',
    gap: 4,
  },
  recommended: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  vibeRow: {
    gap: 8,
  },
  reviewInput: {
    borderWidth: 2,
    borderRadius: radii.card,
    padding: 10,
    fontSize: 13,
    minHeight: 40,
    fontFamily: fonts.bodyRegular,
  },
  reviewInputFocused: {
    borderWidth: 2,
  },
  reviewReadOnly: {
    fontSize: 13,
    fontFamily: fonts.bodyRegular,
  },
  loading: {
    marginTop: 40,
  },
  empty: {
    paddingTop: 40,
    paddingHorizontal: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    fontFamily: fonts.bodyRegular,
  },
});
