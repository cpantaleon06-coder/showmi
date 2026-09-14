// Supabase Edge Function: job de clasificación por lote (idioma/época/género) --
// sección 9 del prompt de decisiones ("workflow con Deno"), disparado por
// pg_cron (ver el `cron.schedule('classify-tracks-daily', ...)` agregado a
// schema.sql), nunca directo desde el cliente.
//
// Por qué existe: hasta ahora idioma/época/género se resolvían en el CLIENTE,
// en cada armado de deck, para cada candidato -- funciona (ver
// src/api/tasteAdapter.ts), pero recalcula lo mismo una y otra vez para el
// mismo track_id entre sesiones/usuarios distintos, y deja la puerta cerrada
// a mejorar el idioma más adelante (ej. MusicBrainz real) sin tocar el
// cliente. Este job resuelve UNA VEZ por track y lo cachea en `track_catalog`
// -- el cliente (ver fetchTrackCatalog en tasteEngineClient.ts) prefiere ese
// valor cacheado cuando existe, y solo cae al heurístico local si el track
// todavía no pasó por acá.
//
// idioma/época usan EXACTAMENTE el mismo heurístico/bucketing que
// src/lib/idiomas.ts / src/lib/epocas.ts (Deno no puede importar del bundle
// RN, así que está duplicado a mano -- mismo patrón de "vendorizado, mantener
// en sync" que tasteEngine.ts). género usa la misma tabla de sinónimos que
// src/lib/genres.ts (53 entradas, generada desde ese archivo, NO escrita a
// mano -- si esa lista cambia, hay que regenerar esto).
//
// Deploy: supabase functions deploy classify-tracks
// Secret: supabase secrets set LASTFM_API_KEY=xxxx (mismo secret que las otras lastfm-*)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/';
const ITUNES_LOOKUP_URL = 'https://itunes.apple.com/lookup';

// ---------- idioma (copia de src/lib/idiomas.ts) ----------

const SPANISH_ACCENT_CHARS = /[áéíóúñ¿¡]/i;
const SPANISH_STOPWORDS = [
  'el', 'la', 'los', 'las', 'de', 'del', 'que', 'con', 'por', 'para',
  'sin', 'mi', 'tu', 'su', 'te', 'me', 'se', 'es', 'un', 'una', 'y',
  'amor', 'corazon', 'vida', 'noche', 'nunca', 'siempre',
];
const SPANISH_STOPWORD_RE = new RegExp(`\\b(${SPANISH_STOPWORDS.join('|')})\\b`, 'i');

function resolveIdioma(title: string, artist: string): string | null {
  const text = `${title ?? ''} ${artist ?? ''}`.trim();
  if (!text) return null;
  if (SPANISH_ACCENT_CHARS.test(text) || SPANISH_STOPWORD_RE.test(text)) return 'es';
  return 'en';
}

// ---------- época (copia de src/lib/epocas.ts) ----------

function resolveEpoca(releaseDate: string | null | undefined): string | null {
  if (!releaseDate) return null;
  const year = parseInt(releaseDate.slice(0, 4), 10);
  if (Number.isNaN(year)) return null;
  if (year >= 2020) return '2020s';
  if (year >= 2010) return '2010s';
  if (year >= 2000) return '2000s';
  if (year >= 1990) return '1990s';
  if (year >= 1980) return '1980s';
  return 'clasico';
}

// ---------- género (generado desde src/lib/genres.ts, 53 entradas) ----------

