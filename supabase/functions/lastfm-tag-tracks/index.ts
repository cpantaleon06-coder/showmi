// Supabase Edge Function: proxies Last.fm tag.getTopTracks. Volume source
// for the swipe deck pool (see fetchCandidatePool in src/hooks/useDeck.ts) --
// track.getSimilar around one anchor tops out around 20-60 real matches,
// nowhere near the 50-85 target pool size the product needs. Querying the
// genre's own tag directly returns a much larger, genre-scoped batch in one
// call instead of chaining similarity from a single song.
//
// Deploy: supabase functions deploy lastfm-tag-tracks
// Secret: supabase secrets set LASTFM_API_KEY=xxxx (same secret as lastfm-similar)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/';

interface TagTrackResult {
  artist: string;
  title: string;
  matchScore: number;
}

async function getTagTopTracks(tag: string, limit: number, apiKey: string): Promise<TagTrackResult[]> {
  const url = `${LASTFM_BASE}?method=tag.gettoptracks&tag=${encodeURIComponent(tag)}&api_key=${apiKey}&format=json&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  const tracks = json?.tracks?.track ?? [];
  // tag.getTopTracks doesn't return a match score (it's a popularity-ranked
  // chart, not a similarity result) -- rank position stands in as a proxy,
  // normalized 1..0 so it still sorts sensibly if ever merged with real
  // match scores from track.getSimilar.
  return tracks.map((t: any, i: number) => ({
    artist: t.artist?.name ?? '',
    title: t.name ?? '',
    matchScore: Math.max(0, 1 - i / tracks.length),
  }));
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  const apiKey = Deno.env.get('LASTFM_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'LASTFM_API_KEY not configured' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const { tag, limit } = await req.json();
  if (!tag) {
    return new Response(JSON.stringify({ error: 'tag is required' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const tracks = await getTagTopTracks(tag, Math.min(Math.max(Number(limit) || 60, 1), 200), apiKey);

  return new Response(JSON.stringify({ tracks }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
