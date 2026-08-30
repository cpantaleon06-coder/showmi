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
