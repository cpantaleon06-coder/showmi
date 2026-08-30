import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { trackToCandidate } from '../api/tasteAdapter';
import { registerSwipeRemote } from '../api/tasteEngineClient';
import { createRemotePost } from '../api/postsClient';
import { Track } from '../api/types';
import { dimensionKeys } from '../lib/tasteEngine';
import { useTasteStateStore } from './tasteStateStore';

export type StarRating = 1 | 2 | 3 | 4 | 5;

export interface Post {
  id: string;
  track: Track;
  rating: StarRating;
  createdAt: number;
}

interface PostState {
  posts: Post[];
  /** Swipe arriba -> calificación con estrellas: guarda un eco local (historial propio),
   *  alimenta al taste engine, y crea el post real en `posts` para que el Feed lo vea.
   *  La reseña de texto y el voto de vibra ya no viven aquí -- se editan directo contra el
   *  post remoto desde Feed (ver postsClient.ts / tasteEngineClient.registerVibeVoteRemote),
   *  no tiene caso mantener una copia local separada de eso. */
  rateTrack: (track: Track, rating: StarRating) => void;
}

/**
 * Rating -> señal del taste engine. Más peso que un swipe plano (0.7 en swipeStore.ts)
 * porque el usuario ya escuchó la canción completa antes de calificar, no es una reacción
 * de medio segundo a una portada: 4-5 estrellas = like fuerte, 3 = like tibio, 1-2 = dislike
 * fuerte (calificar bajo algo que sí escuchaste es una señal tan fuerte como calificar alto).
 */
function ratingToSignal(rating: StarRating): { liked: boolean; intensity: number } {
  if (rating >= 4) return { liked: true, intensity: 1 };
  if (rating === 3) return { liked: true, intensity: 0.5 };
  return { liked: false, intensity: 1 };
}

export const usePostStore = create<PostState>()(
  persist(
    (set) => ({
      posts: [],
      rateTrack: (track, rating) => {
        const post: Post = {
          id: `${track.id}-${Date.now()}`,
          track,
          rating,
          createdAt: Date.now(),
        };
        set((state) => ({ posts: [post, ...state.posts] }));

        const candidate = trackToCandidate(track);
        const { liked, intensity } = ratingToSignal(rating);
        useTasteStateStore.getState().registerLocalSwipe(candidate, liked, intensity);
        registerSwipeRemote(track.id, liked, intensity, dimensionKeys(candidate)).catch(() => {});
        createRemotePost(track.id, rating, track.genre).catch(() => {});

        // TODO: cuando exista el sistema de mascota/cosméticos (Camerino real), este es
        // el punto donde se dispara el progreso de género -- cualquier rating de 1 a 5
        // cuenta como "reseñó la canción", sin importar qué tan alta o baja sea.
      },
    }),
    {
      name: 'showmi-posts',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
