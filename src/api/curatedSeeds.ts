import { CanonicalGenre } from '../lib/genres';
import { DeckAnchor, SimilarTrackSeed } from './types';

/**
 * Hand-picked anchor -> similar-track pairs, used two ways:
 *  1. As the onboarding "dame más como esta" seed options, so the very first
 *     thing a new user sees is a genuinely surprising niche result instead
 *     of whatever a live Last.fm call happens to return that day.
 *  2. As the fallback deck source in src/api/lastfm.ts while no Supabase
 *     project / Last.fm API key is wired up yet.
 *
 * One anchor per canonical genre bucket from the cosmetic-mapping table
 * (see the genre synonym table in the product spec), so no single genre —
 * regional mexicano included — reads as "the" default. Selection is always
 * random across the full set (see pickDefaultAnchor in src/hooks/useDeck.ts
 * and curatedFallback in src/api/lastfm.ts); never hardcode a pick from this
 * object elsewhere.
 *
 * PLACEHOLDER DATA: these "similar" lists are editorial best-guesses, not
 * pulled from a live Last.fm call (no API key yet). Re-validate every entry
 * against real track.getSimilar / artist.getSimilar output before the demo
 * — the whole pitch of Showmi is that this list is genuinely surprising and
 * accurate, so a stale guess here undercuts the product's core claim.
 */
export const curatedSimilarSeeds: Record<string, SimilarTrackSeed[]> = {
  // corridos_tumbados_regional
  'natanael cano::amor tumbado': [
    { artist: 'Junior H', title: 'El Azul', matchScore: 0.91 },
    { artist: 'Fuerza Regida', title: 'TQM', matchScore: 0.87 },
    { artist: 'Ivan Cornejo', title: 'Está Dañado', matchScore: 0.82 },
  ],
  // banda_norteno
  'grupo firme::el amor de su vida': [
    { artist: 'Christian Nodal', title: 'Botella Tras Botella', matchScore: 0.88 },
    { artist: 'Eslabon Armado', title: 'Ella Baila Sola', matchScore: 0.85 },
    { artist: 'Los Dos Carnales', title: 'Isa', matchScore: 0.76 },
  ],
  // reggaeton
  'bad bunny::monaco': [
    { artist: 'Rauw Alejandro', title: 'Cosa Nuestra', matchScore: 0.84 },
    { artist: 'Feid', title: 'Luna', matchScore: 0.8 },
    { artist: 'Arcángel', title: 'La Systema', matchScore: 0.74 },
  ],
  // rock_metal
  'queens of the stone age::no one knows': [
    { artist: 'Kyuss', title: 'Green Machine', matchScore: 0.87 },
    { artist: 'Them Crooked Vultures', title: 'New Fang', matchScore: 0.82 },
    { artist: 'Eagles of Death Metal', title: 'I Only Want You', matchScore: 0.75 },
  ],
  // indie_lofi
  'mac demarco::chamber of reflection': [
    { artist: 'Homeshake', title: 'Every Song I Sing', matchScore: 0.86 },
    { artist: 'Men I Trust', title: 'Show Me How', matchScore: 0.83 },
    { artist: 'Cuco', title: 'Lo Que Siento', matchScore: 0.78 },
  ],
  // electronica
  'bonobo::kerala': [
    { artist: 'Tycho', title: 'Awake', matchScore: 0.85 },
    { artist: 'Rüfüs Du Sol', title: 'Innerbloom', matchScore: 0.81 },
    { artist: 'ODESZA', title: 'Say My Name', matchScore: 0.77 },
  ],
  // jazz
  'kamasi washington::truth': [
    { artist: 'Robert Glasper', title: 'Butterfly (Mystic)', matchScore: 0.83 },
    { artist: 'BadBadNotGood', title: 'Time Moves Slow', matchScore: 0.79 },
    { artist: 'Yussef Dayes', title: 'OG Was Right', matchScore: 0.75 },
  ],
  // punk
  "the interrupters::she's kerosene": [
    { artist: 'Rancid', title: 'Ruby Soho', matchScore: 0.85 },
    { artist: 'Flogging Molly', title: 'Drunken Lullabies', matchScore: 0.8 },
    { artist: 'Streetlight Manifesto', title: 'A Better Place, A Better Time', matchScore: 0.76 },
  ],
};

/**
 * Mismos anchors de arriba, explícitamente etiquetados por género canónico
 * (no infiere del comentario/orden del objeto -- eso sería frágil) para que
 * el selector de sesión pueda anclar el deck a un género específico de
 * verdad, en vez de solo re-rankear un pool mixto.
 */
export const curatedAnchorsByGenre: Record<CanonicalGenre, DeckAnchor> = {
  corridos_tumbados_regional: { artist: 'Natanael Cano', title: 'Amor Tumbado' },
  banda_norteno: { artist: 'Grupo Firme', title: 'El Amor De Su Vida' },
  reggaeton: { artist: 'Bad Bunny', title: 'Monaco' },
  rock_metal: { artist: 'Queens of the Stone Age', title: 'No One Knows' },
  indie_lofi: { artist: 'Mac DeMarco', title: 'Chamber of Reflection' },
  electronica: { artist: 'Bonobo', title: 'Kerala' },
  jazz: { artist: 'Kamasi Washington', title: 'Truth' },
  punk: { artist: 'The Interrupters', title: "She's Kerosene" },
};

/**
 * Candidatos de "artistas de referencia" para el paso de tap del onboarding,
 * derivados de los mismos datos curados de arriba (ancla + similares) en vez
 * de una lista nueva aparte -- no hay catálogo de artistas real todavía.
 */
export function artistsForGenre(genre: CanonicalGenre): string[] {
  const anchor = curatedAnchorsByGenre[genre];
  const key = `${anchor.artist.toLowerCase()}::${anchor.title.toLowerCase()}`;
  const similar = curatedSimilarSeeds[key] ?? [];
  return [anchor.artist, ...similar.map((s) => s.artist)];
}