const GENRE_SYNONYMS: Record<string, string[]> = {
  corridos_tumbados_regional: ["corridos tumbados", "corrido tumbado", "corrido bélico", "sad sierreño", "sierreño", "corridos"],
  banda_norteno: ["banda", "norteño", "banda sinaloense", "grupero", "regional mexicano", "musica mexicana", "regional mexican"],
  reggaeton: ["reggaeton", "reggaetón", "urbano latino", "latin urban", "perreo"],
  trap_latino: ["trap latino", "latin trap", "trap en español"],
  salsa: ["salsa", "salsa romantica", "salsa dura", "musica tropical", "salsa y tropical", "tropical"],
  bachata: ["bachata", "bachata romantica"],
  cumbia: ["cumbia", "cumbia sonidera", "cumbia pop"],
  vallenato: ["vallenato", "vallenato romantico"],
  merengue: ["merengue", "merengue tipico"],
  ranchera_mariachi: ["ranchera", "rancheras", "mariachi"],
  tejano: ["tejano", "tex-mex"],
  boleros: ["bolero", "boleros"],
  pop_latino: ["pop latino", "latin pop", "latino"],
  rock: ["rock", "alternative rock", "grunge", "classic rock", "hard rock", "alternative", "alternativa", "alt rock", "rock and roll", "garage rock"],
  metal: ["metal", "heavy metal", "thrash metal", "death metal", "metalcore", "black metal", "doom metal"],
  indie_lofi: ["indie", "indie pop", "indie rock", "lo-fi", "lofi", "bedroom pop", "chillhop"],
  emo: ["emo", "emo pop", "screamo"],
  shoegaze_dreampop: ["shoegaze", "dream pop", "dreampop"],
  pop: ["pop", "pop rock", "dance pop", "synth-pop", "electropop", "power pop", "teen pop"],
  hip_hop_rap: ["hip hop", "hip-hop", "rap", "trap", "boom bap", "gangsta rap", "alternative rap", "alternative hip hop"],
  drill: ["drill", "uk drill", "brooklyn drill"],
  rnb_soul: ["r&b", "rnb", "soul", "neo soul", "contemporary rnb", "motown"],
  electronica: ["electronic", "electronica", "edm", "synthwave", "dance", "electro", "idm"],
  house: ["house", "deep house", "tech house"],
  techno: ["techno", "minimal techno", "acid techno"],
  trance: ["trance", "progressive trance", "psytrance"],
  dubstep_bass: ["dubstep", "bass music", "drumstep"],
  drum_and_bass: ["drum and bass", "dnb", "jungle"],
  jazz: ["jazz", "smooth jazz", "jazz fusion", "bebop", "nu jazz"],
  blues: ["blues", "delta blues", "electric blues"],
  k_pop: ["k-pop", "kpop", "korean pop"],
  j_pop: ["j-pop", "jpop", "japanese pop"],
  mandopop_cantopop: ["mandopop", "cantopop", "chinese pop"],
  bollywood: ["bollywood", "indian pop", "hindi pop"],
  arabic_pop: ["arabic pop", "khaleeji", "arab pop"],
  turkish_pop: ["turkish pop", "pop turco", "türkçe pop"],
  bossa_nova_mpb: ["bossa nova", "mpb", "musica popular brasileira"],
  soca_calypso: ["soca", "calypso"],
  nordic_pop: ["nordic pop", "scandipop", "swedish pop"],
  country_folk: ["country", "folk", "americana", "singer-songwriter", "folk rock", "indie folk", "singer/songwriter", "singer songwriter"],
  classical: ["classical", "orchestral", "soundtrack"],
  opera: ["opera", "aria"],
  flamenco: ["flamenco", "flamenco pop"],
  bluegrass: ["bluegrass", "old-time"],
  ambient_new_age: ["ambient", "new age", "meditation"],
  funk_disco: ["funk", "disco", "boogie", "nu disco"],
  reggae: ["reggae", "dancehall", "dub", "ska"],
  afrobeats: ["afrobeats", "afropop", "amapiano"],
  highlife: ["highlife", "west african highlife"],
  celtic_irish: ["celtic", "irish folk", "irish traditional"],
  fado: ["fado", "fado portugues"],
  gospel_cristiana: ["gospel", "christian", "musica cristiana"],
  punk: ["punk", "punk rock", "pop punk", "hardcore punk", "hardcore", "skate punk"],
};

// GENERADO por scripts/sync-classify-genres.ts desde src/lib/genres.ts -- no editar a mano.
// normalizeTag y resolveGenero son copia literal de ese archivo: minúsculas, NFD para que los
// acentos caigan con el resto de lo no alfanumérico, y comparación EXACTA sobre el token
// completo (con substring, "pop" matchearía k-pop, j-pop y pop punk). Partir por "/" no
// afloja nada -- iTunes compone "Hip-Hop/Rap" donde cada mitad es una etiqueta entera.
function normalizeTag(tag: string): string {
  return tag.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
}

