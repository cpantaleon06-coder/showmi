// Supabase Edge Function: proxies Last.fm track.getTopTags. Used to resolve
// genero for a candidate from SEVERAL real community tags instead of just
// iTunes' single primaryGenreName string (see trackToCandidate in
// src/api/tasteAdapter.ts) -- the historical gap was that a track tagged
// "Latino" or "Alternative" on iTunes had no exact synonym match and never
// got a canonical genre at all, even though Last.fm's own tags for that same
// track are usually much richer and DO match.
//
// Deploy: supabase functions deploy lastfm-track-tags
// Secret: supabase secrets set LASTFM_API_KEY=xxxx (same secret as lastfm-similar)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/';

async function getTrackTopTags(artist: string, title: string, apiKey: string): Promise<string[]> {
  const url = `${LASTFM_BASE}?method=track.gettoptags&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(
    title
  )}&api_key=${apiKey}&format=json`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  const tags = json?.toptags?.tag ?? [];
  return tags.map((t: any) => t.name ?? '').filter(Boolean);
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

  const { artist, title } = await req.json();
  if (!artist || !title) {
    return new Response(JSON.stringify({ error: 'artist and title are required' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const tags = await getTrackTopTags(artist, title, apiKey);

  return new Response(JSON.stringify({ tags }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
