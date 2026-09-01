import { create } from 'zustand';

import { serializeAnchor } from '../api/tasteAdapter';
import { DeckAnchor } from '../api/types';
import { SessionSelection, SessionTreeWeights, recordSessionSwipe } from '../lib/sessionTree';
import { useSessionFilterStore } from './sessionFilterStore';

interface SessionTreeState {
  accumulator: SessionTreeWeights;
  recordSwipe: (selection: SessionSelection, liked: boolean, intensity: number) => void;
  /** Vacía el acumulador -- se llama después de consolidar (ver consolidateSessionTree en
   *  tasteEngineClient.ts) para que la SIGUIENTE visita a la pestaña Swipe empiece una
   *  sesión-de-árbol nueva. Este "cierre de sesión" es más fino que el de
   *  sessionFilterStore.resolvedThisSession (que dura todo el proceso de JS): acá una
   *  sesión termina cada vez que se sale de Swipe, no solo al cerrar la app entera. */
  resetAccumulator: () => void;
}

/**
 * Acumulador de la sesión ACTUAL (un arranque de la app, mismo límite de
 * sesión que ya usa `sessionFilterStore.ts` -- ver su `resolvedThisSession`).
 * Deliberadamente sin `persist`: es señal de corto plazo por diseño (ver
 * sessionTree.ts), vive y muere con el proceso de JS -- persistirlo
 * difuminaría el límite de sesión del que depende toda la lógica de decay.
 *
 * Alimenta `sessionTreeToMultipliers` en useDeck.ts para el ranking suave
 * DENTRO de esta sesión. La consolidación a `taste_profile` (largo plazo,
 * entre sesiones) y la sugerencia de próxima sesión (`suggestNextSessionSelection`)
 * NO están conectadas todavía -- necesitan definir primero qué dispara un
 * "cierre de sesión" del lado de la UI (ver taste-engine/README.md,
 * Pendiente).
 */
export const useSessionTreeStore = create<SessionTreeState>((set) => ({
  accumulator: {},
  recordSwipe: (selection, liked, intensity) =>
    set((state) => ({
      accumulator: recordSessionSwipe(state.accumulator, selection, liked, intensity),
    })),
  resetAccumulator: () => set({ accumulator: {} }),
}));

/**
 * Arma el `SessionSelection` de un swipe a partir del género/vibra elegidos en el selector
 * de sesión (`sessionFilterStore.ts`) + el ancla real de esta sesión. idioma/época quedan
 * sin poblar a propósito (sin taxonomía ni selector todavía, ver tasteAdapter.ts). Vive acá
 * (no en tasteAdapter.ts) para no invertir la dirección de dependencia establecida
 * (api/ -> nunca depende de state/); swipeStore.ts/postStore.ts importan esta única función
 * en vez de duplicar la construcción cada uno por su lado.
 */
export function buildSessionSelection(anchor: DeckAnchor): SessionSelection {
  const { genre, vibe } = useSessionFilterStore.getState();
  return {
    genero: genre ?? undefined,
    vibras: vibe ? [vibe] : undefined,
    ancla: serializeAnchor(anchor),
  };
}
