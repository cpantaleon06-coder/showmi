import { Candidate } from '../lib/tasteEngine';
import { normalizeForMatch } from './normalize';
import { Track } from './types';

/**
 * Track (iTunes + Last.fm) -> Candidate (taste engine). Dos huecos reales frente al diseño
 * original del motor, que asumía la Track API de Spotify:
 *  - popularity: iTunes/Last.fm no la exponen. Se omite a propósito (Candidate.popularity
 *    es opcional) en vez de sintetizar un proxy — dimensionKeys() ya sabe saltarse esa
 *    dimensión cuando no viene.
 *  - artistIds: Track solo trae `artist: string` (nombre, no id estable). Se normaliza con
 *    normalizeForMatch (la misma utilidad que ya usa el matching iTunes<->Last.fm) para que
 *    variaciones de capitalización/acentos no generen claves de dimensión distintas para el
 *    mismo artista real.
 */
export function trackToCandidate(track: Track): Candidate {
  return {
    trackId: track.id,
    artistIds: [normalizeForMatch(track.artist)],
    releaseDate: track.releaseDate ?? '',
    genre: track.genre ?? undefined,
  };
}
