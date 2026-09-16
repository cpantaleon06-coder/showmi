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

  const body = await req.json().catch(() => ({}));

  // Resuelve UN {artist,title} a su track id. Devuelve null en cualquier "no encontrado"
  // (búsqueda vacía, respuesta no-OK): para el que llama, "no hay match" no es un error.
  async function resolveOne(accessToken: string, artist: string, title: string): Promise<string | null> {
    const q = encodeURIComponent(`track:${title} artist:${artist}`);
    const res = await fetch(`${SEARCH_URL}?q=${q}&type=track&limit=1`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.tracks?.items?.[0]?.id ?? null;
  }

  // ---- Modo batch: { queries: [{artist,title}] } -> { results: [{trackId,uri}|null] } ----
  // Lo usa el export a Spotify (resolver toda una colección a URIs de una vez). Preserva el
  // orden y la posición: results[i] corresponde a queries[i], con null donde no hubo match,
  // para que quien llama sepa cuántas y cuáles canciones no se pudieron llevar.
  if (Array.isArray(body.queries)) {
    // Tope duro por invocación: la Search API de Spotify limita el ritmo, y una biblioteca no
    // debería mandar miles de una. 200 cubre cualquier colección real; lo que exceda se recorta.
    const queries: { artist?: string; title?: string }[] = body.queries.slice(0, 200);
    try {
      const accessToken = await getAppAccessToken(clientId, clientSecret);
      const results: ({ trackId: string; uri: string } | null)[] = new Array(queries.length).fill(null);
      // Concurrencia acotada (mismo criterio que itunes-search): 5 a la vez, ni secuencial
      // lento ni una ráfaga que dispare el 429 de Spotify.
      const CONCURRENCIA = 5;
      let cursor = 0;
      async function worker() {
        while (cursor < queries.length) {
          const i = cursor++;
          const qy = queries[i];
          if (!qy?.artist || !qy?.title) continue;
          const trackId = await resolveOne(accessToken, qy.artist, qy.title);
          if (trackId) results[i] = { trackId, uri: `spotify:track:${trackId}` };
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONCURRENCIA, queries.length) }, worker));
      return new Response(JSON.stringify({ results }), { headers: JSON_HEADERS });
    } catch (e) {
      return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Spotify lookup failed' }), {
        status: 502,
        headers: JSON_HEADERS,
      });
    }
  }

  // ---- Modo single (contrato original, no tocar): { artist, title } -> { trackId } ----
  const { artist, title } = body;
  if (!artist || !title) {
    return new Response(JSON.stringify({ error: 'artist and title (or queries[]) are required' }), { status: 400, headers: JSON_HEADERS });
  }

  try {
    const accessToken = await getAppAccessToken(clientId, clientSecret);
    const trackId = await resolveOne(accessToken, artist, title);
    return new Response(JSON.stringify({ trackId }), { headers: JSON_HEADERS });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Spotify lookup failed' }), {
      status: 502,
      headers: JSON_HEADERS,
    });
  }
});
