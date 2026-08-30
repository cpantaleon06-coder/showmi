import { SimilarTrackSeed } from './types';
import { curatedSimilarSeeds } from './curatedSeeds';

// SDK 57 loads EXPO_PUBLIC_-prefixed vars from .env automatically at build
// time, so these are read directly off process.env -- no app.config wiring needed.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function edgeFunctionConfigured(): boolean {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
}

interface LastfmSimilarResponse {
  similar: { artist: string; title: string; matchScore: number }[];
  fellBackToArtist: boolean;
}

/**
 * Calls the `lastfm-similar` Supabase Edge Function, which holds the Last.fm
 * API key server-side (never bundled into the client) and internally falls
 * back from track.getSimilar to artist.getSimilar when the track has too few
 * scrobbles to have similarity data.
 *
 * Until EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY are set (no Supabase project
 * wired up yet), this returns hand-curated seed data so the swipe deck and
 * "dame más como esta" flow are demoable without live credentials.
 */
export async function getSimilarTracks(artist: string, title: string): Promise<SimilarTrackSeed[]> {
  if (!edgeFunctionConfigured()) {
    return curatedFallback(artist, title);
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/lastfm-similar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ artist, title }),
  });

  if (!res.ok) {
    return curatedFallback(artist, title);
  }

  const json = (await res.json()) as LastfmSimilarResponse;
  return json.similar.map((s) => ({ title: s.title, artist: s.artist, matchScore: s.matchScore }));
}

function curatedFallback(artist: string, title: string): SimilarTrackSeed[] {
  const key = `${artist.toLowerCase()}::${title.toLowerCase()}`;
  const exact = curatedSimilarSeeds[key];
  if (exact) return exact;

  // No curated entry for this anchor: surface a random curated pool so the
  // deck never comes back empty while running without live Last.fm access.
  const pools = Object.values(curatedSimilarSeeds);
  return pools[Math.floor(Math.random() * pools.length)] ?? [];
}
