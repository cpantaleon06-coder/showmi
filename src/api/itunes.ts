import { Track } from './types';

const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search';
const ITUNES_LOOKUP_URL = 'https://itunes.apple.com/lookup';

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

function upscaleArtwork(url: string | undefined): string {
  if (!url) return '';
  // iTunes serves 100x100 by default; the URL pattern accepts other sizes.
  return url.replace('100x100bb', '600x600bb');
}

function toTrack(raw: ItunesRawTrack): Track {
  return {
    id: `itunes-${raw.trackId}`,
    title: raw.trackName,
    artist: raw.artistName,
    album: raw.collectionName ?? '',
    artworkUrl: upscaleArtwork(raw.artworkUrl100),
    previewUrl: raw.previewUrl ?? null,
    genre: raw.primaryGenreName ?? null,
    releaseDate: raw.releaseDate ?? null,
    isrc: null,
    source: 'itunes',
  };
}

/**
 * Direct client-side call, no proxy — no API key required and the ~20
 * req/min rate limit isn't realistic to hit at 12-20 testers.
 */
export async function searchItunesTracks(term: string, limit = 5): Promise<Track[]> {
  const url = `${ITUNES_SEARCH_URL}?term=${encodeURIComponent(term)}&entity=song&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`iTunes search failed: ${res.status}`);
  const json = (await res.json()) as { results: ItunesRawTrack[] };
  return json.results.filter((r) => !!r.previewUrl).map(toTrack);
}

/**
 * Finds the best iTunes match for a given artist+title pair, used to turn a
 * Last.fm similar-track suggestion into a playable card. Returns null when
 * no result has a preview clip.
 */
export async function findItunesTrack(artist: string, title: string): Promise<Track | null> {
  const results = await searchItunesTracks(`${artist} ${title}`, 5);
  return results[0] ?? null;
}

export async function lookupItunesTrack(trackId: number): Promise<Track | null> {
  const url = `${ITUNES_LOOKUP_URL}?id=${trackId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`iTunes lookup failed: ${res.status}`);
  const json = (await res.json()) as { results: ItunesRawTrack[] };
  const raw = json.results[0];
  return raw ? toTrack(raw) : null;
}

/**
 * Resuelve el `track_id` con el que se guarda todo en Supabase (posts, swipes,
 * community picks -- formato "itunes-123456") de vuelta a un Track completo
 * para mostrarlo. null si el id no tiene el formato esperado o ya no existe.
 */
export async function resolveStoredTrackId(storedId: string): Promise<Track | null> {
  const match = storedId.match(/^itunes-(\d+)$/);
  if (!match) return null;
  try {
    return await lookupItunesTrack(Number(match[1]));
  } catch {
    return null;
  }
}
