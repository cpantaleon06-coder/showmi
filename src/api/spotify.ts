/**
 * Client Credentials flow (app auth, not user auth) resolved entirely on the
 * backend: the Spotify Client Secret must never live in the app bundle (it's
 * trivially extractable via decompilation), so the token exchange + search
 * happen in the `spotify-track-link` Supabase Edge Function, same pattern as
 * `lastfm-similar` hiding the Last.fm key. This replaces the earlier PKCE
 * user-login flow entirely -- no login, no redirect, no token storage on
 * device, and no Development Mode 5-tester limit (that limit only applies to
 * user auth, not app-only Client Credentials).
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function edgeFunctionConfigured(): boolean {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
}

export interface SpotifyTrackLink {
  trackId: string | null;
  /** `spotify:track:{id}` when trackId is known, opens the app directly. */
  appUri: string | null;
  /** Always present: an exact track page, or a search results page when no
   *  track id could be resolved (edge function not deployed/configured, or
   *  no confident match found). */
  webUrl: string;
}

/**
 * Same artist+title fuzzy-matching philosophy as the iTunes/Last.fm pairing
 * (see src/api/normalize.ts) -- the actual matching happens server-side in
 * the edge function since that's where the search call is made.
 */
export async function resolveSpotifyTrackLink(artist: string, title: string): Promise<SpotifyTrackLink> {
  const searchFallbackUrl = `https://open.spotify.com/search/${encodeURIComponent(`${artist} ${title}`)}`;

  if (!edgeFunctionConfigured()) {
    return { trackId: null, appUri: null, webUrl: searchFallbackUrl };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/spotify-track-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ artist, title }),
    });

    if (!res.ok) return { trackId: null, appUri: null, webUrl: searchFallbackUrl };

    const json = (await res.json()) as { trackId: string | null };
    if (!json.trackId) return { trackId: null, appUri: null, webUrl: searchFallbackUrl };

    return {
      trackId: json.trackId,
      appUri: `spotify:track:${json.trackId}`,
      webUrl: `https://open.spotify.com/track/${json.trackId}`,
    };
  } catch {
    return { trackId: null, appUri: null, webUrl: searchFallbackUrl };
  }
}
