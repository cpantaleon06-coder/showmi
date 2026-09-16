/**
 * Export de una colección de la Biblioteca a una playlist de Spotify (2026-09-15).
 *
 * A diferencia de `spotify.ts` (deep-link de UNA canción vía Client Credentials, auth de app),
 * crear una playlist es una acción SOBRE la cuenta del usuario y exige auth de USUARIO
 * (Authorization Code + PKCE). Ese flujo vive en `useSpotifyExport.ts` porque necesita hooks;
 * este archivo son las llamadas puras a la Web API, ya con un access token de usuario en mano.
 *
 * La resolución de canciones (artista/título de iTunes -> URI de Spotify) SÍ se queda del lado
 * del servidor, reusando `spotify-track-link` en modo batch: así el Client Secret nunca toca el
 * dispositivo y el token de usuario solo se usa para lo que de verdad requiere permiso del
 * usuario (leer su id y escribir la playlist).
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Endpoints OAuth de Spotify. No hay OIDC discovery, así que se declaran a mano. */
export const SPOTIFY_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

/** Crear playlist privada o pública requiere estos dos scopes. `/v1/me` (id) no exige más. */
export const SPOTIFY_SCOPES = ['playlist-modify-public', 'playlist-modify-private'];

const API = 'https://api.spotify.com/v1';
/** Spotify acepta como máximo 100 URIs por POST a /tracks. */
const MAX_URIS_POR_LOTE = 100;

export type ExportStage = 'resolviendo' | 'creando' | 'agregando';

export interface ExportResult {
  playlistUrl: string;
  matched: number;
  total: number;
}

interface TrackRef {
  artist: string;
  title: string;
}

/**
 * Resuelve una lista de {artista,título} a URIs de Spotify vía la Edge Function en modo batch.
 * Preserva orden y descarta los que no tuvieron match (la función devuelve null en su posición).
 * Devuelve las URIs encontradas y cuántas de cuántas, para poder decirle al usuario "42 de 50"
 * en vez de fingir que se llevó todo.
 */
export async function resolveSpotifyUris(tracks: TrackRef[]): Promise<{ uris: string[]; matched: number; total: number }> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase no configurado');
  }
  if (tracks.length === 0) return { uris: [], matched: 0, total: 0 };

  const res = await fetch(`${SUPABASE_URL}/functions/v1/spotify-track-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ queries: tracks.map((t) => ({ artist: t.artist, title: t.title })) }),
  });
  if (!res.ok) throw new Error(`No se pudieron resolver las canciones (${res.status})`);

  const json = (await res.json()) as { results?: ({ uri: string } | null)[] };
  const results = json.results ?? [];
  const uris = results.filter((r): r is { uri: string } => !!r).map((r) => r.uri);
  return { uris, matched: uris.length, total: tracks.length };
}

async function spotify<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    // 401 = token vencido/inválido; se distingue para que el llamador pueda pedir re-login.
    const body = await res.text().catch(() => '');
    throw new SpotifyApiError(res.status, `Spotify API ${res.status} en ${path}: ${body.slice(0, 160)}`);
  }
  // Algunos endpoints (add tracks) devuelven cuerpo; /me y create sí. Ninguno vacío acá.
  return (await res.json()) as T;
}

export class SpotifyApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function getUserId(accessToken: string): Promise<string> {
  const me = await spotify<{ id: string }>(accessToken, '/me');
  return me.id;
}

async function createPlaylist(
  accessToken: string,
  userId: string,
  name: string,
  description: string,
): Promise<{ id: string; url: string }> {
  const pl = await spotify<{ id: string; external_urls: { spotify: string } }>(
    accessToken,
    `/users/${encodeURIComponent(userId)}/playlists`,
    // Privada por defecto: es la biblioteca personal de alguien, no algo que se publica sin pedirlo.
    { method: 'POST', body: JSON.stringify({ name, description, public: false }) },
  );
  return { id: pl.id, url: pl.external_urls.spotify };
}

async function addTracks(accessToken: string, playlistId: string, uris: string[]): Promise<void> {
  for (let i = 0; i < uris.length; i += MAX_URIS_POR_LOTE) {
    const lote = uris.slice(i, i + MAX_URIS_POR_LOTE);
    await spotify(accessToken, `/playlists/${playlistId}/tracks`, { method: 'POST', body: JSON.stringify({ uris: lote }) });
  }
}

/**
 * Orquesta el export completo con un access token de usuario ya obtenido. `onStage` deja que la
 * UI muestre en qué paso va (resolver es lo lento: una búsqueda por canción, aunque en batch).
 */
export async function exportCollectionToSpotify(
  accessToken: string,
  opts: { name: string; description: string; tracks: TrackRef[] },
  onStage?: (stage: ExportStage) => void,
): Promise<ExportResult> {
  onStage?.('resolviendo');
  const { uris, matched, total } = await resolveSpotifyUris(opts.tracks);
  if (uris.length === 0) {
    // Ninguna canción se encontró en Spotify: crear una playlist vacía sería basura en su
    // cuenta. Mejor fallar claro y que la UI lo explique.
    throw new NoMatchesError(total);
  }

  onStage?.('creando');
  const userId = await getUserId(accessToken);
  const playlist = await createPlaylist(accessToken, userId, opts.name, opts.description);

  onStage?.('agregando');
  await addTracks(accessToken, playlist.id, uris);

  return { playlistUrl: playlist.url, matched, total };
}

export class NoMatchesError extends Error {
  constructor(public total: number) {
    super('Ninguna de las canciones se encontró en Spotify');
  }
}
