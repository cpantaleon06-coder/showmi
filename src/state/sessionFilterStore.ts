import { create } from 'zustand';

import { CanonicalGenre } from '../lib/genres';
import { VibeKey } from '../lib/vibes';

interface SessionFilterState {
  genre: CanonicalGenre | null;
  vibe: VibeKey | null;
  /** true en cuanto el selector de sesión se eligió u omitió -- una vez por
   *  arranque de la app. Deliberadamente NO persistido (sin zustand/persist):
   *  reiniciar el motor de JS (cerrar y reabrir la app de verdad) es
   *  exactamente la señal de "nueva sesión" que se necesita aquí; un simple
   *  backgrounding sin matar el proceso deja este store intacto en memoria. */
  resolvedThisSession: boolean;
  setGenre: (genre: CanonicalGenre | null) => void;
  setVibe: (vibe: VibeKey | null) => void;
  resolveSession: (genre: CanonicalGenre | null, vibe: VibeKey | null) => void;
}

export const useSessionFilterStore = create<SessionFilterState>((set) => ({
  genre: null,
  vibe: null,
  resolvedThisSession: false,
  setGenre: (genre) => set({ genre }),
  setVibe: (vibe) => set({ vibe }),
  resolveSession: (genre, vibe) => set({ genre, vibe, resolvedThisSession: true }),
}));
