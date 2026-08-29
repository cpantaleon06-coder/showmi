import { create } from 'zustand';

import { trackToCandidate } from '../api/tasteAdapter';
import { registerSwipeRemote } from '../api/tasteEngineClient';
import { Track } from '../api/types';
import { DeckAnchor } from '../hooks/useDeck';
import { dimensionKeys } from '../lib/tasteEngine';
import { useTasteStateStore } from './tasteStateStore';

export type SwipeDirection = 'left' | 'right' | 'up';

interface SwipeRecord {
  track: Track;
  direction: SwipeDirection;
  at: number;
}

interface SwipeState {
  anchor: DeckAnchor | null;
  currentIndex: number;
  history: SwipeRecord[];
  advance: (track: Track, direction: SwipeDirection) => void;
  reanchor: (anchor: DeckAnchor) => void;
}

/** left = dislike normal, right = like normal, up = "ya la escuché" (señal fuerte, ya la conoce) */
function directionToSignal(direction: SwipeDirection): { liked: boolean; intensity: number } {
  if (direction === 'left') return { liked: false, intensity: 0.7 };
  if (direction === 'up') return { liked: true, intensity: 1 };
  return { liked: true, intensity: 0.7 };
}

export const useSwipeStore = create<SwipeState>((set) => ({
  anchor: null,
  currentIndex: 0,
  history: [],
  advance: (track, direction) => {
    set((state) => ({
      currentIndex: state.currentIndex + 1,
      history: [...state.history, { track, direction, at: Date.now() }],
    }));

    const candidate = trackToCandidate(track);
    const { liked, intensity } = directionToSignal(direction);

    // El motor local reacciona de inmediato (el deck no espera a la red).
    useTasteStateStore.getState().registerLocalSwipe(candidate, liked, intensity);

    // El ledger remoto se dispara aparte, sin bloquear: registerSwipeRemote ya se traga
    // sus propios errores (los loggea), el .catch acá es solo para cualquier rechazo
    // inesperado (ej. sin red) que no haya pasado por ese manejo interno.
    registerSwipeRemote(track.id, liked, intensity, dimensionKeys(candidate)).catch(() => {});
  },
  reanchor: (anchor) => set({ anchor, currentIndex: 0, history: [] }),
}));
