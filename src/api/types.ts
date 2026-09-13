import { CanonicalGenre } from '../lib/genres';
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
  /**
   * Género CANÓNICO ya resuelto, adjuntado por useDeck.rankPool -- que lo calcula con los
   * tags reales de Last.fm + el catálogo server-side, cosa que quien recibe un Track suelto
   * no puede reproducir.
   *
   * Existe por el mismo motivo que `vibe` de arriba, y por un bug concreto (2026-09-09): al
   * rankear, el género canónico se resolvía con tags + catálogo; al registrar el swipe se
   * volvía a resolver con solo el string de iTunes. El MISMO track terminaba con un género
   * distinto según si lo estabas viendo o calificándolo, así que el motor aprendía sobre una
   * categoría y el filtro decidía sobre otra. Adjuntarlo acá deja una sola resolución por
   * track y hace imposible que las dos rutas se separen otra vez.
   */
  genero?: CanonicalGenre | null;
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
