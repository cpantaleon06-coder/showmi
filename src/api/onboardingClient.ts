import { supabase } from '../lib/supabase';
import { CanonicalGenre } from '../lib/genres';
import { VibeKey } from '../lib/vibes';

export interface OnboardingAnswers {
  favoriteGenres: CanonicalGenre[];
  referenceArtists: string[];
  preferredVibe: VibeKey | null;
  anchorArtist: string | null;
  anchorTitle: string | null;
}

/** true si este usuario ya tiene una fila en onboarding_quiz -- si falla la consulta
 *  (sin red, RLS no aplicado todavía, etc.) asume que falta hacerlo, nunca lo contrario:
 *  es preferible mostrar el quiz de más que dejar a alguien sin sembrar su taste_profile. */
export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('onboarding_quiz').select('user_id').eq('user_id', userId).maybeSingle();
  if (error) {
    console.warn('[onboardingClient] hasCompletedOnboarding falló:', error.message);
    return false;
  }
  return !!data;
}

export async function submitOnboarding(userId: string, answers: OnboardingAnswers): Promise<void> {
  const { error } = await supabase.from('onboarding_quiz').upsert({
    user_id: userId,
    favorite_genres: answers.favoriteGenres,
    reference_artists: answers.referenceArtists,
    preferred_mood: answers.preferredVibe,
    anchor_artist: answers.anchorArtist,
    anchor_title: answers.anchorTitle,
  });
  if (error) {
    // No bloqueante a propósito: el sembrado local (seedFromOnboarding) ya
    // corrió, así que el usuario sigue teniendo un deck personalizado esta
    // sesión aunque el registro remoto falle -- se pierde la persistencia
    // entre dispositivos, no la experiencia inmediata.
    console.warn('[onboardingClient] submitOnboarding falló (no bloqueante):', error.message);
  }
}
