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
/**
 * Último recurso: el género da un ánimo por defecto.
 *
 * Sigue siendo la señal MÁS DÉBIL de las tres (voto de la comunidad > tags de ánimo reales de
 * Last.fm > esto) y cualquiera de las otras dos la pisa. Lo que se asigna acá es el caso MODAL
 * honesto de cada género, no una verdad sobre ninguna canción concreta.
 *
 * 2026-09-16, ampliación medida: el mapa cubría 23 de los 53 géneros y dejaba fuera justo los
 * más grandes del catálogo real -- rock (15 canciones, 2 con vibra), hip_hop_rap (5, ninguna),
 * electronica (4, ninguna), pop y pop_latino. Con reggaeton al 100% por estar en el mapa y rock
 * al 13% por no estarlo, la "cobertura de vibra" era en realidad un reflejo de qué géneros
 * alguien había alcanzado a escribir acá.
 *
 * También se corrigió una entrada MUERTA: decía `clasica`, pero la clave canónica es
 * `classical` (ver src/lib/genres.ts), así que no matcheaba nunca.
 *
 * Ahora cubre los 53. Que estén todos NO significa que cada asignación sea igual de firme:
 * `metal -> rabia` es casi tautológico y `rock -> hype` es solo el caso más común de un género
 * anchísimo. Se acepta esa desigualdad porque la vibra se siembra a MEDIA fuerza (ver
 * ONBOARDING_VIBE_SEED_FACTOR en tasteEngine.ts) y porque el primer voto de la comunidad la
 * reemplaza. Un piso imperfecto que la gente corrige es mejor que un vacío perfecto -- es el
 * mismo criterio con que nació este mapa.
 */
const GENRE_DEFAULT_VIBE: Record<string, string> = {
  // --- Latino ---
  reggaeton: "fiesta",
  banda_norteno: "fiesta",
  cumbia: "fiesta",
  merengue: "fiesta",
  salsa: "fiesta",
  tejano: "fiesta",
  vallenato: "romantico",
  bachata: "romantico",
  boleros: "romantico",
  pop_latino: "alegre",
  ranchera_mariachi: "desahogo",
  corridos_tumbados_regional: "hype",
  trap_latino: "hype",
  // --- Urbano / Pop ---
  hip_hop_rap: "hype",
  drill: "rabia",
  rnb_soul: "sensual",
  pop: "alegre",
  k_pop: "alegre",
  j_pop: "alegre",
  mandopop_cantopop: "romantico",
  // --- Rock y derivados ---
  rock: "hype",
  metal: "rabia",
  punk: "rabia",
  emo: "melancolico",
  shoegaze_dreampop: "introspectivo",
  indie_lofi: "chill",
  // --- Electrónica ---
  electronica: "fiesta",
  house: "fiesta",
  techno: "hype",
  trance: "viaje",
  drum_and_bass: "hype",
  dubstep_bass: "hype",
  // --- Raíces ---
  jazz: "relajacion",
  blues: "melancolico",
  funk_disco: "fiesta",
  country_folk: "nostalgico",
  bluegrass: "alegre",
  classical: "enfoque",
  opera: "introspectivo",
  flamenco: "desahogo",
  ambient_new_age: "relajacion",
  gospel_cristiana: "motivacional",
  // --- Del mundo ---
  reggae: "chill",
  afrobeats: "fiesta",
  highlife: "alegre",
  soca_calypso: "fiesta",
  bossa_nova_mpb: "relajacion",
  bollywood: "alegre",
  arabic_pop: "fiesta",
  turkish_pop: "fiesta",
  nordic_pop: "melancolico",
  celtic_irish: "nostalgico",
  fado: "melancolico",
};

/**
 * Vibra por CATEGORÍA, cuando ni los tags ni el género alcanzaron.
 *
 * Nace de medir (2026-09-16): las 11 canciones que quedaban sin vibra eran exactamente las 11
 * sin género, y las 11 traían el MISMO `primaryGenreName` de iTunes: "Latin". Esa cadena se
 * deja sin resolver a género a propósito -- abarca reggaetón, salsa, bachata y boleros a la
 * vez, y mandarla a uno solo marcaría a Tito Rojas como reggaetonero. El filtro duro del deck
 * usa el género, así que ahí equivocarse le cambia a alguien el resultado de un filtro que
 * pidió.
 *
 * La vibra no tiene ese problema: se siembra a media fuerza, la pisa el primer voto de la
 * comunidad, y no filtra nada -- solo rankea. Así que de una categoría SÍ se puede sacar un
 * modo honesto aunque del género no.
 *
 * "latin" -> fiesta es el modo real de este catálogo, no una corazonada: de esas 11, 7 caerían
 * en fiesta por su género verdadero (dembow, reggaetón, salsa), 2 en hype y 2 en romántico.
 * Acertar 7 de 11 en una señal débil y corregible es mejor que dejar 11 en cero.
 *
 * Esto NO asigna género. Devuelve solo vibra, y a propósito.
 */
