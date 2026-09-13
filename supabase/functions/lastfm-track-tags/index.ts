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

// `autocorrect=1` (2026-09-13): es el parámetro que Last.fm documenta para strings escritos
// por terceros, y acá los títulos vienen de iTunes, que produce variantes constantemente
// (sufijos de remaster, "(feat. X)", acentos). Se deja puesto por correcto, PERO no resolvió
// lo que se pensaba y conviene que quede escrito para que nadie lo reintente:
//
// Medido contra el proyecto real, antes y después de activarlo: la misma muestra de 6 tracks
// dio 4/6 con tags en ambos casos. "Metallica - Enter Sandman" sigue devolviendo [] mientras
// que "Enter Sandman (Remastered)" sí devuelve -- o sea que Last.fm simplemente no tiene tags
// para esa entrada concreta, y no hay parámetro que los invente. La cobertura irregular de
// track.getTopTags es un límite de la fuente, no un bug de esta función.
//
// Importa porque estos tags son la fuente PRIMARIA de resolveCanonicalGenre y del heurístico
// de vibra (ver resolveVibra en classify-tracks): un [] acá se propaga a un track sin género
// y sin vibra. La salida real sería otra fuente de tags, no afinar ésta.
async function getTrackTopTags(artist: string, title: string, apiKey: string): Promise<string[]> {
  const url = `${LASTFM_BASE}?method=track.gettoptags&autocorrect=1&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(
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

  const body = await req.json();

  // ---------- modo BATCH (2026-09-13) ----------
  // Nace de una medición contra el backend real: armar UN deck disparaba 55 llamadas a esta
  // función, una por track del pool, y la latencia se degradaba a medida que se encolaban
  // (475 ms la primera, 1019 ms la última). Era, con diferencia, el mayor consumidor de red
  // de la app.
  //
  // Last.fm no tiene un endpoint de tags por lote, así que las peticiones a Last.fm siguen
  // siendo una por track -- lo que se elimina son los 55 ROUND TRIPS del cliente, que ahora
  // son uno. La diferencia no es menor: las 55 salían del navegador de un teléfono, y las de
  // acá salen del mismo datacenter donde corre la función.
  //
  // La respuesta va ALINEADA POR ÍNDICE con `queries`, no indexada por una clave calculada.
  // Es deliberado: itunes-search usa clave normalizada y eso obliga a duplicar exacto la
  // normalización en los dos lados (si divergen, el caché nunca acierta y falla en silencio).
  // Con el índice no hay nada que sincronizar.
  if (Array.isArray(body?.queries)) {
    const queries: { artist?: string; title?: string }[] = body.queries.slice(0, 120);
    const results: string[][] = new Array(queries.length).fill(null).map(() => []);

    // Concurrencia acotada: el límite de Last.fm ronda 5 req/s por key, y soltar 55 de golpe
    // se gana un 429 que devolvería [] para todo el pool.
    const CONCURRENCY = 5;
    let cursor = 0;
    const worker = async (): Promise<void> => {
      for (;;) {
        const i = cursor++;
        if (i >= queries.length) return;
        const q = queries[i];
        if (!q?.artist || !q?.title) continue;
        try {
          results[i] = await getTrackTopTags(q.artist, q.title, apiKey);
        } catch {
          // Un track sin tags no es un error del lote: queda [] y el resto sigue.
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queries.length) }, worker));

    return new Response(JSON.stringify({ results }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // ---------- modo individual (el de siempre) ----------
  const { artist, title } = body ?? {};
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
