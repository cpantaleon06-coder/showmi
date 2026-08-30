/**
 * Vibra: quinta dimensión del taste engine, votada por la comunidad (ver
 * `track_vibe_votes`/`track_canonical_vibe` en supabase/schema.sql). No es
 * una heurística vía género -- es un valor real por track, igual de "primera
 * clase" que artista/década/popularidad/género en dimensionKeys().
 *
 * Taxonomía cerrada a propósito, igual que del lado de la base de datos: si
 * cambia, el costo es tocar esta lista Y el check constraint de
 * track_vibe_votes, nunca solo uno de los dos.
 */
export type VibeKey =
  | 'fiesta'
  | 'romantico'
  | 'nostalgico'
  | 'hype'
  | 'chill'
  | 'heartbreak'
  | 'introspectivo'
  | 'desahogo';

export interface VibeDef {
  key: VibeKey;
  label: string;
  emoji: string;
}

export const VIBES: VibeDef[] = [
  { key: 'fiesta', label: 'Fiesta', emoji: '🎉' },
  { key: 'romantico', label: 'Romántico', emoji: '💕' },
  { key: 'nostalgico', label: 'Nostálgico', emoji: '🌇' },
  { key: 'hype', label: 'Hype', emoji: '🔥' },
  { key: 'chill', label: 'Chill', emoji: '😌' },
  { key: 'heartbreak', label: 'Heartbreak', emoji: '💔' },
  { key: 'introspectivo', label: 'Introspectivo', emoji: '🌙' },
  { key: 'desahogo', label: 'Desahogo', emoji: '😮‍💨' },
];
