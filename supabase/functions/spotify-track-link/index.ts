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

/**
 * CORS: esta función era la ÚNICA de las siete sin cabeceras CORS ni manejo de OPTIONS
 * (2026-09-13). Comprobado desde el navegador contra el proyecto real: `lastfm-similar`
 * respondía 200 y ésta fallaba con "Failed to fetch" -- el navegador bloqueaba la respuesta
 * antes de que el cliente la viera.
 *
 * O sea que en la build web NUNCA habría funcionado, ni siquiera con las credenciales de
 * Spotify puestas: el fallo por credenciales tapaba un fallo más básico. El cliente degrada a
 * una búsqueda de Spotify (ver resolveSpotifyTrackLink), así que el síntoma era silencioso --
 * el botón "abrir en Spotify" abría una búsqueda en vez de la canción exacta, siempre.
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const JSON_HEADERS = { ...CORS_HEADERS, 'Content-Type': 'application/json' };

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    // 200 con `trackId: null`, no 500. Sin credenciales configuradas no hay ningún error: hay
    // una respuesta conocida y esperada, y el cliente ya sabe qué hacer con ella (cae a una
    // búsqueda de Spotify). Devolver 500 metía este estado normal en la misma bolsa que
    // "Spotify se cayó" y ensuciaba los logs de la función con errores que no lo eran.
    // `reason` queda para poder distinguirlo al depurar, sin cambiar el contrato.
    return new Response(JSON.stringify({ trackId: null, reason: 'not_configured' }), { headers: JSON_HEADERS });
  }

  const { artist, title } = await req.json();
  if (!artist || !title) {
    return new Response(JSON.stringify({ error: 'artist and title are required' }), { status: 400, headers: JSON_HEADERS });
  }

  try {
    const accessToken = await getAppAccessToken(clientId, clientSecret);
    const q = encodeURIComponent(`track:${title} artist:${artist}`);
    const res = await fetch(`${SEARCH_URL}?q=${q}&type=track&limit=1`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ trackId: null }), { headers: JSON_HEADERS });
    }

    const json = await res.json();
    const trackId = json?.tracks?.items?.[0]?.id ?? null;

    return new Response(JSON.stringify({ trackId }), { headers: JSON_HEADERS });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Spotify lookup failed' }), {
      status: 502,
      headers: JSON_HEADERS,
    });
  }
});
