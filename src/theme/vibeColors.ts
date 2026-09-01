import { VibeKey } from '../lib/vibes';

/**
 * Sistema reactivo de color por vibra -- paso 1 de la identidad visual
 * constructivista (ver comentario en colors.ts). Reemplaza el rol que hoy
 * cumple `nagaiGradient` en Perfil/Camerino y el estado seleccionado de
 * chips: en vez de un degradado atmosférico fijo, el acento visual
 * REACCIONA a qué vibra está activa (vibra elegida en el selector de
 * sesión, o la vibra dominante del track/sesión actual) -- coherente con
 * la idea de que vibra ya es una dimensión de primera clase en el motor
 * (ver vibes.ts), no solo una etiqueta.
 *
 * Un solo tono sólido por vibra (no un degradado de 3 paradas como
 * nagaiGradient) a propósito: en un sistema maximalista tipo MTV con
 * bloques de color planos y contraste duro (ver colors.ts), un degradado
 * suave por vibra competiría visualmente con el resto de la paleta en vez
 * de leerse como una señal clara de "esta es la vibra activa".
 *
 * Consumido hoy por SwipeCard/SwipeDeck/ActionButtons (acento reactivo del
 * deck) y GradientChip/SessionFilterSheet (fill de la vibra seleccionada) --
 * Perfil/Camerino todavía usan `nagaiGradient`, esa migración sigue
 * pendiente (fuera del orden de 5 pasos ya completado, ver colors.ts).
 *
 * 2026-08-31: 10 vibras nuevas agregadas junto con la ampliación de
 * vibes.ts -- cada una con un tono propio, evitando reusar un hue ya
 * ocupado por otra vibra existente (18 colores distintos es difícil de
 * separar perfectamente, pero se revisó a mano que no haya dos casi
 * idénticos uno al lado del otro en la UI).
 */
export const VIBE_COLORS: Record<VibeKey, string> = {
  fiesta: '#E8362A',
  romantico: '#D9718C',
  nostalgico: '#0F6E7D',
  hype: '#E8B923',
  chill: '#2F7A78',
  heartbreak: '#8C1C13',
  introspectivo: '#3A3752',
  desahogo: '#D9631E',
  motivacional: '#B45309',
  melancolico: '#5B5F97',
  enamorado: '#EC4899',
  sensual: '#9D174D',
  empoderamiento: '#6D28D9',
  rabia: '#7F1D1D',
  alegre: '#FACC15',
  relajacion: '#3B82F6',
  viaje: '#059669',
  enfoque: '#1E3A8A',
};

/** Fallback explícito para cuando no hay vibra activa (ej. deck mixto sin selector). */
export function getVibeColor(vibe: VibeKey | null | undefined, fallback: string): string {
  if (!vibe) return fallback;
  return VIBE_COLORS[vibe] ?? fallback;
}