const NORMALIZED_SYNONYMS: { key: string; tags: Set<string> }[] = Object.entries(GENRE_SYNONYMS).map(
  ([key, tags]) => ({ key, tags: new Set(tags.map(normalizeTag)) }),
);

// banda_norteno se revisa último (mismo orden que resolveCanonicalGenre en src/lib/genres.ts)
// -- "regional mexicano" es el cajón paraguas y solo debe ganar si nada más específico matcheó.
function resolveGenero(tags: string[], itunesGenre: string | null): string | null {
  const candidates = new Set<string>();
  for (const raw of [itunesGenre, ...tags]) {
    if (!raw) continue;
    candidates.add(normalizeTag(raw));
    if (raw.includes('/')) for (const part of raw.split('/')) candidates.add(normalizeTag(part));
  }
  candidates.delete('');

  for (const genre of NORMALIZED_SYNONYMS) {
    if (genre.key === 'banda_norteno') continue;
    for (const tag of genre.tags) if (candidates.has(tag)) return genre.key;
  }
  const banda = NORMALIZED_SYNONYMS.find((g) => g.key === 'banda_norteno');
  if (banda) for (const tag of banda.tags) if (candidates.has(tag)) return 'banda_norteno';
  return null;
}

// ---------- vibra provisional (2026-09-12) ----------
//
// PISO, NO VERDAD. La vibra de una canción es subjetiva y la fuente de autoridad sigue siendo
// el voto de la comunidad (`track_canonical_vibe`), que pisa esto cuando existe. Esto solo
// existe porque sin él la dimensión entera estaba muerta: medido el 2026-09-12, ninguna canción
// llegaba nunca a los votos necesarios, así que el filtro por vibra no matcheaba nada, el motor
// nunca aprendía vibra, y la app se disculpaba ("había pocas canciones de esa vibra") en cada
// sesión. Un piso imperfecto que la gente puede corregir es mejor que un vacío perfecto.
//
// Se resuelve por tags reales de Last.fm primero (la gente etiqueta ánimo: "party", "sad",
// "chill"), y solo si eso no da nada se cae al género -- que es una señal mucho más débil
// (no todo el reggaetón es de fiesta) y por eso va última, nunca al revés.
const VIBE_TAG_SYNONYMS: Record<string, string[]> = {
  fiesta: ["party", "fiesta", "dance party", "club", "perreo", "rumba"],
  hype: ["hype", "energetic", "banger", "turn up", "adrenaline"],
  motivacional: ["motivational", "workout", "gym", "training", "inspirational"],
  empoderamiento: ["empowerment", "empowering", "confidence", "badass"],
  alegre: ["happy", "feel good", "upbeat", "cheerful", "sunny"],
  viaje: ["road trip", "driving", "travel", "summer drive"],
  romantico: ["romantic", "love", "love song", "romantica", "amor"],
  enamorado: ["in love", "crush", "sweet", "wedding"],
  sensual: ["sensual", "sexy", "seductive", "slow jam", "bedroom"],
  heartbreak: ["heartbreak", "breakup", "heartbroken", "desamor", "despecho"],
  chill: ["chill", "chillout", "lo-fi", "lofi", "laid back", "mellow"],
  relajacion: ["relax", "relaxing", "calm", "ambient", "sleep", "meditation"],
  introspectivo: ["introspective", "reflective", "deep", "contemplative"],
  enfoque: ["focus", "study", "concentration", "instrumental study"],
  rabia: ["angry", "aggressive", "rage", "hardcore", "brutal"],
  desahogo: ["catharsis", "cathartic", "venting", "screamo"],
  melancolico: ["melancholy", "melancholic", "sad", "triste", "somber"],
  nostalgico: ["nostalgia", "nostalgic", "throwback", "oldies", "memories"],
};

