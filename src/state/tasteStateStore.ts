import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { normalizeForMatch } from '../api/normalize';
import { BetaParams, Candidate, UserState, registerSwipe, seedFromOnboarding } from '../lib/tasteEngine';

interface TasteState {
  state: UserState;
  /** Escribe priors precomputados (ej. vía computeSeedPrior) solo en las claves que el usuario todavía no tiene */
  seedMissingKeys: (seeds: Record<string, BetaParams>) => void;
  /** Aplica un swipe real de inmediato: decay + intensity sobre lo que ya haya (o sobre el prior de arranque si es la primera vez) */
  registerLocalSwipe: (candidate: Candidate, liked: boolean, intensity?: number) => void;
  /** Siembra el taste_profile PERMANENTE desde las respuestas del onboarding -- a diferencia
   *  del selector de sesión (efímero, nunca toca este store), esto sí persiste. Normaliza
   *  los nombres de artista igual que trackToCandidate, para que la misma clave se refuerce
   *  después cuando el usuario swipee ese artista de verdad. */
  seedFromOnboardingAnswers: (referenceArtists: string[], favoriteGenres: string[]) => void;
}

/**
 * UserState persistido localmente (AsyncStorage) para que el deck reaccione sin esperar
 * red. El sync remoto (registerSwipeRemote) es un side-channel aparte, no la fuente de
 * verdad de este store.
 */
export const useTasteStateStore = create<TasteState>()(
  persist(
    (set) => ({
      state: {},
      seedMissingKeys: (seeds) =>
        set((current) => {
          let changed = false;
          const next = { ...current.state };
          for (const [key, params] of Object.entries(seeds)) {
            if (!next[key]) {
              next[key] = params;
              changed = true;
            }
          }
          return changed ? { state: next } : current;
        }),
      registerLocalSwipe: (candidate, liked, intensity = 1) =>
        set((current) => {
          const next = { ...current.state };
          registerSwipe(candidate, liked, next, intensity);
          return { state: next };
        }),
      seedFromOnboardingAnswers: (referenceArtists, favoriteGenres) =>
        set((current) => {
          const next = { ...current.state };
          seedFromOnboarding(referenceArtists.map(normalizeForMatch), favoriteGenres, next);
          return { state: next };
        }),
    }),
    {
      name: 'showmi-taste-state',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
