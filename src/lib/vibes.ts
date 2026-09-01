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
 *
 * 2026-09-01: agregado `category` -- mismo motivo que GenreCategory en
 * genres.ts (ver CategorizedChipPicker.tsx).
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

export type VibeCategory = 'Para Subir el Ánimo' | 'Amor' | 'Para Relajarte' | 'Emociones Intensas';

export const VIBE_CATEGORY_ORDER: VibeCategory[] = ['Para Subir el Ánimo', 'Amor', 'Para Relajarte', 'Emociones Intensas'];

export interface VibeDef {
  key: VibeKey;
  category: VibeCategory;
  label: string;
  emoji: string;
}

export const VIBES: VibeDef[] = [
  { key: 'fiesta', category: 'Para Subir el Ánimo', label: 'Fiesta', emoji: '🎉' },
  { key: 'hype', category: 'Para Subir el Ánimo', label: 'Hype', emoji: '🔥' },
  { key: 'motivacional', category: 'Para Subir el Ánimo', label: 'Motivacional', emoji: '💪' },
  { key: 'empoderamiento', category: 'Para Subir el Ánimo', label: 'Empoderamiento', emoji: '👑' },
  { key: 'alegre', category: 'Para Subir el Ánimo', label: 'Alegre', emoji: '☀️' },
  { key: 'viaje', category: 'Para Subir el Ánimo', label: 'De Viaje', emoji: '🚗' },
  { key: 'romantico', category: 'Amor', label: 'Romántico', emoji: '💕' },
  { key: 'enamorado', category: 'Amor', label: 'Enamorado', emoji: '😍' },
  { key: 'sensual', category: 'Amor', label: 'Sensual', emoji: '🌶️' },
  { key: 'heartbreak', category: 'Amor', label: 'Heartbreak', emoji: '💔' },
  { key: 'chill', category: 'Para Relajarte', label: 'Chill', emoji: '😌' },
  { key: 'relajacion', category: 'Para Relajarte', label: 'Relajación', emoji: '🛌' },
  { key: 'introspectivo', category: 'Para Relajarte', label: 'Introspectivo', emoji: '🌙' },
  { key: 'enfoque', category: 'Para Relajarte', label: 'Enfoque', emoji: '🎯' },
  { key: 'rabia', category: 'Emociones Intensas', label: 'Rabia', emoji: '😤' },
  { key: 'desahogo', category: 'Emociones Intensas', label: 'Desahogo', emoji: '😮‍💨' },
  { key: 'melancolico', category: 'Emociones Intensas', label: 'Melancólico', emoji: '🥀' },
  { key: 'nostalgico', category: 'Emociones Intensas', label: 'Nostálgico', emoji: '🌇' },
];
