/**
 * Vibra: quinta dimensión del taste engine, votada por la comunidad (ver
 * `track_vibe_votes`/`track_canonical_vibe` en supabase/schema.sql). No es
 * una heurística vía género -- es un valor real por track, igual de "primera
 * clase" que artista/década/popularidad/género en dimensionKeys().
 *
 * Taxonomía cerrada a propósito, igual que del lado de la base de datos: si
 * cambia, el costo es tocar esta lista Y el check constraint de
 * track_vibe_votes, nunca solo uno de los dos.
 *
 * 2026-08-31: ampliada de 8 a 18 vibras (venía demasiado corta -- ver
 * discusión con el usuario). Requiere migrar el check constraint de
 * track_vibe_votes en supabase/schema.sql (pendiente de aplicar, ver
 * comentario ahí) Y actualizar theme/vibeColors.ts con un color por cada
 * vibra nueva -- las tres cosas tienen que moverse juntas.
 */
export type VibeKey =
  | 'fiesta'
  | 'romantico'
  | 'nostalgico'
  | 'hype'
  | 'chill'
  | 'heartbreak'
  | 'introspectivo'
  | 'desahogo'
  | 'motivacional'
  | 'melancolico'
  | 'enamorado'
  | 'sensual'
  | 'empoderamiento'
  | 'rabia'
  | 'alegre'
  | 'relajacion'
  | 'viaje'
  | 'enfoque';

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
  { key: 'motivacional', label: 'Motivacional', emoji: '💪' },
  { key: 'melancolico', label: 'Melancólico', emoji: '🥀' },
  { key: 'enamorado', label: 'Enamorado', emoji: '😍' },
  { key: 'sensual', label: 'Sensual', emoji: '🌶️' },
  { key: 'empoderamiento', label: 'Empoderamiento', emoji: '👑' },
  { key: 'rabia', label: 'Rabia', emoji: '😤' },
  { key: 'alegre', label: 'Alegre', emoji: '☀️' },
  { key: 'relajacion', label: 'Relajación', emoji: '🛌' },
  { key: 'viaje', label: 'De Viaje', emoji: '🚗' },
  { key: 'enfoque', label: 'Enfoque', emoji: '🎯' },
];
