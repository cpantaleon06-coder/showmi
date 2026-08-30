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
  /** Vuelve al pool mixto de siempre -- usado cuando se quita el chip de género de sesión. */
  clearAnchor: () => void;
}

/**
 * left = dislike normal, right = like normal. 'up' ("ya la escuché") ya NO dispara señal
 * aquí -- ahora abre el selector de estrellas (ver StarRatingPicker/postStore), y es esa
 * calificación 1-5 la que alimenta al taste engine con más peso que un swipe plano, en vez
 * de un intensity=1 fijo sin importar qué tan bien le fue a la canción.
 */
function directionToSignal(direction: SwipeDirection): { liked: boolean; intensity: number } | null {
  if (direction === 'left') return { liked: false, intensity: 0.7 };
  if (direction === 'right') return { liked: true, intensity: 0.7 };
  return null;
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

    const signal = directionToSignal(direction);
    if (!signal) return; // 'up': el signal llega después, desde la calificación de estrellas

    const candidate = trackToCandidate(track);
    const { liked, intensity } = signal;

    // El motor local reacciona de inmediato (el deck no espera a la red).
    useTasteStateStore.getState().registerLocalSwipe(candidate, liked, intensity);

    // El ledger remoto se dispara aparte, sin bloquear: registerSwipeRemote ya se traga
    // sus propios errores (los loggea), el .catch acá es solo para cualquier rechazo
    // inesperado (ej. sin red) que no haya pasado por ese manejo interno.
    registerSwipeRemote(track.id, liked, intensity, dimensionKeys(candidate)).catch(() => {});
  },
  reanchor: (anchor) => set({ anchor, currentIndex: 0, history: [] }),
  clearAnchor: () => set({ anchor: null, currentIndex: 0, history: [] }),
}));
