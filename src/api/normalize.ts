/**
 * iTunes Search never exposes ISRC, so artist+title fuzzy matching is the
 * primary way to line up a Last.fm similarity result with an iTunes track.
 * ISRC (when Spotify exposes it under external_ids) is only a secondary,
 * opportunistic check elsewhere — never the primary key.
 */
// eslint-disable-next-line no-misleading-character-class
const COMBINING_MARKS = /[̀-ͯ]/g;

export function normalizeForMatch(value: string): string {
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

export function isLikelyMatch(a: { title: string; artist: string }, b: { title: string; artist: string }): boolean {
  const titleA = normalizeForMatch(a.title);
  const titleB = normalizeForMatch(b.title);
  const artistA = normalizeForMatch(a.artist);
  const artistB = normalizeForMatch(b.artist);

  const titleMatches = titleA === titleB || titleA.includes(titleB) || titleB.includes(titleA);
  const artistMatches = artistA === artistB || artistA.includes(artistB) || artistB.includes(artistA);

  return titleMatches && artistMatches;
}
