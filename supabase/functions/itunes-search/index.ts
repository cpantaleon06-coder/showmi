// Supabase Edge Function: búsqueda de iTunes en BATCH con caché compartido en Postgres.
//
// Por qué existe (2026-09-09): el commit del 2026-09-08 diagnosticó los 403 de iTunes y
// los mitigó desde el cliente (menos peticiones por deck, menos ráfaga, y dejar de mentir
// en la UI cuando fallaban), pero fue explícito en que NO los eliminaba: el flujo seguía
// disparando ~40 búsquedas POR BUILD contra un límite de ~20 req/min por IP, y no hay
// ajuste de cliente que cierre esa brecha. La razón es estructural, no de tuning: cada
// cliente pagaba la cuota de cero, sin compartir nada con nadie -- ni con su propio
// "cargar más" de hace treinta segundos, ni con el resto de los usuarios.
//
// Lo que cambia acá son las dos cosas que el cliente no podía cambiar solo:
//
//  1. UNA petición por deck en vez de 40. El cliente manda todas las consultas juntas.
//
//  2. Un caché que sobrevive al cliente. Los pools crudos salen de los mismos tags de
//     Last.fm y de las mismas semillas curadas, así que se solapan enormemente entre
//     builds y entre usuarios. Resuelta una vez, una consulta ya no vuelve a costar cuota
//     (hasta que expire), para nadie.
//
// HONESTIDAD SOBRE LO QUE ESTO SÍ EMPEORA: mandar todo el tráfico por acá concentra a
// todos los usuarios en una sola IP de egreso, así que la cuota de ~20/min pasa de ser
// por-usuario a ser GLOBAL. Eso solo es una ganancia porque el caché hace caer la cantidad
// de consultas DISTINTAS muy rápido; en el arranque en frío (caché vacío) esta función es
// más limitada que el cliente de antes, no menos. De ahí el presupuesto por invocación y
// el corte temprano de abajo: la respuesta correcta a una cuota agotada es servir lo que
// hay y decirlo, no seguir pegándole.
//
// Deploy: supabase functions deploy itunes-search
// Requiere: la tabla `itunes_search_cache` de schema.sql (sección 2026-09-09).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search';

/**
 * Cuánto vale una fila del caché antes de re-resolverla. Las URLs de artwork y sobre todo
 * las de preview de iTunes caducan, así que esto no es una optimización de espacio: una
 * fila vieja serviría una tarjeta con un clip muerto, que se ve peor que una búsqueda de más.
 */
const CACHE_TTL_DAYS = 30;

/**
 * Techo de búsquedas FRESCAS (las que sí pegan a iTunes) por invocación. Puesto justo en la
 * ventana real de la API a propósito: una sola invocación no debe poder dejar la cuota en
 * cero para las siguientes. Lo que exceda el presupuesto no se inventa ni se falla -- se
 * reporta como `skipped` y el cliente arma el deck con lo que sí llegó (ver la nota sobre
 * MIN_POOL_SIZE en deckPipeline.ts: el pipeline ya sabe relajar el filtro con un pool chico).
 */
const MAX_FRESH_LOOKUPS = 20;

/** Búsquedas en vuelo a la vez. No cambia la cuota (que es por minuto) pero evita la ráfaga
 *  instantánea, que es lo que Apple throttlea más agresivamente. */
const FRESH_CONCURRENCY = 4;

/**
 * Cuántos 403 seguidos hacen falta para dejar de pedir en esta invocación. Medido en vivo el
 * 2026-09-08: la cuota de iTunes es por MINUTO, así que una vez agotada la ventana, todo lo
 * que siga dentro de esa ventana falla igual. Insistir no recupera un solo candidato y sí
 * multiplica la latencia (la medición de ese día: 7s -> 33s con reintentos, misma tasa de
 * pérdida). Cortar temprano es lo único que ese dato soporta.
 */
const THROTTLE_STREAK_TO_ABORT = 2;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ItunesRawTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  primaryGenreName?: string;
  releaseDate?: string;
}

interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
  previewUrl: string | null;
  genre: string | null;
  releaseDate: string | null;
  isrc: null;
  source: 'itunes';
}

