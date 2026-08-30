import { supabase } from '../lib/supabase';

export interface RemotePost {
  postId: string;
  userId: string;
  trackId: string | null;
  text: string | null;
  rating: number | null;
  genreTag: string | null;
  createdAt: string;
  isOfficial: boolean;
}

/**
 * Feed real: la lectura pasa por get_feed_posts (security definer) en vez de
 * una policy de select abierta en `posts` -- ver el comentario en
 * supabase/schema.sql sobre por qué (evita tener que abrir `users` también
 * para el join). Sin `genreTags`, trae todo (fallback global).
 */
export async function fetchFeedPosts(genreTags: string[] | null, limit = 30): Promise<RemotePost[]> {
  const { data, error } = await supabase.rpc('get_feed_posts', {
    p_genre_tags: genreTags && genreTags.length > 0 ? genreTags : null,
    p_limit: limit,
  });
  if (error) {
    console.warn('[postsClient] fetchFeedPosts falló:', error.message);
    return [];
  }
  return (data ?? []).map(
    (row: {
      post_id: string;
      user_id: string;
      track_id: string | null;
      post_text: string | null;
      rating: number | null;
      genre_tag: string | null;
      created_at: string;
      is_official: boolean;
    }) => ({
      postId: row.post_id,
      userId: row.user_id,
      trackId: row.track_id,
      text: row.post_text,
      rating: row.rating,
      genreTag: row.genre_tag,
      createdAt: row.created_at,
      isOfficial: row.is_official,
    })
  );
}

/** Crea el post remoto correspondiente a un rating (swipe arriba -> estrellas). No bloqueante. */
export async function createRemotePost(trackId: string, rating: number, genreTag: string | null): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('posts').insert({
    user_id: user.id,
    track_id: trackId,
    rating,
    genre_tag: genreTag,
  });
  if (error) {
    console.warn('[postsClient] createRemotePost falló (no bloqueante):', error.message);
  }
}

/** Edita la reseña de texto de un post propio -- RLS (`auth.uid() = user_id`) rechaza cualquier otro. */
export async function updatePostText(postId: string, text: string): Promise<void> {
  const { error } = await supabase.from('posts').update({ text }).eq('id', postId);
  if (error) {
    console.warn('[postsClient] updatePostText falló (no bloqueante):', error.message);
  }
}

export interface GenreChannel {
  genreTag: string;
  postCount: number;
}

/** Canales reales del Feed -- ver comentario en schema.sql sobre por qué no es la taxonomía canónica. */
export async function fetchActiveGenreTags(limit = 12): Promise<GenreChannel[]> {
  const { data, error } = await supabase.rpc('get_active_genre_tags', { p_limit: limit });
  if (error) {
    console.warn('[postsClient] fetchActiveGenreTags falló:', error.message);
    return [];
  }
  return (data ?? []).map((row: { genre_tag: string; post_count: number }) => ({
    genreTag: row.genre_tag,
    postCount: row.post_count,
  }));
}

export interface CommunityPick {
  trackId: string;
  position: number;
  score: number;
}

/** Community Picks de la semana en curso -- vacío si todavía no hay actividad real (ver schema.sql). */
export async function fetchCommunityPicks(): Promise<CommunityPick[]> {
  const weekStart = (() => {
    const d = new Date();
    const day = d.getUTCDay();
    const diff = (day === 0 ? -6 : 1) - day; // lunes de esta semana
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() + diff);
    return monday.toISOString().slice(0, 10);
  })();

  const { data, error } = await supabase
    .from('weekly_community_picks')
    .select('track_id, position, score')
    .eq('week_start', weekStart)
    .order('position', { ascending: true });
  if (error) {
    console.warn('[postsClient] fetchCommunityPicks falló:', error.message);
    return [];
  }
  return (data ?? []).map((row) => ({ trackId: row.track_id, position: row.position, score: row.score }));
}
