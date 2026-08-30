// Supabase Edge Function: resolves an {artist, title} pair to a Spotify
// track id using the Client Credentials flow (app auth, not user auth).
// SPOTIFY_CLIENT_SECRET never leaves this function -- it cannot be bundled
// into the mobile app, unlike the (public-by-design) Supabase anon key.
//
// Deploy: supabase functions deploy spotify-track-link
// Secrets: supabase secrets set SPOTIFY_CLIENT_ID=xxxx SPOTIFY_CLIENT_SECRET=xxxx

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SEARCH_URL = 'https://api.spotify.com/v1/search';

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getAppAccessToken(clientId: string, clientSecret: string): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) {
    return cachedToken.accessToken;
  }

  const basic = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    throw new Error(`Spotify token request failed: ${res.status}`);
  }

  const json = await res.json();
  cachedToken = {
    accessToken: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return cachedToken.accessToken;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: 'Spotify credentials not configured' }), { status: 500 });
  }

  const { artist, title } = await req.json();
  if (!artist || !title) {
    return new Response(JSON.stringify({ error: 'artist and title are required' }), { status: 400 });
  }

  try {
    const accessToken = await getAppAccessToken(clientId, clientSecret);
    const q = encodeURIComponent(`track:${title} artist:${artist}`);
    const res = await fetch(`${SEARCH_URL}?q=${q}&type=track&limit=1`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ trackId: null }), { headers: { 'Content-Type': 'application/json' } });
    }

    const json = await res.json();
    const trackId = json?.tracks?.items?.[0]?.id ?? null;

    return new Response(JSON.stringify({ trackId }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Spotify lookup failed' }), {
      status: 502,
    });
  }
});
