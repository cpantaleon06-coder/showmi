import { VibeKey } from '../lib/vibes';

export interface Track {
  /** Stable id for this card in the deck: `itunes-<trackId>` */
  id: string;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
  previewUrl: string | null;
  genre: string | null;
  releaseDate: string | null;
  /** Only present when Spotify's own response exposed it under external_ids */
  isrc: string | null;
  source: 'itunes';
  /**
   * Vibra canónica votada por la comunidad (`track_canonical_vibe`), adjuntada por
   * useDeck.rankPool -- que ya la consultaba en batch para rankear, pero antes la
   * descartaba al devolver Track[]. Opcional porque solo existe con suficientes votos, y
   * porque los Tracks que NO pasan por el deck (búsqueda de iTunes en el onboarding,
   * resolveStoredTrackId en el Feed) nunca la traen. Hoy la consume el halo reactivo de
   * SwipeCard, ver theme/glow.ts.
   */
  vibe?: VibeKey | null;
}

export interface SimilarTrackSeed {
  title: string;
  artist: string;
  /** Last.fm match score 0-1, used to order the deck */
  matchScore: number;
}

export interface DeckAnchor {
  artist: string;
  title: string;
}