/** Último recurso: el género da un ánimo por defecto. Deliberadamente parcial -- solo los
 *  géneros donde el sesgo de ánimo es fuerte y poco discutible. Un género que no está acá
 *  simplemente no recibe vibra provisional, que es preferible a inventarle una. */
const GENRE_DEFAULT_VIBE: Record<string, string> = {
  reggaeton: "fiesta",
  banda_norteno: "fiesta",
  cumbia: "fiesta",
  merengue: "fiesta",
  salsa: "fiesta",
  bachata: "romantico",
  boleros: "romantico",
  ranchera_mariachi: "desahogo",
  corridos_tumbados_regional: "hype",
  trap_latino: "hype",
  drill: "rabia",
  metal: "rabia",
  punk: "rabia",
  emo: "melancolico",
  shoegaze_dreampop: "introspectivo",
  indie_lofi: "chill",
  house: "fiesta",
  techno: "hype",
  trance: "viaje",
  drum_and_bass: "hype",
  dubstep_bass: "hype",
  jazz: "relajacion",
  blues: "melancolico",
  clasica: "enfoque",
};

function resolveVibra(tags: string[], genero: string | null): string | null {
  const normalized = tags.filter((t): t is string => !!t).map((t) => t.toLowerCase().trim());
  for (const [key, synonyms] of Object.entries(VIBE_TAG_SYNONYMS)) {
    if (synonyms.some((tag) => normalized.includes(tag))) return key;
  }
  return genero ? (GENRE_DEFAULT_VIBE[genero] ?? null) : null;
}

// ---------- fuentes externas ----------

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

interface ItunesLookupResult {
  title: string;
  artist: string;
  releaseDate: string | null;
  genre: string | null;
}

async function lookupItunes(itunesId: string): Promise<ItunesLookupResult | null> {
  const res = await fetch(`${ITUNES_LOOKUP_URL}?id=${itunesId}`);
  if (!res.ok) return null;
  const json = await res.json();
  const raw = json?.results?.[0];
  if (!raw) return null;
  return {
    title: raw.trackName ?? '',
    artist: raw.artistName ?? '',
    releaseDate: raw.releaseDate ?? null,
    genre: raw.primaryGenreName ?? null,
  };
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BATCH_SIZE = 50;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const lastfmKey = Deno.env.get('LASTFM_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!lastfmKey || !supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Faltan secrets (LASTFM_API_KEY y/o los de Supabase)' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Service role, no anon key -- este job escribe en track_catalog (tabla de solo-lectura
  // para el cliente, ver policy en schema.sql) y necesita saltarse esa RLS a propósito.
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: pending, error: pendingError } = await supabase.rpc('get_unclassified_track_ids', {
    p_limit: BATCH_SIZE,
  });
  if (pendingError) {
    return new Response(JSON.stringify({ error: pendingError.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const trackIds: string[] = (pending ?? []).map((row: { track_id: string }) => row.track_id);
  let classified = 0;
  let skipped = 0;

  for (const trackId of trackIds) {
    const match = trackId.match(/^itunes-(\d+)$/);
    if (!match) {
      skipped++;
      continue;
    }

    const itunes = await lookupItunes(match[1]);
    if (!itunes) {
      skipped++;
      continue;
    }

    const tags = await getTrackTopTags(itunes.artist, itunes.title, lastfmKey);

    const genero = resolveGenero(tags, itunes.genre);
    const { error: upsertError } = await supabase.from('track_catalog').upsert({
      track_id: trackId,
      title: itunes.title,
      artist: itunes.artist,
      release_date: itunes.releaseDate,
      idioma: resolveIdioma(itunes.title, itunes.artist),
      epoca: resolveEpoca(itunes.releaseDate),
      genero,
      // Piso provisional: el voto de la comunidad lo pisa cuando existe (ver resolveVibra).
      vibra: resolveVibra(tags, genero),
      classified_at: new Date().toISOString(),
    });

    if (upsertError) skipped++;
    else classified++;
  }

  return new Response(JSON.stringify({ pending: trackIds.length, classified, skipped }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