/**
 * Mismo shape exacto que `toTrack` en src/api/itunes.ts -- duplicado a mano porque Deno no
 * puede importar del bundle de React Native (mismo patrón de "vendorizado, mantener en sync"
 * que ya tienen tasteEngine.ts y los heurísticos de classify-tracks.ts). Si cambia el tipo
 * `Track` del cliente, esto tiene que cambiar con él.
 */
function toTrack(raw: ItunesRawTrack): Track {
  return {
    id: `itunes-${raw.trackId}`,
    title: raw.trackName,
    artist: raw.artistName,
    album: raw.collectionName ?? '',
    artworkUrl: (raw.artworkUrl100 ?? '').replace('100x100bb', '600x600bb'),
    previewUrl: raw.previewUrl ?? null,
    genre: raw.primaryGenreName ?? null,
    releaseDate: raw.releaseDate ?? null,
    isrc: null,
    source: 'itunes',
  };
}

// eslint-disable-next-line no-misleading-character-class
const COMBINING_MARKS = /[̀-ͯ]/g;

/** Copia exacta de normalizeForMatch (src/api/normalize.ts) -- la clave del caché DEBE
 *  calcularse igual de los dos lados, o el cliente pediría con una clave y acá se guardaría
 *  con otra, y el caché nunca acertaría. */