const CATEGORY_DEFAULT_VIBE: Record<string, string> = {
  latin: "fiesta",
};

function resolveVibra(tags: string[], genero: string | null, itunesGenre: string | null): string | null {
  const normalized = tags.filter((t): t is string => !!t).map((t) => t.toLowerCase().trim());
  for (const [key, synonyms] of Object.entries(VIBE_TAG_SYNONYMS)) {
    if (synonyms.some((tag) => normalized.includes(tag))) return key;
  }
  const porGenero = genero ? (GENRE_DEFAULT_VIBE[genero] ?? null) : null;
  if (porGenero) return porGenero;
  // Último recurso: la categoría cruda de iTunes.
  const cat = (itunesGenre ?? "").toLowerCase().trim();
  return CATEGORY_DEFAULT_VIBE[cat] ?? null;
}

// ---------- fuentes externas ----------

async function pedirTags(url: string): Promise<string[]> {
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  const tags = json?.toptags?.tag ?? [];
  return tags.map((t: any) => t.name ?? '').filter(Boolean);
}

/**
 * Tags de Last.fm para una canción, con respaldo al ARTISTA cuando la canción no tiene ninguno.
 *
 * Medido sobre el catálogo real (2026-09-16): `track.gettoptags` devuelve vacío para buena
 * parte del urbano/latino -- las canciones recientes simplemente no acumulan etiquetas. Eso
 * dejaba `resolveVibra` sin su ÚNICA señal buena (palabras de ánimo escritas por gente que
 * escuchó: "party", "sad", "chill") y lo obligaba a caer al mapa por género, que es una señal
 * mucho más débil.
 *
 * El artista casi siempre sí tiene tags. No son tan precisos -- describen una obra entera, no
 * una canción -- por eso van SOLO como respaldo y nunca pisan los de la canción. Pero un tag
 * de artista real es mejor señal que adivinar por género, que es lo que pasaba antes.
 *
 * Devuelve las dos listas POR SEPARADO a propósito. Al principio se devolvían mezcladas y el
 * mismo array alimentaba género y vibra; medido, eso subía la cobertura de género de 51% a 95%,
 * pero por la razón equivocada: una balada de un reggaetonero heredaba "reggaeton" del catálogo
 * de su autor. El género manda en el filtro duro del deck, así que ahí una etiqueta prestada no
 * es cosmética -- le cambia el resultado a un filtro que la persona pidió explícitamente. Quien
 * llama decide: género solo con `deCancion`, vibra con el respaldo.
 */
async function getTrackTopTags(
  artist: string,
  title: string,
  apiKey: string
): Promise<{ deCancion: string[]; deArtista: string[] }> {
  const deCancion = await pedirTags(
    `${LASTFM_BASE}?method=track.gettoptags&autocorrect=1&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(
      title
    )}&api_key=${apiKey}&format=json`
  );
  // Solo se pide el respaldo si hace falta: una petición menos por canción cuando ya hay tags.
  if (deCancion.length > 0) return { deCancion, deArtista: [] };

  const deArtista = await pedirTags(
    `${LASTFM_BASE}?method=artist.gettoptags&autocorrect=1&artist=${encodeURIComponent(artist)}&api_key=${apiKey}&format=json`
  );
  return { deCancion, deArtista };
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

    const { deCancion, deArtista } = await getTrackTopTags(itunes.artist, itunes.title, lastfmKey);

    // GÉNERO: solo tags de la CANCIÓN. Los del artista describen su obra entera, y usarlos acá
    // haría que una balada de un reggaetonero se etiquetara reggaeton. El género manda en el
    // filtro duro del deck (qué canciones ve la persona), así que una etiqueta equivocada acá
    // no es cosmética: le cambia el resultado de un filtro que pidió explícitamente.
    const genero = resolveGenero(deCancion, itunes.genre);
    const { error: upsertError } = await supabase.from('track_catalog').upsert({
      track_id: trackId,
      title: itunes.title,
      artist: itunes.artist,
      release_date: itunes.releaseDate,
      idioma: resolveIdioma(itunes.title, itunes.artist),
      epoca: resolveEpoca(itunes.releaseDate),
      genero,
      // Piso provisional: el voto de la comunidad lo pisa cuando existe (ver resolveVibra).
      // VIBRA: tags de la canción y, si no hay, los del artista. Acá el respaldo sí conviene --
      // el ánimo de un artista es mucho más estable a lo largo de su obra que su subgénero, y
      // la alternativa era caer al mapa por género, que es una señal todavía más débil.
      vibra: resolveVibra(deCancion.length > 0 ? deCancion : deArtista, genero, itunes.genre),
      classified_at: new Date().toISOString(),
    });

    if (upsertError) skipped++;
    else classified++;
  }

  return new Response(JSON.stringify({ pending: trackIds.length, classified, skipped }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
