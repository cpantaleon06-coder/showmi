import { useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StarIcon, TrophyIcon } from 'phosphor-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useThemeStore } from '../../src/theme/useThemeStore';
import { fonts } from '../../src/theme/typography';
import { useAuthStore } from '../../src/state/authStore';
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
import { ThemeColors } from '../../src/theme/colors';

const FOR_YOU = '__for_you__';

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
        <Text style={[styles.pickBadge, { color: colors.brand }]}>#{pick.position} DE LA SEMANA</Text>
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
        <ActivityIndicator color={colors.brand} size="small" />
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vibeRow}>
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

export default function FeedScreen() {
  const colors = useThemeStore((s) => s.colors);
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.headerRow}>
        <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Feed</Text>
        <ProfileButton colors={colors} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.channelRow}>
        <GradientChip colors={colors} label="Para ti" selected={channel === FOR_YOU} onPress={() => setChannel(FOR_YOU)} />
        {(channelsQuery.data ?? []).map((c) => (
          <GradientChip key={c.genreTag} colors={colors} label={c.genreTag} selected={channel === c.genreTag} onPress={() => setChannel(c.genreTag)} />
        ))}
      </ScrollView>

      <FlatList
        data={posts}
        keyExtractor={(p) => p.postId}
        contentContainerStyle={styles.listContent}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['feed-posts'] })}
        refreshing={postsQuery.isFetching}
        ListHeaderComponent={
          channel === FOR_YOU && (communityPicksQuery.data?.length ?? 0) > 0 ? (
            <View style={styles.picksSection}>
              <View style={styles.picksHeader}>
                <TrophyIcon weight="fill" size={16} color={colors.brand} />
                <Text style={[styles.picksTitle, { color: colors.textPrimary }]}>Community Picks de esta semana</Text>
              </View>
              {communityPicksQuery.data!.slice(0, 5).map((pick) => (
                <CommunityPickCard key={pick.trackId} pick={pick} colors={colors} />
              ))}
            </View>
          ) : null
        }
        renderItem={({ item }) => <PostCard post={item} colors={colors} isMine={item.userId === userId} />}
        ListEmptyComponent={
          postsQuery.isLoading ? (
            <ActivityIndicator color={colors.brand} size="large" style={styles.loading} />
          ) : (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Cuando califiques una canción con estrellas (swipe hacia arriba en Swipe), aparece aquí.
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  channelRow: {
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
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
    borderRadius: 10,
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
    borderRadius: 10,
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
    borderRadius: 10,
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
