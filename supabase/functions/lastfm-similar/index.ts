// Supabase Edge Function: proxies Last.fm track.getSimilar / artist.getSimilar.
// Its only job is keeping LASTFM_API_KEY out of the client bundle -- no
// server-side cache or payload trimming here, React Query's client cache
// already covers this scale (12-20 testers).
//
// Deploy: supabase functions deploy lastfm-similar
// Secret: supabase secrets set LASTFM_API_KEY=xxxx

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/';

interface SimilarResult {
  artist: string;
  title: string;
  matchScore: number;
}

async function getTrackSimilar(artist: string, title: string, apiKey: string): Promise<SimilarResult[]> {
  // limit subido de 20 a 60 (2026-08-31) -- parte del rediseño para que el
  // pool de un deck llegue a 50-85 candidatos en vez de topearse en ~20 tal
  // como venía (ver comentario en fetchCandidatePool, src/hooks/useDeck.ts).
  const url = `${LASTFM_BASE}?method=track.getsimilar&autocorrect=1&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(
    title
  )}&api_key=${apiKey}&format=json&limit=60`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  const tracks = json?.similartracks?.track ?? [];
  return tracks.map((t: any) => ({
    artist: t.artist?.name ?? '',
    title: t.name ?? '',
    matchScore: Number(t.match ?? 0),
  }));
}

async function getArtistSimilar(artist: string, apiKey: string): Promise<SimilarResult[]> {
  const url = `${LASTFM_BASE}?method=artist.getsimilar&autocorrect=1&artist=${encodeURIComponent(
    artist
  )}&api_key=${apiKey}&format=json&limit=40`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  const artists = json?.similarartists?.artist ?? [];
  // artist.getsimilar has no track name -- caller resolves a representative
  // track per artist downstream (e.g. via a top-tracks lookup or iTunes search).
  return artists.map((a: any) => ({
    artist: a.name ?? '',
    title: '',
    matchScore: Number(a.match ?? 0),
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

  const { artist, title } = await req.json();
  if (!artist || !title) {
    return new Response(JSON.stringify({ error: 'artist and title are required' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  let similar = await getTrackSimilar(artist, title, apiKey);
  let fellBackToArtist = false;

  if (similar.length === 0) {
    similar = await getArtistSimilar(artist, apiKey);
    fellBackToArtist = true;
  }

  return new Response(JSON.stringify({ similar, fellBackToArtist }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
