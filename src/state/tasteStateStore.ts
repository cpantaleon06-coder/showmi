import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { normalizeForMatch } from '../api/normalize';
import { CANONICAL_GENRES } from '../lib/genres';
import { BetaParams, Candidate, UserState, registerSwipe, seedFromOnboarding } from '../lib/tasteEngine';
import { syncAcrossTabs } from '../state/crossTabSync';

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
  seedFromOnboardingAnswers: (
    referenceArtists: string[],
    favoriteGenres: string[],
    preferredVibe?: string | null,
  ) => void;
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
      seedFromOnboardingAnswers: (referenceArtists, favoriteGenres, preferredVibe) =>
        set((current) => {
          const next = { ...current.state };
          seedFromOnboarding(referenceArtists.map(normalizeForMatch), favoriteGenres, next, preferredVibe);
          return { state: next };
        }),
    }),
    {
      name: 'showmi-taste-state',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      /**
       * v0 -> v1 (2026-09-09): purga las claves `genero:` en formato CRUDO.
       *
       * Hasta esta versión, `dimensionKeys` construía la dimensión de género con el string
       * de iTunes (`genero:Música latina`, `genero:Hip-Hop/Rap`) mientras el onboarding, el
       * filtro duro y los multiplicadores de sesión usaban la taxonomía canónica
       * (`genero:reggaeton`). Eran dos espacios de claves que nunca se cruzaban, ver
       * Candidate.genero en tasteEngine.ts.
       *
       * Ahora que el motor aprende sobre las canónicas, las crudas ya no las lee ni las
       * refuerza nadie. Se borran en vez de dejarlas ahí: sobrevivirían como peso muerto en
       * AsyncStorage y, peor, saldrían mezcladas con las canónicas en los chips de "tus
       * géneros" del Perfil, que se alimentan justo de estas claves.
       *
       * Se pierde lo aprendido sobre género hasta hoy. Es la opción honesta: esos conteos
       * describen categorías que el resto del sistema nunca supo leer, y no hay forma
       * fiable de mapear "Latin" hacia atrás a UNA canónica (por eso existe la resolución
       * por tags en primer lugar). El resto de las dimensiones -- artista, década, vibra --
       * queda intacto.
       */
      migrate: (persisted, version) => {
        const previous = persisted as { state: UserState } | undefined;
        if (!previous?.state || version >= 1) return previous as { state: UserState };

        const canonical = new Set<string>(CANONICAL_GENRES.map((g) => g.key));
        const cleaned: UserState = {};
        for (const [key, params] of Object.entries(previous.state)) {
          if (key.startsWith('genero:') && !canonical.has(key.slice('genero:'.length))) continue;
          cleaned[key] = params;
        }
        return { state: cleaned };
      },
    }
  )
);

// Rehidrata cuando otra instancia de la app escribe esta clave -- ver crossTabSync.ts
// para el bug de pisado que esto arregla (medido 2026-09-12).
syncAcrossTabs(useTasteStateStore, 'showmi-taste-state');
