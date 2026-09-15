// Supabase Edge Function: siembra el Feed con contenido oficial vía
// chart.getTopTracks de Last.fm, para que nunca se vea vacío en las
// primeras sesiones reales (antes de que exista actividad real de usuarios).
// Postea como el usuario marcado es_cuenta_oficial = true -- necesita el
// service role key para saltarse las policies normales de `posts`, que solo
// permiten insertar como uno mismo (auth.uid() = user_id). Ese key llega
// inyectado automáticamente por Supabase en todo Edge Function, no hace
// falta configurarlo a mano.
//
// Deploy: supabase functions deploy seed-official-feed
// Secret: supabase secrets set LASTFM_API_KEY=xxxx (mismo que lastfm-similar)
// Cron: ver 'seed-official-feed-weekly' en supabase/schema.sql
//
// Requiere que exista un usuario con es_cuenta_oficial = true -- crear
// manualmente (esta función no puede crear el auth.users que necesita, eso
// requiere el flujo normal de sign-up):
//   1. Crear la cuenta como cualquier otra (o vía Dashboard -> Authentication -> Add user)
//   2. update public.users set es_cuenta_oficial = true, display_name = 'Showmi Oficial' where id = '<ese-id>';

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/';
const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface LastfmChartTrack {
  name: string;
  artist: { name: string };
}

async function fetchTopTracks(apiKey: string, limit = 15): Promise<LastfmChartTrack[]> {
  const url = `${LASTFM_BASE}?method=chart.gettoptracks&api_key=${apiKey}&format=json&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  return json?.tracks?.track ?? [];
}

interface ItunesMatch {
  trackId: number;
  previewUrl?: string;
  primaryGenreName?: string;
}

async function resolveViaItunes(artist: string, title: string): Promise<ItunesMatch | null> {
  const url = `${ITUNES_SEARCH_URL}?term=${encodeURIComponent(`${artist} ${title}`)}&entity=song&limit=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  return json?.results?.[0] ?? null;
}

/**
 * Este job es SOLO para pg_cron. Ningún cliente tiene por qué invocarlo.
 *
 * El JWT que manda el cron es la anon key, que viaja dentro de la app, así que `verify_jwt`
 * por sí solo no distingue al cron de nadie más. Este header compartido sí.
 *
 * Falla CERRADO solo cuando el secreto ESTÁ configurado. Es a propósito, para poder desplegar
 * este código antes de tocar el cron sin dejar el job caído en el medio: mientras CRON_SECRET
 * no exista, el comportamiento es idéntico al de antes.
 */
function cronSecretRechaza(req: Request): Response | null {
  const expected = Deno.env.get('CRON_SECRET');
  if (!expected) return null;
  if (req.headers.get('x-cron-secret') === expected) return null;
  return new Response(JSON.stringify({ error: 'No autorizado' }), {
    status: 403,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const rechazo = cronSecretRechaza(req);
  if (rechazo) return rechazo;

  const lastfmKey = Deno.env.get('LASTFM_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!lastfmKey || !supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Faltan secrets (LASTFM_API_KEY y/o los de Supabase)' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: official, error: officialError } = await supabase
    .from('users')
    .select('id')
    .eq('es_cuenta_oficial', true)
    .limit(1)
    .maybeSingle();

  if (officialError || !official) {
    return new Response(
      JSON.stringify({ error: 'No existe ningún usuario con es_cuenta_oficial = true todavía (ver comentario de setup manual)' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  const topTracks = await fetchTopTracks(lastfmKey);
  let inserted = 0;
  let skipped = 0;

  for (const t of topTracks) {
    const artist = t.artist?.name;
    const title = t.name;
    if (!artist || !title) continue;

    const match = await resolveViaItunes(artist, title);
    // Sin preview no es swipeable en el deck -- no tiene caso postearla.
    if (!match?.previewUrl) {
      skipped++;
      continue;
    }
    const trackId = `itunes-${match.trackId}`;

    // No repetir la misma canción dos veces desde la cuenta oficial, aunque
    // vuelva a aparecer en el chart una semana después.
    const { data: existing } = await supabase
      .from('posts')
      .select('id')
      .eq('user_id', official.id)
      .eq('track_id', trackId)
      .maybeSingle();
    if (existing) {
      skipped++;
      continue;
    }

    const { error: insertError } = await supabase.from('posts').insert({
      user_id: official.id,
      track_id: trackId,
      genre_tag: match.primaryGenreName ?? null,
      rating: null,
      text: null,
    });
    if (!insertError) inserted++;
  }

  return new Response(JSON.stringify({ inserted, skipped, total: topTracks.length }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