function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/\(feat\.?.*?\)/g, '')
    .replace(/\bfeat\.?\s.*/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cacheKey(artist: string, title: string, limit: number): string {
  return `${normalizeForMatch(artist)}::${normalizeForMatch(title)}::${limit}`;
}

class ThrottledError extends Error {}

async function searchItunes(term: string, limit: number): Promise<Track[]> {
  const url = `${ITUNES_SEARCH_URL}?term=${encodeURIComponent(term)}&entity=song&limit=${limit}`;
  const res = await fetch(url);
  // 403 es el rate limit de la Search API; se distingue del resto porque es lo único que
  // NO debe cachearse (no es "no hay resultados", es "no te dejé preguntar") y es lo que
  // dispara el corte temprano.
  if (res.status === 403 || res.status === 429) throw new ThrottledError(`iTunes throttled: ${res.status}`);
  if (!res.ok) throw new Error(`iTunes search failed: ${res.status}`);
  const json = (await res.json()) as { results: ItunesRawTrack[] };
  // Sin previewUrl la tarjeta no tiene nada que sonar, y el clip de 30s es la razón por la
  // que Showmi usa iTunes en primer lugar (ver overview: Spotify quitó preview_url en 2024).
  return json.results.filter((r) => !!r.previewUrl).map(toTrack);
}

interface QueryInput {
  artist: string;
  title: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Faltan los secrets de Supabase' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  let body: { queries?: QueryInput[]; limit?: number };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Body inválido' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const limit = Math.min(Math.max(body.limit ?? 3, 1), 25);
  // Tope de la LISTA, no solo de las búsquedas frescas. MAX_FRESH_LOOKUPS ya acota lo que se
  // le pide a iTunes, pero antes de llegar ahí esta función deduplica en un Set y consulta el
  // caché con un `in (...)` de todas las claves: mandar 50 000 queries en un POST era memoria
  // y presión sobre la base gratis, sin tocar la cuota de iTunes ni una vez.
  //
  // 200 es holgado contra el uso real: el deck pide ~40 por armado (ver rankPool en
  // useDeck.ts). Lo que sobra se recorta en silencio en vez de rechazar la petición entera --
  // un cliente legítimo nunca llega acá, y a uno abusivo no se le debe una explicación.
  const MAX_QUERIES = 200;
  const rawQueries = (body.queries ?? []).slice(0, MAX_QUERIES).filter((q) => q && q.artist && q.title);
  if (rawQueries.length === 0) {
    return new Response(JSON.stringify({ error: 'queries es requerido y no puede venir vacío' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Dedup preservando el orden en que llegaron: el cliente manda primero las sugerencias
  // similares al ancla (lo personalizado) y después el relleno por tag, así que si el
  // presupuesto se agota a media lista, lo que se sacrifica es el relleno -- no lo que hace
  // que el deck se sienta de esta persona.
  const seen = new Set<string>();
  const queries: { key: string; artist: string; title: string }[] = [];
  for (const q of rawQueries) {
    const key = cacheKey(q.artist, q.title, limit);
    if (seen.has(key)) continue;
    seen.add(key);
    queries.push({ key, artist: q.artist, title: q.title });
  }

  // Service role, no anon: `itunes_search_cache` tiene RLS sin policies a propósito (ver
  // schema.sql) -- la única puerta a esa tabla es esta función.
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const freshCutoff = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const results: Record<string, Track[]> = {};

  const { data: cached, error: cacheError } = await supabase
    .from('itunes_search_cache')
    .select('query_key, results')
    .in(
      'query_key',
      queries.map((q) => q.key),
    )
    .gte('fetched_at', freshCutoff);

  // Un caché caído no debe tumbar la búsqueda: se degrada a "todo es miss" y se sigue,
  // exactamente como se comportaba el cliente antes de que existiera esta tabla.
  if (cacheError) console.error('Lectura de caché falló, se sigue sin ella:', cacheError.message);

  for (const row of cached ?? []) {
    results[row.query_key as string] = ((row.results ?? []) as Track[]);
  }

  const misses = queries.filter((q) => results[q.key] === undefined);
  const budgeted = misses.slice(0, MAX_FRESH_LOOKUPS);
  const skipped = misses.length - budgeted.length;

  let throttled = 0;
  let failed = 0;
  let throttleStreak = 0;
  let aborted = false;
  const toCache: { query_key: string; results: Track[]; fetched_at: string }[] = [];

  let cursor = 0;
  async function worker(): Promise<void> {
    for (;;) {
      if (aborted) return;
      const i = cursor++;
      if (i >= budgeted.length) return;
      const q = budgeted[i];
      try {
        const tracks = await searchItunes(`${q.artist} ${q.title}`, limit);
        results[q.key] = tracks;
        toCache.push({ query_key: q.key, results: tracks, fetched_at: new Date().toISOString() });
        throttleStreak = 0;
      } catch (err) {
        if (err instanceof ThrottledError) {
          throttled++;
          throttleStreak++;
          // La ventana está agotada; lo que quede de esta tanda cae dentro de la misma
          // ventana y fallaría igual (medido 2026-09-08). Se corta y se responde con lo
          // que hay, que es lo único accionable.
          if (throttleStreak >= THROTTLE_STREAK_TO_ABORT) aborted = true;
        } else {
          failed++;
          throttleStreak = 0;
        }
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(FRESH_CONCURRENCY, budgeted.length)) }, worker),
  );

  // Escritura al final y en un solo upsert: lo que importa es que la próxima invocación las
  // encuentre, no que estén disponibles a mitad de esta.
  if (toCache.length > 0) {
    const { error: upsertError } = await supabase
      .from('itunes_search_cache')
      .upsert(toCache, { onConflict: 'query_key' });
    // Si el upsert falla, esta respuesta sigue siendo válida (los tracks ya están en
    // `results`); lo único que se pierde es el ahorro futuro. No es motivo para fallarle
    // al cliente que ya tiene sus candidatos en la mano.
    if (upsertError) console.error('Upsert de caché falló:', upsertError.message);
  }

  const unresolved = queries.filter((q) => results[q.key] === undefined).length;

  return new Response(
    JSON.stringify({
      results,
      stats: {
        requested: queries.length,
        // De caché: lo que no costó ni una petición a iTunes. Es la métrica que dice si
        // esto está funcionando -- debería tender a `requested` conforme el caché se llena.
        cached: (cached ?? []).length,
        fresh: toCache.length,
        // `throttled` > 0 significa que la cuota GLOBAL está agotada ahora mismo, no que el
        // cliente hizo algo mal. `skipped` es presupuesto, no cuota. El cliente los usa para
        // distinguir "no hay resultados" de "no se pudieron pedir" (ver fetchCandidatePool).
        throttled,
        failed,
        skipped,
        aborted,
        unresolved,
      },
    }),
    { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
  );
});
